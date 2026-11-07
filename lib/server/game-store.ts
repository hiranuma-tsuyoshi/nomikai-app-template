import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  cloneState,
  createInitialState,
  DEFAULT_ROOM_CODE,
  tickState,
} from "@/lib/live/engine";
import type { GameState } from "@/lib/live/types";

export interface GameStore {
  read(): Promise<GameState>;
  mutate<T>(fn: (state: GameState) => T | Promise<T>): Promise<T>;
}

const STORE_KEY = "__nomikaiGameStore";
const GAME_STATE_FILE =
  process.env.GAME_STATE_FILE ??
  path.join(process.cwd(), ".data", "game-state.json");
const SUPABASE_ROW_CODE = process.env.GAME_ROOM_KEY ?? "default";

function createSeedState(): GameState {
  const teamCount = Number(process.env.TEAM_COUNT ?? 5);
  const capacity = Number(process.env.TEAM_CAPACITY ?? 7);

  return createInitialState({
    code: process.env.ROOM_CODE ?? DEFAULT_ROOM_CODE,
    teamCount: Number.isInteger(teamCount) && teamCount >= 2 ? teamCount : 5,
    capacity: Number.isInteger(capacity) && capacity >= 1 ? capacity : 7,
  });
}

class FileGameStore implements GameStore {
  private queue: Promise<unknown> = Promise.resolve();

  private async readUnsafe(): Promise<GameState> {
    try {
      const raw = await fs.readFile(GAME_STATE_FILE, "utf8");
      return JSON.parse(raw) as GameState;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw error;

      const state = createSeedState();
      await this.writeUnsafe(state);
      return state;
    }
  }

  private async writeUnsafe(state: GameState): Promise<void> {
    await fs.mkdir(path.dirname(GAME_STATE_FILE), { recursive: true });
    const temp = `${GAME_STATE_FILE}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temp, JSON.stringify(state, null, 2), "utf8");

    try {
      await fs.rename(temp, GAME_STATE_FILE);
    } catch {
      await fs.rm(GAME_STATE_FILE, { force: true });
      await fs.rename(temp, GAME_STATE_FILE);
    }
  }

  read(): Promise<GameState> {
    const run = this.queue.then(() => this.readUnsafe());
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  mutate<T>(fn: (state: GameState) => T | Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const current = await this.readUnsafe();
      const draft = cloneState(current);
      const result = await fn(draft);
      draft.version = current.version + 1;
      await this.writeUnsafe(draft);
      return result;
    });
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

class SupabaseGameStore implements GameStore {
  private client = getSupabaseServerClient();
  private queue: Promise<unknown> = Promise.resolve();

  private async readRow(): Promise<{ state: GameState; version: number } | null> {
    const { data, error } = await this.client
      .from("game_states")
      .select("state, version")
      .eq("room_code", SUPABASE_ROW_CODE)
      .maybeSingle();

    if (error) {
      throw new Error(
        `game_states の読み込みに失敗しました。supabase/migrations/0002_game_state.sql を実行してください: ${error.message}`,
      );
    }
    if (!data) return null;

    return {
      state: data.state as GameState,
      version: Number(data.version),
    };
  }

  private async createRow(): Promise<void> {
    const state = createSeedState();
    const { error } = await this.client.from("game_states").insert({
      room_code: SUPABASE_ROW_CODE,
      state,
      version: state.version,
    });

    // 同時作成は unique 制約で片方だけ成功する。競合は無視して読み直す。
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      throw new Error(
        `game_states の作成に失敗しました。supabase/migrations/0002_game_state.sql を実行してください: ${error.message}`,
      );
    }
  }

  async read(): Promise<GameState> {
    const row = await this.readRow();
    if (row) return row.state;

    await this.createRow();
    const created = await this.readRow();
    if (!created) throw new Error("game_states の初期化に失敗しました");
    return created.state;
  }

  mutate<T>(fn: (state: GameState) => T | Promise<T>): Promise<T> {
    const run = this.queue.then(() => this.mutateUnsafe(fn));
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async mutateUnsafe<T>(
    fn: (state: GameState) => T | Promise<T>,
  ): Promise<T> {
    // 30人規模の一斉回答でも競合を吸収できるよう、再試行を多めに取る。
    // 指数バックオフ + ジッターで、同時リトライの集中を避ける。
    const maxAttempts = 40;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const row = await this.readRow();
      if (!row) {
        await this.createRow();
        continue;
      }

      const draft = cloneState(row.state);
      const result = await fn(draft);
      draft.version = row.version + 1;

      const { data, error } = await this.client
        .from("game_states")
        .update({
          state: draft,
          version: draft.version,
          updated_at: new Date().toISOString(),
        })
        .eq("room_code", SUPABASE_ROW_CODE)
        .eq("version", row.version)
        .select("room_code");

      if (error) {
        throw new Error(`game_states の更新に失敗しました: ${error.message}`);
      }
      if (data && data.length > 0) return result;

      // 楽観ロック競合。ジッター付きで待って再試行する。
      if (attempt < maxAttempts - 1) {
        const ceiling = Math.min(40 * 2 ** Math.min(attempt, 4), 400);
        const delay = Math.floor(ceiling * (0.5 + Math.random() * 0.5));
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error(
      "状態更新が混み合っています。少し待って、もう一度お試しください",
    );
  }
}

function hasSupabaseConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function getGameStore(): GameStore {
  const globalStore = globalThis as typeof globalThis & {
    __nomikaiGameStore?: GameStore;
  };
  if (globalStore[STORE_KEY]) return globalStore[STORE_KEY];

  const store = hasSupabaseConfig()
    ? new SupabaseGameStore()
    : new FileGameStore();
  globalStore[STORE_KEY] = store;
  return store;
}

/**
 * 現在の状態を取得し、期限切れのフェーズを進める。
 * 読み取りのたびに書き込まないよう、変更があった場合だけ保存する。
 */
export async function readGameState(): Promise<GameState> {
  const store = getGameStore();
  const state = await store.read();
  if (!tickState(state)) return state;

  return store.mutate((draft) => {
    tickState(draft);
    draft.version = state.version;
    return draft;
  });
}

/**
 * 読み取り + 変更を1つの排他区間で行う。
 * 変更関数がthrowした場合は保存しない。
 */
export async function mutateGameState<T>(
  fn: (state: GameState) => T | Promise<T>,
): Promise<T> {
  const store = getGameStore();
  return store.mutate(async (draft) => {
    tickState(draft);
    const result = await fn(draft);
    draft.room.updatedAt = new Date().toISOString();
    return result;
  });
}

export async function getGameStoreInfo() {
  return {
    backend: hasSupabaseConfig() ? "supabase" : "file",
    file: hasSupabaseConfig() ? null : GAME_STATE_FILE,
  };
}
