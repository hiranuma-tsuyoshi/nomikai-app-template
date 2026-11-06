"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { formatTime } from "@/lib/format";
import type { HostTeamView, HostView, LivePhase } from "@/lib/live/types";
import {
  postJson,
  usePollingJson,
} from "@/lib/client/use-live-data";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  LockIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
} from "@/components/game/icons";

const HOST_KEY_STORAGE = "nomikai.host-key";

const PHASE_LABELS: Record<LivePhase, string> = {
  WAITING: "参加受付中",
  READY: "開始待ち",
  ANSWERING: "回答受付中",
  ANSWER_CLOSED: "回答締切",
  FINAL_CHECK: "最終確認中",
  REVEAL: "回答公開中",
  GROUPING: "グループ統合",
  SCORED: "得点確定",
  FINISHED: "ゲーム終了",
};

type HostResponse = { view: HostView };

function useCountdown(deadlineAt: string | null): number {
  const [remaining, setRemaining] = useState(() =>
    deadlineAt
      ? Math.max(0, Math.ceil((new Date(deadlineAt).getTime() - Date.now()) / 1000))
      : 0,
  );

  useEffect(() => {
    if (!deadlineAt) {
      setRemaining(0);
      return;
    }
    const update = () =>
      setRemaining(
        Math.max(
          0,
          Math.ceil((new Date(deadlineAt).getTime() - Date.now()) / 1000),
        ),
      );
    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [deadlineAt]);

  return remaining;
}

function PhaseBadge({ phase }: { phase: LivePhase }) {
  const tone =
    phase === "ANSWERING"
      ? "bg-storybook-green text-eager-green-ink"
      : phase === "FINAL_CHECK"
        ? "bg-[#fff4e5] text-[#9a5b00]"
        : phase === "REVEAL"
          ? "bg-[#e6f7ff] text-spark-blue-ink"
          : phase === "GROUPING"
            ? "bg-[#f3ecff] text-[#6b3bb5]"
            : phase === "SCORED" || phase === "FINISHED"
              ? "bg-[#fff8d6] text-[#8a6900]"
              : "bg-[#f2f2f2] text-pencil-gray";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold ${tone}`}
    >
      <span aria-hidden="true" className="size-2 rounded-full bg-current opacity-70" />
      {PHASE_LABELS[phase]}
    </span>
  );
}

export function HostApp() {
  const [hostKey, setHostKey] = useState<string | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlKey = params.get("key");
    const stored = window.sessionStorage.getItem(HOST_KEY_STORAGE);
    const candidate = urlKey ?? stored;

    if (urlKey) {
      window.sessionStorage.setItem(HOST_KEY_STORAGE, urlKey);
      params.delete("key");
      const next = `${window.location.pathname}${
        params.toString() ? `?${params.toString()}` : ""
      }`;
      window.history.replaceState({}, "", next);
      void postJson("/api/host/auth", { key: urlKey }).catch(() => undefined);
    }

    setHostKey(candidate);
    setBootstrapped(true);
  }, []);

  const headers: Record<string, string> = {};
  if (hostKey) headers["x-host-key"] = hostKey;
  const { data, error, loading, refresh } = usePollingJson<HostResponse>(
    "/api/host/state",
    {
      intervalMs: 1200,
      enabled: bootstrapped,
      headers,
    },
  );

  async function login(key: string) {
    setLoginError(null);
    try {
      await postJson("/api/host/auth", { key });
      window.sessionStorage.setItem(HOST_KEY_STORAGE, key);
      setHostKey(key);
      refresh();
    } catch (caught) {
      setLoginError(
        caught instanceof Error ? caught.message : "司会者キーを確認してください",
      );
    }
  }

  if (!bootstrapped) {
    return <LoadingScreen label="司会者画面を準備しています…" />;
  }

  if (
    !data?.view &&
    (error?.code === "HOST_UNAUTHORIZED" || error?.status === 401)
  ) {
    return <HostLogin error={loginError} onLogin={login} />;
  }

  if (!data?.view) {
    if (loading) return <LoadingScreen label="ゲーム状態を読み込んでいます…" />;
    return (
      <div className="grid min-h-dvh place-items-center bg-meadow-mist px-6">
        <div className="w-full max-w-[420px] card p-6 text-center">
          <p className="text-lg font-extrabold text-charcoal">
            接続できませんでした
          </p>
          <p className="mt-2 text-sm leading-6 text-pencil-gray">
            {error?.error ?? "通信を確認して、もう一度お試しください。"}
          </p>
          <button type="button" onClick={refresh} className="btn btn-primary mt-5 w-full">
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <HostConsole
      view={data.view}
      headers={headers}
      refresh={refresh}
      hasKey={Boolean(hostKey)}
    />
  );
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-meadow-mist px-6">
      <div className="text-center">
        <span
          aria-hidden="true"
          className="mx-auto block size-10 animate-spin rounded-full border-4 border-line-soft border-t-eager-green"
        />
        <p className="mt-4 text-sm font-bold text-pencil-gray">{label}</p>
      </div>
    </div>
  );
}

function HostLogin({
  error,
  onLogin,
}: {
  error: string | null;
  onLogin: (key: string) => Promise<void>;
}) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!key.trim() || busy) return;
    setBusy(true);
    await onLogin(key.trim());
    setBusy(false);
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-meadow-mist px-5">
      <form onSubmit={submit} className="w-full max-w-[390px] card p-6">
        <div className="text-center">
          <span
            aria-hidden="true"
            className="mx-auto grid size-14 place-items-center rounded-2xl bg-eager-green text-2xl font-extrabold text-night-ink"
          >
            以
          </span>
          <h1 className="mt-4 text-xl font-extrabold text-charcoal">
            司会者ログイン
          </h1>
          <p className="mt-2 text-sm leading-6 text-pencil-gray">
            本番用の司会者キーを入力してください。
          </p>
        </div>

        <label htmlFor="host-key" className="mt-5 block text-sm font-extrabold text-charcoal">
          司会者キー
        </label>
        <input
          id="host-key"
          type="password"
          value={key}
          onChange={(event) => setKey(event.target.value)}
          autoComplete="current-password"
          className="input mt-1.5"
        />

        {error ? (
          <p role="alert" className="mt-2 text-xs font-bold text-alert-red-ink">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy || !key.trim()}
          className="btn btn-primary mt-5 w-full disabled:bg-[#e5e5e5] disabled:text-faded-gray"
        >
          {busy ? "確認中…" : "ログイン"}
        </button>
      </form>
    </div>
  );
}

function HostConsole({
  view,
  headers,
  refresh,
  hasKey,
}: {
  view: HostView;
  headers: Record<string, string>;
  refresh: () => void;
  hasKey: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const remaining = useCountdown(view.room.phaseEndsAt);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const joinUrl = origin
    ? `${origin}/play?code=${encodeURIComponent(view.room.code)}`
    : "";
  const screenUrl = origin
    ? `${origin}/stage?token=${encodeURIComponent(view.room.screenToken)}`
    : "/stage";

  async function runAction(
    action: string,
    extra?: Record<string, unknown>,
  ) {
    if (busy) return;
    setBusy(action);
    setMessage(null);
    try {
      await postJson<HostResponse>(
        "/api/host/advance",
        { action, expectedPhase: view.phase, ...(extra ?? {}) },
        headers,
      );
      refresh();
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "操作に失敗しました",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-dvh bg-meadow-mist">
      <header className="border-b-2 border-line-soft bg-paper-white">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-eager-green text-lg font-extrabold text-night-ink"
            >
              以
            </span>
            <div className="min-w-0">
              <p className="font-numeric text-[10px] font-extrabold uppercase tracking-[0.18em] text-pencil-gray">
                Host Console · Room {view.room.code}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-extrabold text-charcoal">進行管理</h1>
                <span className="rounded bg-[#f2f2f2] px-1.5 py-0.5 font-numeric text-[11px] font-extrabold text-pencil-gray">
                  {view.question
                    ? `第${view.question.number}問 / 全${view.question.total}問`
                    : `全${view.questions.length}問`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-[#f2f2f2] px-2.5 py-1 font-numeric text-[11px] font-extrabold text-pencil-gray">
              回答 {view.counts.totalAnswered} / {view.counts.totalParticipants}人
            </span>
            <PhaseBadge phase={view.phase} />
            <Link
              href="/host/questions"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border-2 border-line-soft px-2.5 text-[11px] font-extrabold text-spark-blue-ink hover:bg-[#f2fbff]"
            >
              <PencilIcon className="size-3.5" />
              お題管理
            </Link>
            <Link
              href={screenUrl}
              target="_blank"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border-2 border-line-soft px-2.5 text-[11px] font-extrabold text-spark-blue-ink hover:bg-[#f2fbff]"
            >
              <PlayIcon className="size-3.5" />
              スクリーン
            </Link>
            {hasKey ? (
              <button
                type="button"
                onClick={() => {
                  window.sessionStorage.removeItem(HOST_KEY_STORAGE);
                  window.location.reload();
                }}
                className="min-h-9 rounded-lg border-2 border-line-soft px-2.5 text-[11px] font-extrabold text-pencil-gray hover:bg-[#f7f7f7]"
              >
                ログアウト
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {message ? (
        <div className="mx-auto w-full max-w-[1440px] px-4 pt-3 lg:px-8">
          <div
            role="alert"
            className="rounded-xl border-2 border-[#ffd0d0] bg-[#fff5f5] px-3 py-2 text-sm font-bold text-alert-red-ink"
          >
            {message}
          </div>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-[1440px] px-4 py-4 lg:px-8">
        {view.phase === "WAITING" || view.phase === "READY" ? (
          <PregamePanel
            view={view}
            joinUrl={joinUrl}
            headers={headers}
            refresh={refresh}
            busy={busy}
            runAction={runAction}
          />
        ) : view.phase === "ANSWERING" || view.phase === "FINAL_CHECK" ? (
          <AnsweringPanel
            view={view}
            remaining={remaining}
            refresh={refresh}
            busy={busy}
            runAction={runAction}
          />
        ) : view.phase === "REVEAL" ? (
          <RevealPanel view={view} busy={busy} runAction={runAction} />
        ) : view.phase === "GROUPING" ? (
          <GroupingPanel
            view={view}
            headers={headers}
            refresh={refresh}
            busy={busy}
          />
        ) : view.phase === "SCORED" ? (
          <ScoredPanel view={view} busy={busy} runAction={runAction} />
        ) : (
          <FinishedPanel view={view} busy={busy} runAction={runAction} />
        )}

        {view.phase !== "WAITING" && view.phase !== "READY" ? (
          <TeamRoster view={view} />
        ) : null}
      </main>
    </div>
  );
}

function PregamePanel({
  view,
  joinUrl,
  headers,
  refresh,
  busy,
  runAction,
}: {
  view: HostView;
  joinUrl: string;
  headers: Record<string, string>;
  refresh: () => void;
  busy: string | null;
  runAction: (action: string, extra?: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState(view.teams[0]?.id ?? "");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [teamBusy, setTeamBusy] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  async function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (joining || !name.trim() || !teamId) return;
    setJoining(true);
    setJoinError(null);
    try {
      await postJson("/api/join", {
        code: view.room.code,
        name: name.trim(),
        teamId,
      });
      refresh();
    } catch (caught) {
      setJoinError(
        caught instanceof Error ? caught.message : "参加できませんでした",
      );
    } finally {
      setJoining(false);
    }
  }

  async function changeCapacity(teamId: string, delta: number) {
    const team = view.teams.find((entry) => entry.id === teamId);
    if (!team || teamBusy) return;
    setTeamBusy(true);
    setTeamError(null);
    try {
      await postJson(
        "/api/host/teams",
        {
          action: "capacity",
          teamId,
          capacity: Math.max(1, Math.min(50, team.capacity + delta)),
        },
        headers,
      );
      refresh();
    } catch (caught) {
      setTeamError(
        caught instanceof Error ? caught.message : "定員を変更できませんでした",
      );
    } finally {
      setTeamBusy(false);
    }
  }

  async function addTeam() {
    if (teamBusy) return;
    setTeamBusy(true);
    setTeamError(null);
    try {
      await postJson("/api/host/teams", { action: "add" }, headers);
      refresh();
    } catch (caught) {
      setTeamError(
        caught instanceof Error ? caught.message : "チームを追加できませんでした",
      );
    } finally {
      setTeamBusy(false);
    }
  }

  async function movePlayer(playerId: string, targetTeamId: string) {
    if (teamBusy) return;
    setTeamBusy(true);
    setTeamError(null);
    try {
      await postJson(
        "/api/host/teams",
        { action: "move-player", playerId, teamId: targetTeamId },
        headers,
      );
      refresh();
    } catch (caught) {
      setTeamError(
        caught instanceof Error
          ? caught.message
          : "参加者を移動できませんでした",
      );
    } finally {
      setTeamBusy(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-caption font-bold text-pencil-gray">参加用URL</p>
            <h2 className="mt-1 text-2xl font-extrabold text-charcoal">
              ルーム {view.room.code}
            </h2>
          </div>
          <span className="rounded-lg bg-storybook-green px-2.5 py-1 text-[11px] font-extrabold text-eager-green-ink">
            {view.room.playerCount}人参加
          </span>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
          <div className="rounded-xl border-2 border-line-soft bg-white p-2">
            {joinUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/qr?text=${encodeURIComponent(joinUrl)}`}
                alt="参加用QRコード"
                className="aspect-square w-full"
              />
            ) : (
              <div className="aspect-square w-full animate-pulse rounded bg-[#f2f2f2]" />
            )}
          </div>
          <div className="min-w-0">
            <p className="break-all rounded-lg bg-[#fafafa] px-3 py-2 font-numeric text-xs font-bold text-charcoal">
              {joinUrl || "URLを準備しています…"}
            </p>
            <p className="mt-2 text-xs leading-5 text-pencil-gray">
              参加者はQRを読み取るか、ルームコード
              <span className="mx-1 font-numeric font-extrabold text-charcoal">
                {view.room.code}
              </span>
              を入力してください。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => runAction("start")}
                className="btn btn-primary min-h-12 px-5 disabled:bg-[#e5e5e5] disabled:text-faded-gray"
              >
                <PlayIcon className="mr-1.5 size-4" />
                {busy === "start" ? "開始中…" : "ゲームを開始"}
              </button>
              <Link
                href="/host/questions"
                className="btn btn-secondary min-h-12 px-4"
              >
                お題を確認（{view.questions.length}問）
              </Link>
            </div>
            {view.questions.length === 0 ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-alert-red-ink">
                <AlertTriangleIcon className="size-3.5" />
                お題を1問以上登録してください
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-base font-extrabold text-charcoal">
          進行担当も選手として参加
        </h2>
        {view.me ? (
          <div className="mt-3 rounded-xl border-2 border-[#b8e986] bg-[#f7ffe9] p-3">
            <p className="text-sm font-extrabold text-charcoal">
              {view.me.name}（{view.me.teamName}）
            </p>
            <p className="mt-1 text-[11px] font-bold text-pencil-gray">
              このPCからも回答できます。回答欄はゲーム開始後に表示されます。
            </p>
          </div>
        ) : (
          <form onSubmit={join} className="mt-3">
            <label htmlFor="host-player-name" className="text-xs font-extrabold text-charcoal">
              名前
            </label>
            <input
              id="host-player-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={20}
              placeholder="例: 山田"
              className="input mt-1"
            />
            <label htmlFor="host-player-team" className="mt-2 block text-xs font-extrabold text-charcoal">
              チーム
            </label>
            <select
              id="host-player-team"
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
              className="input mt-1"
            >
              {view.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}（{team.memberCount}/{team.capacity}人）
                </option>
              ))}
            </select>
            {joinError ? (
              <p className="mt-2 text-xs font-bold text-alert-red-ink">
                {joinError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={joining}
              className="btn btn-secondary mt-3 min-h-11 w-full disabled:opacity-50"
            >
              {joining ? "参加中…" : "このPCを参加者として登録"}
            </button>
          </form>
        )}
      </section>

      <section className="card p-5 xl:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold text-charcoal">チーム編成</h2>
            <p className="mt-0.5 text-[11px] font-bold text-pencil-gray">
              定員を超えたらチームを追加できます（2チーム以上）。
            </p>
          </div>
          <button
            type="button"
            onClick={() => void addTeam()}
            disabled={teamBusy}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border-2 border-line-soft bg-paper-white px-3 text-xs font-extrabold text-spark-blue-ink hover:bg-[#f2fbff] disabled:opacity-50"
          >
            <PlusIcon className="size-3.5" />
            {teamBusy ? "更新中…" : "チームを追加"}
          </button>
        </div>
        {teamError ? (
          <p role="alert" className="mt-2 text-xs font-bold text-alert-red-ink">
            {teamError}
          </p>
        ) : null}
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {view.teams.map((team) => (
            <div key={team.id} className="rounded-xl border-2 border-line-soft p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: team.color }}
                  />
                  <span className="truncate text-sm font-extrabold text-charcoal">
                    {team.name}
                  </span>
                </span>
                <span className="font-numeric text-xs font-extrabold text-pencil-gray">
                  {team.memberCount} / {team.capacity}人
                </span>
              </div>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {team.players.length === 0 ? (
                  <li className="text-[11px] font-bold text-faded-gray">
                    まだ参加者なし
                  </li>
                ) : (
                  team.players.map((player) => (
                    <li
                      key={player.id}
                      className="flex items-center gap-1 rounded bg-[#f2f2f2] py-0.5 pl-1.5 pr-0.5 text-[11px] font-bold text-charcoal"
                    >
                      <span>{player.name}</span>
                      <select
                        aria-label={`${player.name}のチーム`}
                        value={team.id}
                        disabled={teamBusy}
                        onChange={(event) =>
                          void movePlayer(player.id, event.target.value)
                        }
                        className="h-6 rounded bg-white px-0.5 text-[10px] font-bold text-pencil-gray disabled:opacity-50"
                      >
                        {view.teams.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))
                )}
              </ul>
              <div className="mt-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => changeCapacity(team.id, -1)}
                  disabled={teamBusy}
                  className="grid size-8 place-items-center rounded-lg border-2 border-line-soft text-sm font-extrabold text-charcoal disabled:opacity-40"
                >
                  −
                </button>
                <span className="text-[10px] font-bold text-pencil-gray">定員</span>
                <button
                  type="button"
                  onClick={() => changeCapacity(team.id, 1)}
                  disabled={teamBusy}
                  className="grid size-8 place-items-center rounded-lg border-2 border-line-soft text-sm font-extrabold text-charcoal disabled:opacity-40"
                >
                  ＋
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AnsweringPanel({
  view,
  remaining,
  refresh,
  busy,
  runAction,
}: {
  view: HostView;
  remaining: number;
  refresh: () => void;
  busy: string | null;
  runAction: (action: string, extra?: Record<string, unknown>) => Promise<void>;
}) {
  const [draft, setDraft] = useState(view.ownAnswer?.text ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isFinal = view.phase === "FINAL_CHECK";

  useEffect(() => {
    setDraft(view.ownAnswer?.text ?? "");
  }, [view.ownAnswer?.text, view.ownAnswer?.updatedAt]);

  async function saveAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim() || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await postJson("/api/answers", { text: draft.trim() });
      refresh();
    } catch (caught) {
      setSaveError(
        caught instanceof Error ? caught.message : "回答を送信できませんでした",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <section className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1 rounded-lg bg-storybook-green px-2 py-1 text-[11px] font-extrabold text-eager-green-ink">
                <ClockIcon className="size-3.5" />
                {isFinal ? "最終確認" : "お題"}
              </span>
              <h2 className="mt-3 text-balance font-rounded text-[28px] font-extrabold leading-tight text-charcoal">
                {view.question?.text}
              </h2>
              <p className="mt-2 text-xs font-bold text-pencil-gray">
                {view.question
                  ? `第${view.question.number}問 / 全${view.question.total}問`
                  : null}
              </p>
            </div>
            <div
              className={`rounded-xl border-2 px-4 py-3 text-right ${
                isFinal ? "border-[#ffd9a8] bg-[#fff8ee]" : "border-line-soft bg-[#fafafa]"
              }`}
            >
              <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-pencil-gray">
                {isFinal ? "公開まで" : "残り時間"}
              </p>
              <p className="font-numeric text-3xl font-extrabold tabular-nums text-charcoal">
                {formatTime(remaining)}
              </p>
            </div>
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-extrabold text-charcoal">
              チームの回答状況
            </h2>
            <span className="font-numeric text-xs font-extrabold text-pencil-gray">
              回答者4人未満は採点対象外
            </span>
          </div>
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {view.teams.map((team) => (
              <li
                key={team.id}
                className={`rounded-xl border-2 p-3 ${
                  team.answered > 0 && team.answered < 4
                    ? "border-[#ffd0d0] bg-[#fff8f8]"
                    : "border-line-soft bg-paper-white"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-extrabold text-charcoal">
                    <span
                      aria-hidden="true"
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: team.color }}
                    />
                    {team.name}
                  </span>
                  <span className="font-numeric text-sm font-extrabold text-charcoal">
                    {team.answered}
                    <span className="ml-0.5 text-[11px] font-bold text-pencil-gray">
                      / {team.memberCount}人
                    </span>
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-line-soft">
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          (team.answered / Math.max(1, team.memberCount)) * 100,
                        ),
                      )}%`,
                      backgroundColor: team.color,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="card p-5">
          <h2 className="text-base font-extrabold text-charcoal">
            {isFinal ? "公開前の最終確認" : "回答を締め切る"}
          </h2>
          <p className="mt-1 text-xs leading-5 text-pencil-gray">
            {isFinal
              ? "参加者は自分の回答だけを修正できます。公開すると修正できません。"
              : "全員の回答が揃わなくても締め切れます。締切後30秒の最終確認に入ります。"}
          </p>
          {isFinal ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => runAction("extend", { deltaSeconds: -30 })}
                className="btn btn-secondary min-h-11 text-xs disabled:opacity-50"
              >
                −30秒
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => runAction("extend", { deltaSeconds: 30 })}
                className="btn btn-secondary min-h-11 text-xs disabled:opacity-50"
              >
                ＋30秒
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => runAction("reveal")}
                className="btn btn-primary col-span-2 min-h-12 disabled:bg-[#e5e5e5] disabled:text-faded-gray"
              >
                <LockIcon className="mr-1.5 size-4" />
                {busy === "reveal" ? "公開中…" : "今すぐ公開する"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => runAction("close")}
              className="btn btn-primary mt-4 w-full disabled:bg-[#e5e5e5] disabled:text-faded-gray"
            >
              <LockIcon className="mr-1.5 size-4" />
              {busy === "close" ? "締切中…" : "回答を締め切る"}
            </button>
          )}
        </section>

        <section className="card p-5">
          <h2 className="text-base font-extrabold text-charcoal">
            進行担当の回答
          </h2>
          {view.me ? (
            <form onSubmit={saveAnswer} className="mt-3">
              <p className="text-[11px] font-bold text-pencil-gray">
                {view.me.name}（{view.me.teamName}）
              </p>
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={20}
                placeholder="答えを入力"
                className="input mt-1.5"
              />
              {saveError ? (
                <p className="mt-1.5 text-xs font-bold text-alert-red-ink">
                  {saveError}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={saving || !draft.trim()}
                className="btn btn-secondary mt-2 min-h-11 w-full text-xs disabled:opacity-50"
              >
                {saving
                  ? "送信中…"
                  : view.ownAnswer
                    ? "回答を修正する"
                    : "回答を送信する"}
              </button>
              {view.ownAnswer ? (
                <p className="mt-2 text-center text-[11px] font-bold text-eager-green-ink">
                  送信済み: 「{view.ownAnswer.text}」
                </p>
              ) : null}
            </form>
          ) : (
            <p className="mt-2 text-xs leading-5 text-pencil-gray">
              PCを選手として参加させるには、開始前に「進行担当も選手として参加」から登録してください。
            </p>
          )}
        </section>

        <div className="rounded-xl border-2 border-line-soft bg-[#fafafa] p-4 text-xs leading-5 text-pencil-gray">
          <p className="font-extrabold text-charcoal">回答はまだ公開されません</p>
          <p className="mt-1">
            公開前は、この画面にも他チームの回答内容は表示されません。
          </p>
        </div>
      </aside>
    </div>
  );
}

function RevealPanel({
  view,
  busy,
  runAction,
}: {
  view: HostView;
  busy: string | null;
  runAction: (action: string, extra?: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="inline-flex rounded-full bg-[#e6f7ff] px-3 py-1 text-xs font-extrabold text-spark-blue-ink">
              回答公開
            </span>
            <h2 className="mt-2 text-2xl font-extrabold text-charcoal">
              {view.question?.text}
            </h2>
            <p className="mt-1 text-xs font-bold text-pencil-gray">
              全チームの回答を公開しています。統合が必要な場合は次へ進んでください。
            </p>
          </div>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => runAction("grouping")}
            className="btn btn-primary min-h-12 px-5 disabled:bg-[#e5e5e5] disabled:text-faded-gray"
          >
            グループ統合へ
            <ArrowRightIcon className="ml-1.5 size-4" />
          </button>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {view.reveal?.teams.map((team) => (
          <section key={team.id} className="card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-extrabold text-charcoal">
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: team.color }}
                />
                {team.name}
              </span>
              <span className="font-numeric text-[11px] font-bold text-pencil-gray">
                {team.answerCount} / {team.participantCount}人
              </span>
            </div>
            <ul className="mt-2 divide-y-2 divide-line-soft">
              {team.groups.map((group) => (
                <li key={group.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="min-w-0 break-words text-sm font-bold text-charcoal">
                    {group.text}
                  </span>
                  <span className="shrink-0 font-numeric text-xs font-extrabold text-charcoal">
                    ×{group.count}
                  </span>
                </li>
              ))}
              {team.groups.length === 0 ? (
                <li className="py-2 text-xs font-bold text-pencil-gray">回答なし</li>
              ) : null}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function GroupingPanel({
  view,
  headers,
  refresh,
  busy,
}: {
  view: HostView;
  headers: Record<string, string>;
  refresh: () => void;
  busy: string | null;
}) {
  const [activeTeamId, setActiveTeamId] = useState(view.teams[0]?.id ?? "");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [label, setLabel] = useState("");
  const [reason, setReason] = useState("");
  const [localBusy, setLocalBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const activeTeam =
    view.teams.find((team) => team.id === activeTeamId) ?? view.teams[0];
  const autoGroups = activeTeam.groups.filter((group) => !group.reason);
  const mergedGroups = activeTeam.groups.filter((group) => Boolean(group.reason));
  const selectedGroups = autoGroups.filter((group) =>
    selectedKeys.includes(group.key),
  );
  const canMerge =
    selectedGroups.length >= 2 &&
    label.trim().length > 0 &&
    reason.trim().length > 0;

  function toggle(key: string) {
    setSelectedKeys((previous) =>
      previous.includes(key)
        ? previous.filter((entry) => entry !== key)
        : [...previous, key],
    );
  }

  async function merge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canMerge || localBusy) return;
    setLocalBusy("merge");
    setError(null);
    try {
      await postJson(
        "/api/host/groups",
        {
          action: "merge",
          teamId: activeTeam.id,
          keys: selectedKeys,
          label: label.trim(),
          reason: reason.trim(),
        },
        headers,
      );
      setSelectedKeys([]);
      setLabel("");
      setReason("");
      setMessage(`「${label.trim()}」に統合しました`);
      refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "統合できませんでした");
    } finally {
      setLocalBusy(null);
    }
  }

  async function unmerge(groupId: string) {
    if (localBusy) return;
    setLocalBusy("unmerge");
    setError(null);
    try {
      await postJson(
        "/api/host/groups",
        { action: "unmerge", groupId },
        headers,
      );
      setMessage("統合を取り消しました");
      refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "取り消せませんでした",
      );
    } finally {
      setLocalBusy(null);
    }
  }

  async function confirmScores() {
    if (localBusy) return;
    setLocalBusy("score");
    setError(null);
    try {
      await postJson(
        "/api/host/advance",
        { action: "score", expectedPhase: view.phase },
        headers,
      );
      refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "得点を確定できませんでした",
      );
    } finally {
      setLocalBusy(null);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <section className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="inline-flex rounded-full bg-[#f3ecff] px-3 py-1 text-xs font-extrabold text-[#6b3bb5]">
                グループ統合
              </span>
              <h2 className="mt-2 text-2xl font-extrabold text-charcoal">
                {view.question?.text}
              </h2>
              <p className="mt-1 text-xs font-bold text-pencil-gray">
                統合できるのは同じチームの回答だけです。理由は全チームに表示されます。
              </p>
            </div>
          </div>

          <div
            role="tablist"
            aria-label="チーム"
            className="mt-4 flex gap-1 overflow-x-auto rounded-xl border-2 border-line-soft bg-paper-white p-1"
          >
            {view.teams.map((team) => (
              <button
                key={team.id}
                type="button"
                role="tab"
                aria-selected={team.id === activeTeam.id}
                onClick={() => {
                  setActiveTeamId(team.id);
                  setSelectedKeys([]);
                  setLabel("");
                  setReason("");
                }}
                className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-extrabold ${
                  team.id === activeTeam.id
                    ? "bg-storybook-green text-eager-green-ink"
                    : "text-charcoal hover:bg-[#f7f7f7]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: team.color }}
                />
                {team.name}
                <span className="font-numeric text-[10px] text-pencil-gray">
                  {team.answered}人
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-extrabold text-charcoal">
              {activeTeam.name}の回答
            </h2>
            <span className="font-numeric text-xs font-bold text-pencil-gray">
              {autoGroups.length}グループ
            </span>
          </div>

          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {autoGroups.map((group) => {
              const selected = selectedKeys.includes(group.key);
              return (
                <li key={group.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggle(group.key)}
                    className={`flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border-2 px-3 text-left ${
                      selected
                        ? "border-spark-blue bg-[#f2fbff]"
                        : "border-line-soft bg-paper-white hover:bg-[#fafafa]"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={`grid size-5 shrink-0 place-items-center rounded border-2 ${
                          selected
                            ? "border-spark-blue bg-spark-blue text-white"
                            : "border-faded-gray text-transparent"
                        }`}
                      >
                        <CheckIcon className="size-3.5" />
                      </span>
                      <span className="break-words text-sm font-extrabold text-charcoal">
                        {group.text}
                      </span>
                    </span>
                    <span className="shrink-0 rounded bg-[#f2f2f2] px-2 py-0.5 font-numeric text-xs font-extrabold text-charcoal">
                      ×{group.count}
                    </span>
                  </button>
                </li>
              );
            })}
            {autoGroups.length === 0 ? (
              <li className="text-xs font-bold text-pencil-gray">
                統合できる回答がありません。
              </li>
            ) : null}
          </ul>

          {mergedGroups.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-extrabold text-[#6b3bb5]">統合済み</p>
              <ul className="mt-2 grid gap-2">
                {mergedGroups.map((group) => (
                  <li
                    key={group.id}
                    className="rounded-xl border-2 border-[#d9c7ff] bg-[#fbf7ff] p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-extrabold text-charcoal">
                        {group.text} ×{group.count}
                      </span>
                      <button
                        type="button"
                        onClick={() => unmerge(group.id)}
                        disabled={Boolean(localBusy)}
                        className="text-[11px] font-extrabold text-[#6b3bb5] underline disabled:opacity-50"
                      >
                        取消
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] font-bold text-charcoal">
                      理由: {group.reason}
                    </p>
                    <p className="mt-0.5 text-[10px] font-medium text-pencil-gray">
                      統合元:{" "}
                      {group.children
                        ?.map((child) => `${child.text} ×${child.count}`)
                        .join(" / ")}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <form onSubmit={merge} className="mt-4 rounded-xl border-2 border-line-soft bg-[#fafafa] p-3">
            {selectedGroups.length === 0 ? (
              <p className="text-xs font-bold text-pencil-gray">
                回答を2つ以上選ぶと、ここで統合できます。
              </p>
            ) : (
              <>
                <p className="text-xs font-bold text-charcoal">
                  選択中:{" "}
                  {selectedGroups
                    .map((group) => `${group.text} ×${group.count}`)
                    .join(" / ")}
                </p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <div>
                    <label htmlFor="merge-label" className="text-[11px] font-extrabold text-charcoal">
                      統合後の回答名
                    </label>
                    <input
                      id="merge-label"
                      value={label}
                      onChange={(event) => setLabel(event.target.value)}
                      maxLength={20}
                      placeholder="例: カレー"
                      className="input mt-1 min-h-10 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="merge-reason" className="text-[11px] font-extrabold text-charcoal">
                      統合理由
                    </label>
                    <input
                      id="merge-reason"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      maxLength={40}
                      placeholder="例: 同じ料理として"
                      className="input mt-1 min-h-10 text-sm"
                    />
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] text-pencil-gray">
                    理由は全チームの画面に表示されます。
                  </p>
                  <button
                    type="submit"
                    disabled={!canMerge || Boolean(localBusy)}
                    className="min-h-10 rounded-lg bg-eager-green px-4 text-xs font-extrabold text-night-ink disabled:bg-[#e5e5e5] disabled:text-faded-gray"
                  >
                    {localBusy === "merge" ? "統合中…" : "統合する"}
                  </button>
                </div>
              </>
            )}
          </form>

          {error ? (
            <p role="alert" className="mt-2 text-xs font-bold text-alert-red-ink">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="mt-2 text-xs font-bold text-eager-green-ink">{message}</p>
          ) : null}
        </section>
      </div>

      <aside className="space-y-4">
        <section className="card p-5">
          <h2 className="text-base font-extrabold text-charcoal">得点を確定</h2>
          <p className="mt-1 text-xs leading-5 text-pencil-gray">
            統合内容を確定し、このお題の得点を計算します。確定後の変更はできません。
          </p>
          <button
            type="button"
            onClick={confirmScores}
            disabled={Boolean(localBusy) || Boolean(busy)}
            className="btn btn-primary mt-4 w-full disabled:bg-[#e5e5e5] disabled:text-faded-gray"
          >
            <CheckIcon className="mr-1.5 size-4" />
            {localBusy === "score" ? "確定中…" : "得点を確定する"}
          </button>
        </section>

        <section className="rounded-xl border-2 border-line-soft bg-[#fafafa] p-4 text-xs leading-5 text-pencil-gray">
          <p className="font-extrabold text-charcoal">採点ルール</p>
          <p className="mt-1">
            最大グループの人数 ÷ 回答者数 × 10。回答者4人未満のチームは採点対象外です。
          </p>
        </section>
      </aside>
    </div>
  );
}

function ScoredPanel({
  view,
  busy,
  runAction,
}: {
  view: HostView;
  busy: string | null;
  runAction: (action: string, extra?: Record<string, unknown>) => Promise<void>;
}) {
  const scoreboard = view.scoreboard;
  const isLast =
    (view.question?.number ?? 0) >= (view.question?.total ?? 0);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="card p-5">
        <span className="inline-flex rounded-full bg-[#fff8d6] px-3 py-1 text-xs font-extrabold text-[#8a6900]">
          得点確定
        </span>
        <h2 className="mt-2 text-2xl font-extrabold text-charcoal">
          {view.question?.text}
        </h2>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {scoreboard?.teams.map((team) => (
            <div
              key={team.id}
              className={`rounded-xl border-2 p-3 ${
                team.rate === 1
                  ? "border-sun-yellow bg-[#fffbe5]"
                  : team.rate === null
                    ? "border-line-soft bg-[#fafafa]"
                    : "border-line-soft bg-paper-white"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-extrabold text-charcoal">
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: team.color }}
                  />
                  {team.name}
                </span>
                <span className="font-numeric text-xl font-extrabold text-charcoal">
                  {team.points === null ? "—" : `${team.points}pt`}
                </span>
              </div>
              <p className="mt-1 text-[11px] font-bold text-pencil-gray">
                {team.answerCount}人中 {team.topAnswerCount}人一致
                {team.rate === null
                  ? " ・ 採点対象外"
                  : ` ・ ${Math.round(team.rate * 100)}%`}
              </p>
            </div>
          ))}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="card p-5">
          <h2 className="text-base font-extrabold text-charcoal">総合順位</h2>
          <ol className="mt-3 space-y-1.5">
            {scoreboard?.ranking.map((entry) => (
              <li
                key={entry.teamId}
                className="flex items-center justify-between gap-2 rounded-lg border-2 border-line-soft px-2.5 py-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-5 font-numeric text-xs font-extrabold text-pencil-gray">
                    {entry.rank}
                  </span>
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="truncate text-xs font-extrabold text-charcoal">
                    {entry.name}
                  </span>
                </span>
                <span className="font-numeric text-sm font-extrabold text-charcoal">
                  {entry.totalPoints}pt
                </span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => runAction("next")}
            className="btn btn-primary mt-4 w-full disabled:bg-[#e5e5e5] disabled:text-faded-gray"
          >
            <ArrowRightIcon className="mr-1.5 size-4" />
            {busy === "next"
              ? "処理中…"
              : isLast
                ? "最終結果を表示"
                : "次のお題へ"}
          </button>
        </section>
      </aside>
    </div>
  );
}

function FinishedPanel({
  view,
  busy,
  runAction,
}: {
  view: HostView;
  busy: string | null;
  runAction: (action: string, extra?: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="card p-5">
        <span className="inline-flex rounded-full bg-sun-yellow px-3 py-1 text-xs font-extrabold text-night-ink">
          ゲーム終了
        </span>
        <h2 className="mt-2 text-2xl font-extrabold text-charcoal">最終結果</h2>
        <ol className="mt-4 space-y-2">
          {view.final?.teams.map((team) => (
            <li
              key={team.teamId}
              className={`flex items-center justify-between gap-3 rounded-xl border-2 px-3 py-3 ${
                team.rank === 1
                  ? "border-sun-yellow bg-[#fffbe5]"
                  : "border-line-soft bg-paper-white"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-6 font-numeric text-lg font-extrabold text-pencil-gray">
                  {team.rank}
                </span>
                <span
                  aria-hidden="true"
                  className="size-3 rounded-full"
                  style={{ backgroundColor: team.color }}
                />
                <span className="truncate text-base font-extrabold text-charcoal">
                  {team.name}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-numeric text-xl font-extrabold text-charcoal">
                  {team.totalPoints}pt
                </span>
                <span className="block text-[10px] font-bold text-pencil-gray">
                  全員一致 {team.perfectCount}回
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>
      <aside className="space-y-4">
        <section className="card p-5">
          <h2 className="text-base font-extrabold text-charcoal">運用</h2>
          <p className="mt-1 text-xs leading-5 text-pencil-gray">
            スクリーンは最終結果を表示しています。同じルームでもう一度遊ぶ場合はリセットしてください。
          </p>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => {
              if (window.confirm("回答・統合・得点を削除して、参加者待機に戻しますか？")) {
                void runAction("reset");
              }
            }}
            className="btn btn-secondary mt-4 w-full text-xs disabled:opacity-50"
          >
            {busy === "reset" ? "リセット中…" : "ゲームをリセット"}
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => {
              if (
                window.confirm(
                  "参加者も含めて全員を消去し、最初の状態に戻しますか？ 本番前のテストデータ消去用です。",
                )
              ) {
                void runAction("reset-all");
              }
            }}
            className="mt-2 min-h-10 w-full rounded-xl border-2 border-[#ffd0d0] px-3 text-[11px] font-extrabold text-alert-red-ink disabled:opacity-50"
          >
            {busy === "reset-all" ? "初期化中…" : "参加者も含めて初期化"}
          </button>
        </section>
      </aside>
    </div>
  );
}

function TeamRoster({ view }: { view: HostView }) {
  return (
    <section className="card mt-4 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-extrabold text-charcoal">参加者一覧</h2>
        <span className="font-numeric text-xs font-bold text-pencil-gray">
          {view.room.playerCount}人
        </span>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {view.teams.map((team) => (
          <TeamRosterCard key={team.id} team={team} />
        ))}
      </div>
    </section>
  );
}

function TeamRosterCard({ team }: { team: HostTeamView }) {
  return (
    <div className="rounded-xl border-2 border-line-soft p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-extrabold text-charcoal">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full"
            style={{ backgroundColor: team.color }}
          />
          {team.name}
        </span>
        <span className="font-numeric text-[11px] font-bold text-pencil-gray">
          {team.memberCount}人
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {team.players.map((player) => (
          <span
            key={player.id}
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
              player.status === "left"
                ? "bg-[#f2f2f2] text-faded-gray line-through"
                : "bg-[#f2f2f2] text-charcoal"
            }`}
          >
            {player.name}
          </span>
        ))}
      </div>
    </div>
  );
}
