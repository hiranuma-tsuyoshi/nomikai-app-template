import { countCharacters } from "@/lib/format";
import { normalizeAnswer } from "@/lib/normalize";
import { calcScore } from "@/lib/scoring";
import type {
  GameState,
  LiveAnswer,
  LiveAnswerGroup,
  LivePlayer,
  LiveQuestion,
  LiveScore,
  LiveTeam,
  RevealView,
  ScoreboardView,
  TeamStatusView,
  FinalView,
  VisibleAnswerGroup,
} from "./types";

export const MAX_ANSWER_LENGTH = 20;
export const MAX_MERGED_NAME_LENGTH = 20;
export const MAX_MERGE_REASON_LENGTH = 40;
export const DEFAULT_FINAL_CHECK_SECONDS = 30;
export const DEFAULT_ROOM_CODE = "4821";
export const ROOM_TITLE = "以心伝心ゲーム";

export const TEAM_COLORS = [
  "#58cc02",
  "#1cb0f6",
  "#ce82ff",
  "#ff9600",
  "#ff4b4b",
  "#ffc800",
  "#00b8a9",
  "#f47eaa",
];

export const DEMO_TEAM_NAMES = [
  "チームA",
  "チームB",
  "チームC",
  "チームD",
  "チームE",
  "チームF",
];

export const SEED_QUESTION_TEXTS: Array<{
  text: string;
  timeLimitSeconds: number;
}> = [
  { text: "休日の過ごし方といえば？", timeLimitSeconds: 60 },
  { text: "好きな季節といえば？", timeLimitSeconds: 60 },
  { text: "朝ごはんといえば？", timeLimitSeconds: 60 },
  { text: "飲み会で最初に頼むものといえば？", timeLimitSeconds: 60 },
  { text: "仕事の後に欲しいものといえば？", timeLimitSeconds: 60 },
  { text: "旅行で行きたい場所といえば？", timeLimitSeconds: 90 },
  { text: "最近ハマっていることといえば？", timeLimitSeconds: 60 },
  { text: "この飲み会を一言で表すと？", timeLimitSeconds: 90 },
];

export class GameError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "GameError";
    this.code = code;
    this.status = status;
  }
}

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function iso(now: number): string {
  return new Date(now).toISOString();
}

function addSeconds(now: number, seconds: number): string {
  return new Date(now + seconds * 1000).toISOString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createInitialState(options?: {
  code?: string;
  teamCount?: number;
  capacity?: number;
  now?: number;
}): GameState {
  const now = options?.now ?? Date.now();
  const teamCount = options?.teamCount ?? 5;
  const capacity = options?.capacity ?? 7;
  const teams: LiveTeam[] = Array.from({ length: teamCount }, (_, index) => ({
    id: `team-${String.fromCharCode(97 + index)}`,
    name: DEMO_TEAM_NAMES[index] ?? `チーム${index + 1}`,
    color: TEAM_COLORS[index % TEAM_COLORS.length],
    capacity,
    sortOrder: index,
  }));
  const questions: LiveQuestion[] = SEED_QUESTION_TEXTS.map((question, index) => ({
    id: `question-${index + 1}`,
    text: question.text,
    timeLimitSeconds: question.timeLimitSeconds,
    orderIndex: index,
  }));

  return {
    schemaVersion: 1,
    version: 1,
    room: {
      code: options?.code ?? DEFAULT_ROOM_CODE,
      title: ROOM_TITLE,
      screenToken: newId("screen"),
      phase: "WAITING",
      currentQuestionIndex: 0,
      phaseEndsAt: null,
      finalCheckSeconds: DEFAULT_FINAL_CHECK_SECONDS,
      startedAt: null,
      finishedAt: null,
      lottery: {},
      updatedAt: iso(now),
    },
    teams,
    players: [],
    questions,
    answers: [],
    groups: [],
    scores: [],
    logs: [],
    questionsFrozen: false,
  };
}

export function sortedQuestions(state: GameState): LiveQuestion[] {
  return [...state.questions].sort((a, b) => a.orderIndex - b.orderIndex);
}

export function getCurrentQuestion(state: GameState): LiveQuestion | null {
  const questions = sortedQuestions(state);
  if (questions.length === 0) return null;

  const index = Math.min(
    Math.max(0, state.room.currentQuestionIndex),
    questions.length - 1,
  );
  return questions[index];
}

export function getQuestionNumber(state: GameState): number {
  return Math.min(
    state.room.currentQuestionIndex + 1,
    Math.max(1, state.questions.length),
  );
}

export function isQuestionPhase(phase: GameState["room"]["phase"]): boolean {
  return (
    phase === "ANSWERING" ||
    phase === "ANSWER_CLOSED" ||
    phase === "FINAL_CHECK" ||
    phase === "REVEAL" ||
    phase === "GROUPING" ||
    phase === "SCORED"
  );
}

export function isRevealed(phase: GameState["room"]["phase"]): boolean {
  return phase === "REVEAL" || phase === "GROUPING" || phase === "SCORED" || phase === "FINISHED";
}

export function logAction(
  state: GameState,
  action: string,
  actor: string,
  payload: Record<string, unknown> = {},
  now = Date.now(),
): void {
  state.logs.push({
    id: newId("log"),
    action,
    actor: actor.slice(0, 30) || "運営",
    payload,
    createdAt: iso(now),
  });
  if (state.logs.length > 500) {
    state.logs = state.logs.slice(-500);
  }
}

/**
 * 期限切れの自動遷移。回答締切 -> 最終確認 -> 公開。
 * 変更があった場合だけ true を返す。
 */
export function tickState(state: GameState, now = Date.now()): boolean {
  const endsAt = state.room.phaseEndsAt
    ? new Date(state.room.phaseEndsAt).getTime()
    : null;

  if (state.room.phase === "ANSWER_CLOSED") {
    state.room.phase = "FINAL_CHECK";
    state.room.phaseEndsAt = addSeconds(now, state.room.finalCheckSeconds);
    state.room.updatedAt = iso(now);
    logAction(state, "auto_final_check", "system", {}, now);
    return true;
  }

  if (endsAt === null || now < endsAt) return false;

  if (state.room.phase === "ANSWERING") {
    state.room.phase = "FINAL_CHECK";
    state.room.phaseEndsAt = addSeconds(now, state.room.finalCheckSeconds);
    state.room.updatedAt = iso(now);
    logAction(state, "auto_final_check", "system", {}, now);
    return true;
  }

  if (state.room.phase === "FINAL_CHECK") {
    state.room.phase = "REVEAL";
    state.room.phaseEndsAt = null;
    state.room.updatedAt = iso(now);
    logAction(state, "auto_reveal", "system", {}, now);
    return true;
  }

  return false;
}

export function teamMembers(state: GameState, teamId: string): LivePlayer[] {
  return state.players.filter(
    (player) =>
      player.teamId === teamId &&
      (player.status === "active" || player.status === "sleeping"),
  );
}

export function answersForQuestion(
  state: GameState,
  questionId: string,
): LiveAnswer[] {
  return state.answers.filter((answer) => answer.questionId === questionId);
}

export function answersForTeam(
  state: GameState,
  questionId: string,
  teamId: string,
): LiveAnswer[] {
  return state.answers.filter(
    (answer) => answer.questionId === questionId && answer.teamId === teamId,
  );
}

export function teamStatuses(
  state: GameState,
  questionId: string | null,
): TeamStatusView[] {
  return [...state.teams]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((team) => ({
      id: team.id,
      name: team.name,
      color: team.color,
      answered: questionId
        ? answersForTeam(state, questionId, team.id).length
        : 0,
      memberCount: teamMembers(state, team.id).length,
      capacity: team.capacity,
    }));
}

export function joinState(
  state: GameState,
  input: { name: string; teamId: string },
  tokenHash: string,
  now = Date.now(),
): LivePlayer {
  if (state.room.phase === "FINISHED") {
    throw new GameError("GAME_FINISHED", "このゲームは終了しました", 409);
  }

  const team = state.teams.find((entry) => entry.id === input.teamId);
  if (!team) {
    throw new GameError("TEAM_NOT_FOUND", "チームが見つかりません", 404);
  }

  const members = teamMembers(state, team.id);
  if (members.length >= team.capacity) {
    throw new GameError(
      "TEAM_FULL",
      "このチームは定員に達しています。別のチームを選んでください",
      409,
    );
  }

  const rawName = input.name.trim();
  if (rawName.length === 0 || countCharacters(rawName) > 20) {
    throw new GameError(
      "INVALID_NAME",
      "名前は1〜20文字で入力してください",
      422,
    );
  }

  let name = rawName;
  let suffix = 2;
  while (state.players.some((player) => player.name === name)) {
    name = `${rawName} ${suffix}`;
    suffix += 1;
  }

  const player: LivePlayer = {
    id: newId("player"),
    teamId: team.id,
    name,
    status: "active",
    tokenHash,
    joinedAt: iso(now),
    lastSeenAt: iso(now),
  };

  state.players.push(player);
  state.room.updatedAt = iso(now);
  logAction(state, "join", name, { teamId: team.id }, now);
  return player;
}

export function submitAnswer(
  state: GameState,
  playerId: string,
  rawText: string,
  now = Date.now(),
): LiveAnswer {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player || player.status === "left") {
    throw new GameError("PLAYER_NOT_FOUND", "参加者情報が見つかりません", 401);
  }

  if (state.room.phase !== "ANSWERING" && state.room.phase !== "FINAL_CHECK") {
    throw new GameError("ANSWERS_CLOSED", "回答受付は終了しました", 409);
  }

  const endsAt = state.room.phaseEndsAt
    ? new Date(state.room.phaseEndsAt).getTime()
    : null;
  if (endsAt !== null && now >= endsAt) {
    throw new GameError("ANSWERS_CLOSED", "回答受付は終了しました", 409);
  }

  const question = getCurrentQuestion(state);
  if (!question) {
    throw new GameError("NO_QUESTION", "お題がありません", 409);
  }

  const text = rawText.trim();
  const length = countCharacters(text);
  if (length === 0 || length > MAX_ANSWER_LENGTH) {
    throw new GameError(
      "INVALID_ANSWER",
      `回答は1〜${MAX_ANSWER_LENGTH}文字で入力してください`,
      422,
    );
  }

  const normalized = normalizeAnswer(text);
  const existing = state.answers.find(
    (answer) =>
      answer.questionId === question.id && answer.playerId === player.id,
  );

  if (existing) {
    existing.rawText = text;
    existing.normalizedText = normalized;
    existing.updatedAt = iso(now);
    existing.revisionCount += 1;
    state.room.updatedAt = iso(now);
    return existing;
  }

  const answer: LiveAnswer = {
    id: newId("answer"),
    questionId: question.id,
    playerId: player.id,
    teamId: player.teamId,
    rawText: text,
    normalizedText: normalized,
    submittedAt: iso(now),
    updatedAt: iso(now),
    revisionCount: 0,
  };
  state.answers.push(answer);
  state.room.updatedAt = iso(now);
  return answer;
}

export function autoAnswerGroups(
  state: GameState,
  questionId: string,
  teamId: string,
): Array<{ key: string; text: string; count: number; answers: LiveAnswer[] }> {
  const byKey = new Map<string, LiveAnswer[]>();

  for (const answer of answersForTeam(state, questionId, teamId)) {
    const list = byKey.get(answer.normalizedText) ?? [];
    list.push(answer);
    byKey.set(answer.normalizedText, list);
  }

  return [...byKey.entries()]
    .map(([key, answers]) => {
      const textCounts = new Map<string, number>();
      for (const answer of answers) {
        textCounts.set(answer.rawText, (textCounts.get(answer.rawText) ?? 0) + 1);
      }
      const text = [...textCounts.entries()].sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return answers.find((answer) => answer.rawText === a[0])!.submittedAt.localeCompare(
          answers.find((answer) => answer.rawText === b[0])!.submittedAt,
        );
      })[0][0];

      return { key, text, count: answers.length, answers };
    })
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.key.localeCompare(b.key);
    });
}

export function visibleGroups(
  state: GameState,
  questionId: string,
  teamId: string,
): VisibleAnswerGroup[] {
  const autoGroups = autoAnswerGroups(state, questionId, teamId);
  const byKey = new Map(autoGroups.map((group) => [group.key, group]));
  const usedKeys = new Set<string>();
  const merged: VisibleAnswerGroup[] = [];

  const merges = state.groups
    .filter((group) => group.questionId === questionId && group.teamId === teamId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const merge of merges) {
    const children = merge.childKeys
      .map((key) => byKey.get(key))
      .filter((group): group is NonNullable<typeof group> => Boolean(group));

    if (children.length === 0) continue;
    if (children.some((child) => usedKeys.has(child.key))) continue;

    for (const child of children) usedKeys.add(child.key);
    merged.push({
      id: merge.id,
      key: merge.id,
      text: merge.label,
      count: children.reduce((sum, child) => sum + child.count, 0),
      reason: merge.reason,
      mergedFrom: `統合: ${merge.reason}`,
      children: children.map((child) => ({
        text: child.text,
        count: child.count,
      })),
    });
  }

  const visible: VisibleAnswerGroup[] = [
    ...autoGroups
      .filter((group) => !usedKeys.has(group.key))
      .map((group) => ({
        id: `auto:${questionId}:${teamId}:${group.key}`,
        key: group.key,
        text: group.text,
        count: group.count,
      })),
    ...merged,
  ];

  return visible.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.text.localeCompare(b.text);
  });
}

export function mergeGroups(
  state: GameState,
  input: {
    teamId: string;
    keys: string[];
    label: string;
    reason: string;
    actor: string;
  },
  now = Date.now(),
): LiveAnswerGroup {
  if (state.room.phase !== "GROUPING") {
    throw new GameError(
      "INVALID_PHASE",
      "統合はグループ統合フェーズでのみ行えます",
      409,
    );
  }

  const question = getCurrentQuestion(state);
  if (!question) throw new GameError("NO_QUESTION", "お題がありません", 409);

  const team = state.teams.find((entry) => entry.id === input.teamId);
  if (!team) throw new GameError("TEAM_NOT_FOUND", "チームが見つかりません", 404);

  const keys = [...new Set(input.keys)];
  if (keys.length < 2) {
    throw new GameError("MERGE_NEEDS_TWO", "2つ以上の回答を選んでください", 422);
  }

  const autoGroups = autoAnswerGroups(state, question.id, team.id);
  const byKey = new Map(autoGroups.map((group) => [group.key, group]));
  const children = keys.map((key) => byKey.get(key));
  if (children.some((child) => !child)) {
    throw new GameError("GROUP_NOT_FOUND", "回答グループが見つかりません", 404);
  }

  const label = input.label.trim();
  const reason = input.reason.trim();
  if (label.length === 0 || countCharacters(label) > MAX_MERGED_NAME_LENGTH) {
    throw new GameError(
      "INVALID_LABEL",
      `統合後の回答名は1〜${MAX_MERGED_NAME_LENGTH}文字で入力してください`,
      422,
    );
  }
  if (reason.length === 0 || countCharacters(reason) > MAX_MERGE_REASON_LENGTH) {
    throw new GameError(
      "INVALID_REASON",
      `統合理由は1〜${MAX_MERGE_REASON_LENGTH}文字で入力してください`,
      422,
    );
  }

  const alreadyMerged = new Set(
    state.groups
      .filter(
        (group) => group.questionId === question.id && group.teamId === team.id,
      )
      .flatMap((group) => group.childKeys),
  );
  if (keys.some((key) => alreadyMerged.has(key))) {
    throw new GameError(
      "ALREADY_MERGED",
      "すでに統合済みの回答が含まれています",
      409,
    );
  }

  const group: LiveAnswerGroup = {
    id: newId("merge"),
    questionId: question.id,
    teamId: team.id,
    label,
    reason,
    childKeys: keys,
    children: children.map((child) => ({ text: child!.text, count: child!.count })),
    createdBy: input.actor.slice(0, 30) || "運営",
    createdAt: iso(now),
  };

  state.groups.push(group);
  state.room.updatedAt = iso(now);
  logAction(
    state,
    "merge",
    input.actor,
    { teamId: team.id, label, reason, keys },
    now,
  );
  return group;
}

export function unmergeGroup(
  state: GameState,
  groupId: string,
  actor: string,
  now = Date.now(),
): void {
  if (state.room.phase !== "GROUPING") {
    throw new GameError(
      "INVALID_PHASE",
      "統合の取消はグループ統合フェーズでのみ行えます",
      409,
    );
  }

  const index = state.groups.findIndex((group) => group.id === groupId);
  if (index < 0) {
    throw new GameError("GROUP_NOT_FOUND", "統合が見つかりません", 404);
  }

  const [removed] = state.groups.splice(index, 1);
  state.room.updatedAt = iso(now);
  logAction(
    state,
    "unmerge",
    actor,
    { teamId: removed.teamId, label: removed.label },
    now,
  );
}

export type HostAction =
  | "start"
  | "close"
  | "reveal"
  | "grouping"
  | "score"
  | "next"
  | "finish"
  | "reset"
  | "reset-all";

export function applyHostAction(
  state: GameState,
  action: HostAction,
  actor: string,
  expectedPhase?: string,
  now = Date.now(),
): void {
  if (expectedPhase && expectedPhase !== state.room.phase) {
    throw new GameError(
      "PHASE_CONFLICT",
      `画面の状態が古いようです（現在: ${state.room.phase}）。再読み込みしてください`,
      409,
    );
  }

  const log = (payload: Record<string, unknown> = {}) =>
    logAction(state, `host_${action}`, actor, payload, now);

  if (action === "start") {
    if (state.room.phase !== "WAITING" && state.room.phase !== "READY") {
      throw new GameError("INVALID_PHASE", "ゲームはすでに開始しています", 409);
    }
    const questions = sortedQuestions(state);
    if (questions.length === 0) {
      throw new GameError("NO_QUESTIONS", "お題を1問以上登録してください", 409);
    }
    if (state.teams.length < 2) {
      throw new GameError("NOT_ENOUGH_TEAMS", "チームを2つ以上作成してください", 409);
    }
    state.room.phase = "ANSWERING";
    state.room.currentQuestionIndex = 0;
    state.room.phaseEndsAt = addSeconds(now, questions[0].timeLimitSeconds);
    state.room.startedAt = iso(now);
    state.room.finishedAt = null;
    state.questionsFrozen = true;
    state.room.updatedAt = iso(now);
    log({ questionId: questions[0].id });
    return;
  }

  if (action === "close") {
    if (state.room.phase !== "ANSWERING") {
      throw new GameError("INVALID_PHASE", "回答受付中ではありません", 409);
    }
    state.room.phase = "FINAL_CHECK";
    state.room.phaseEndsAt = addSeconds(now, state.room.finalCheckSeconds);
    state.room.updatedAt = iso(now);
    log();
    return;
  }

  if (action === "reveal") {
    if (state.room.phase !== "FINAL_CHECK" && state.room.phase !== "ANSWER_CLOSED") {
      throw new GameError("INVALID_PHASE", "最終確認中ではありません", 409);
    }
    state.room.phase = "REVEAL";
    state.room.phaseEndsAt = null;
    state.room.updatedAt = iso(now);
    log();
    return;
  }

  if (action === "grouping") {
    if (state.room.phase !== "REVEAL") {
      throw new GameError("INVALID_PHASE", "回答公開中ではありません", 409);
    }
    state.room.phase = "GROUPING";
    state.room.phaseEndsAt = null;
    state.room.updatedAt = iso(now);
    log();
    return;
  }

  if (action === "score") {
    if (state.room.phase !== "GROUPING" && state.room.phase !== "REVEAL") {
      throw new GameError("INVALID_PHASE", "統合フェーズではありません", 409);
    }
    computeScoresForCurrentQuestion(state, now);
    state.room.phase = "SCORED";
    state.room.phaseEndsAt = null;
    state.room.updatedAt = iso(now);
    log();
    return;
  }

  if (action === "next") {
    if (state.room.phase !== "SCORED") {
      throw new GameError("INVALID_PHASE", "得点確定後ではありません", 409);
    }
    const questions = sortedQuestions(state);
    if (state.room.currentQuestionIndex >= questions.length - 1) {
      finishGame(state, now);
      return;
    }
    state.room.currentQuestionIndex += 1;
    const next = questions[state.room.currentQuestionIndex];
    state.room.phase = "ANSWERING";
    state.room.phaseEndsAt = addSeconds(now, next.timeLimitSeconds);
    state.room.updatedAt = iso(now);
    log({ questionId: next.id });
    return;
  }

  if (action === "finish") {
    finishGame(state, now);
    return;
  }

  if (action === "reset" || action === "reset-all") {
    state.answers = [];
    state.groups = [];
    state.scores = [];
    state.room.phase = "WAITING";
    state.room.currentQuestionIndex = 0;
    state.room.phaseEndsAt = null;
    state.room.startedAt = null;
    state.room.finishedAt = null;
    state.room.lottery = {};
    state.questionsFrozen = false;
    if (action === "reset-all") {
      state.players = [];
    }
    state.room.updatedAt = iso(now);
    log();
    return;
  }

  throw new GameError("UNKNOWN_ACTION", "不明な操作です", 400);
}

export function finishGame(state: GameState, now = Date.now()): void {
  if (state.room.phase === "FINISHED") return;
  state.room.phase = "FINISHED";
  state.room.phaseEndsAt = null;
  state.room.finishedAt = iso(now);
  for (const team of state.teams) {
    if (state.room.lottery[team.id] === undefined) {
      state.room.lottery[team.id] = Math.random();
    }
  }
  state.room.updatedAt = iso(now);
  logAction(state, "host_finish", "運営", {}, now);
}

export function extendFinalCheck(
  state: GameState,
  deltaSeconds: number,
  actor: string,
  now = Date.now(),
): void {
  if (state.room.phase !== "FINAL_CHECK") {
    throw new GameError("INVALID_PHASE", "最終確認中ではありません", 409);
  }

  const currentEnd = state.room.phaseEndsAt
    ? new Date(state.room.phaseEndsAt).getTime()
    : now;
  const maxEnd = now + 180_000;
  const nextEnd = Math.min(
    maxEnd,
    Math.max(now + 1_000, currentEnd + deltaSeconds * 1000),
  );
  state.room.phaseEndsAt = new Date(nextEnd).toISOString();
  state.room.updatedAt = iso(now);
  logAction(state, "extend_final_check", actor, { deltaSeconds }, now);
}

export function computeScoresForCurrentQuestion(
  state: GameState,
  now = Date.now(),
): LiveScore[] {
  const question = getCurrentQuestion(state);
  if (!question) throw new GameError("NO_QUESTION", "お題がありません", 409);

  const scores: LiveScore[] = state.teams.map((team) => {
    const answers = answersForTeam(state, question.id, team.id);
    const groups = visibleGroups(state, question.id, team.id);
    const maxGroupSize = groups.reduce(
      (max, group) => Math.max(max, group.count),
      0,
    );
    const result = calcScore(answers.length, maxGroupSize);

    return {
      questionId: question.id,
      teamId: team.id,
      answerCount: answers.length,
      maxGroupSize,
      rate: result.status === "scored" ? result.rate : null,
      points: result.status === "scored" ? result.points : null,
      status: result.status,
      perfect: result.status === "scored" && result.points === 10,
      createdAt: iso(now),
    };
  });

  state.scores = [
    ...state.scores.filter((score) => score.questionId !== question.id),
    ...scores,
  ];
  return scores;
}

function scoreFor(
  state: GameState,
  questionId: string,
  teamId: string,
): LiveScore | null {
  return (
    state.scores.find(
      (score) => score.questionId === questionId && score.teamId === teamId,
    ) ?? null
  );
}

export function buildReveal(state: GameState): RevealView | null {
  const question = getCurrentQuestion(state);
  if (!question) return null;

  return {
    questionNumber: getQuestionNumber(state),
    totalQuestions: state.questions.length,
    questionText: question.text,
    teams: [...state.teams]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((team) => {
        const answers = answersForTeam(state, question.id, team.id);
        const memberIds = new Set(teamMembers(state, team.id).map((p) => p.id));
        for (const answer of answers) memberIds.add(answer.playerId);
        return {
          id: team.id,
          name: team.name,
          color: team.color,
          answerCount: answers.length,
          participantCount: memberIds.size,
          groups: visibleGroups(state, question.id, team.id),
        };
      }),
  };
}

export function buildScoreboard(state: GameState): ScoreboardView | null {
  const question = getCurrentQuestion(state);
  if (!question) return null;

  const questions = sortedQuestions(state);
  const lastQuestion = questions[questions.length - 1] ?? null;

  const teams = [...state.teams]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((team) => {
      const current = scoreFor(state, question.id, team.id);
      const teamScores = state.scores.filter((score) => score.teamId === team.id);
      const totalPoints = teamScores.reduce(
        (sum, score) => sum + (score.points ?? 0),
        0,
      );
      const perfectCount = teamScores.filter((score) => score.perfect).length;
      const lastQuestionPoints = lastQuestion
        ? scoreFor(state, lastQuestion.id, team.id)?.points ?? 0
        : 0;
      const answers = answersForTeam(state, question.id, team.id);
      const memberIds = new Set(teamMembers(state, team.id).map((p) => p.id));
      for (const answer of answers) memberIds.add(answer.playerId);

      return {
        id: team.id,
        name: team.name,
        color: team.color,
        answerCount: current?.answerCount ?? answers.length,
        participantCount: memberIds.size,
        topAnswerCount: current?.maxGroupSize ?? 0,
        rate: current?.rate ?? null,
        points: current?.points ?? null,
        totalPoints,
        perfectCount,
        lastQuestionPoints,
        groups: visibleGroups(state, question.id, team.id),
      };
    });

  const ranking = buildRanking(state, false);

  return {
    questionNumber: getQuestionNumber(state),
    totalQuestions: state.questions.length,
    questionText: question.text,
    teams,
    ranking,
  };
}

export function buildRanking(
  state: GameState,
  final: boolean,
): ScoreboardView["ranking"] {
  const questions = sortedQuestions(state);
  const lastQuestion = questions[questions.length - 1] ?? null;

  const rows = state.teams.map((team) => {
    const scores = state.scores.filter((score) => score.teamId === team.id);
    const totalPoints = scores.reduce(
      (sum, score) => sum + (score.points ?? 0),
      0,
    );
    const perfectCount = scores.filter((score) => score.perfect).length;
    const lastQuestionPoints = lastQuestion
      ? scoreFor(state, lastQuestion.id, team.id)?.points ?? 0
      : 0;

    return {
      teamId: team.id,
      name: team.name,
      color: team.color,
      totalPoints,
      perfectCount,
      lastQuestionPoints,
      lottery: state.room.lottery[team.id] ?? 0,
      rank: 0,
    };
  });

  rows.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (final) {
      if (b.perfectCount !== a.perfectCount) return b.perfectCount - a.perfectCount;
      if (b.lastQuestionPoints !== a.lastQuestionPoints) {
        return b.lastQuestionPoints - a.lastQuestionPoints;
      }
      return a.lottery - b.lottery;
    }
    if (b.perfectCount !== a.perfectCount) return b.perfectCount - a.perfectCount;
    return a.teamId.localeCompare(b.teamId);
  });

  if (final) {
    return rows.map((row, index) => ({ ...row, rank: index + 1 }));
  }

  let previousPoints: number | null = null;
  let previousRank = 0;
  return rows.map((row, index) => {
    const rank =
      previousPoints !== null && row.totalPoints === previousPoints
        ? previousRank
        : index + 1;
    previousPoints = row.totalPoints;
    previousRank = rank;
    return { ...row, rank };
  });
}

export function buildFinal(state: GameState): FinalView {
  return {
    totalQuestions: state.questions.length,
    teams: buildRanking(state, true),
  };
}

export function cloneState(state: GameState): GameState {
  return clone(state);
}

export function replaceQuestions(
  state: GameState,
  inputs: Array<{
    id?: string;
    text: string;
    timeLimitSeconds: number;
  }>,
  actor: string,
  now = Date.now(),
): void {
  if (state.questionsFrozen) {
    throw new GameError(
      "QUESTIONS_FROZEN",
      "ゲーム開始後はお題を変更できません",
      409,
    );
  }
  if (inputs.length > 50) {
    throw new GameError("TOO_MANY_QUESTIONS", "お題は50問までです", 422);
  }

  const ids = new Set<string>();
  const questions = inputs.map((input, index) => {
    const text = input.text.trim();
    const length = countCharacters(text);
    if (length === 0 || length > 100) {
      throw new GameError(
        "INVALID_QUESTION",
        `お題は1〜100文字で入力してください（${index + 1}問目）`,
        422,
      );
    }
    if (
      !Number.isInteger(input.timeLimitSeconds) ||
      input.timeLimitSeconds < 10 ||
      input.timeLimitSeconds > 600
    ) {
      throw new GameError(
        "INVALID_TIME_LIMIT",
        `制限時間は10〜600秒で指定してください（${index + 1}問目）`,
        422,
      );
    }

    let id = input.id?.trim();
    if (!id) id = newId("question");
    if (ids.has(id)) {
      throw new GameError("DUPLICATE_QUESTION", "お題IDが重複しています", 422);
    }
    ids.add(id);

    return {
      id,
      text,
      timeLimitSeconds: input.timeLimitSeconds,
      orderIndex: index,
    };
  });

  state.questions = questions;
  if (state.room.currentQuestionIndex >= questions.length) {
    state.room.currentQuestionIndex = Math.max(0, questions.length - 1);
  }
  state.room.updatedAt = iso(now);
  logAction(state, "save_questions", actor, { count: questions.length }, now);
}

export function movePlayerToTeam(
  state: GameState,
  playerId: string,
  teamId: string,
  actor: string,
  now = Date.now(),
): void {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) throw new GameError("PLAYER_NOT_FOUND", "参加者が見つかりません", 404);
  const team = state.teams.find((entry) => entry.id === teamId);
  if (!team) throw new GameError("TEAM_NOT_FOUND", "チームが見つかりません", 404);
  if (player.teamId === teamId) return;

  const members = teamMembers(state, team.id);
  if (members.length >= team.capacity) {
    throw new GameError("TEAM_FULL", "移動先のチームが満員です", 409);
  }

  const previousTeamId = player.teamId;
  player.teamId = teamId;
  const question = getCurrentQuestion(state);
  if (question) {
    const answer = state.answers.find(
      (entry) =>
        entry.questionId === question.id && entry.playerId === player.id,
    );
    if (answer) answer.teamId = teamId;
  }
  state.room.updatedAt = iso(now);
  logAction(
    state,
    "move_player",
    actor,
    { playerId, from: previousTeamId, to: teamId },
    now,
  );
}

export function setTeamCapacity(
  state: GameState,
  teamId: string,
  capacity: number,
  actor: string,
  now = Date.now(),
): void {
  const team = state.teams.find((entry) => entry.id === teamId);
  if (!team) throw new GameError("TEAM_NOT_FOUND", "チームが見つかりません", 404);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 50) {
    throw new GameError("INVALID_CAPACITY", "定員は1〜50人で指定してください", 422);
  }
  team.capacity = capacity;
  state.room.updatedAt = iso(now);
  logAction(state, "set_team_capacity", actor, { teamId, capacity }, now);
}

export function addTeam(
  state: GameState,
  actor: string,
  now = Date.now(),
): LiveTeam {
  if (state.room.phase !== "WAITING" && state.room.phase !== "READY") {
    throw new GameError("INVALID_PHASE", "ゲーム開始後はチームを追加できません", 409);
  }
  if (state.teams.length >= 10) {
    throw new GameError("TOO_MANY_TEAMS", "チームは10個までです", 409);
  }
  const index = state.teams.length;
  const team: LiveTeam = {
    id: `team-${String.fromCharCode(97 + index)}-${Date.now().toString(36)}`,
    name: DEMO_TEAM_NAMES[index] ?? `チーム${index + 1}`,
    color: TEAM_COLORS[index % TEAM_COLORS.length],
    capacity: 7,
    sortOrder: index,
  };
  state.teams.push(team);
  state.room.updatedAt = iso(now);
  logAction(state, "add_team", actor, { teamId: team.id }, now);
  return team;
}
