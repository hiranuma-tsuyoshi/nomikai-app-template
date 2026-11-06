export const LIVE_PHASES = [
  "WAITING",
  "READY",
  "ANSWERING",
  "ANSWER_CLOSED",
  "FINAL_CHECK",
  "REVEAL",
  "GROUPING",
  "SCORED",
  "FINISHED",
] as const;

export type LivePhase = (typeof LIVE_PHASES)[number];

export type PlayerStatus = "active" | "sleeping" | "left";

export type LiveTeam = {
  id: string;
  name: string;
  color: string;
  capacity: number;
  sortOrder: number;
};

export type LivePlayer = {
  id: string;
  teamId: string;
  name: string;
  status: PlayerStatus;
  tokenHash: string | null;
  joinedAt: string;
  lastSeenAt: string;
};

export type LiveQuestion = {
  id: string;
  text: string;
  timeLimitSeconds: number;
  orderIndex: number;
};

export type LiveAnswer = {
  id: string;
  questionId: string;
  playerId: string;
  teamId: string;
  rawText: string;
  normalizedText: string;
  submittedAt: string;
  updatedAt: string;
  revisionCount: number;
};

/**
 * 司会者が行った手動統合。autoグループ（正規化キー）をまとめる。
 * children は統合時点のスナップショット。
 */
export type LiveAnswerGroup = {
  id: string;
  questionId: string;
  teamId: string;
  label: string;
  reason: string;
  childKeys: string[];
  children: Array<{ text: string; count: number }>;
  createdBy: string;
  createdAt: string;
};

export type LiveScoreStatus = "scored" | "not_scored";

export type LiveScore = {
  questionId: string;
  teamId: string;
  answerCount: number;
  maxGroupSize: number;
  rate: number | null;
  points: number | null;
  status: LiveScoreStatus;
  perfect: boolean;
  createdAt: string;
};

export type LiveLog = {
  id: string;
  action: string;
  actor: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type LiveRoom = {
  code: string;
  title: string;
  screenToken: string;
  phase: LivePhase;
  currentQuestionIndex: number;
  phaseEndsAt: string | null;
  finalCheckSeconds: number;
  startedAt: string | null;
  finishedAt: string | null;
  /** 最終順位の抽選用。チームID -> 0..1 */
  lottery: Record<string, number>;
  updatedAt: string;
};

export type GameState = {
  schemaVersion: 1;
  version: number;
  room: LiveRoom;
  teams: LiveTeam[];
  players: LivePlayer[];
  questions: LiveQuestion[];
  answers: LiveAnswer[];
  groups: LiveAnswerGroup[];
  scores: LiveScore[];
  logs: LiveLog[];
  questionsFrozen: boolean;
};

export type AutoAnswerGroup = {
  key: string;
  text: string;
  count: number;
  answers: LiveAnswer[];
};

export type VisibleAnswerGroup = {
  id: string;
  key: string;
  text: string;
  count: number;
  reason?: string;
  mergedFrom?: string;
  children?: Array<{ text: string; count: number }>;
};

export type TeamStatusView = {
  id: string;
  name: string;
  color: string;
  answered: number;
  memberCount: number;
  capacity: number;
};

export type RevealTeamView = {
  id: string;
  name: string;
  color: string;
  answerCount: number;
  participantCount: number;
  groups: VisibleAnswerGroup[];
};

export type RevealView = {
  questionNumber: number;
  totalQuestions: number;
  questionText: string;
  teams: RevealTeamView[];
};

export type TeamResultView = {
  id: string;
  name: string;
  color: string;
  answerCount: number;
  participantCount: number;
  topAnswerCount: number;
  rate: number | null;
  points: number | null;
  totalPoints: number;
  perfectCount: number;
  lastQuestionPoints: number;
  groups: VisibleAnswerGroup[];
};

export type RankingEntryView = {
  teamId: string;
  name: string;
  color: string;
  totalPoints: number;
  perfectCount: number;
  lastQuestionPoints: number;
  rank: number;
};

export type ScoreboardView = {
  questionNumber: number;
  totalQuestions: number;
  questionText: string;
  teams: TeamResultView[];
  ranking: RankingEntryView[];
};

export type FinalView = {
  totalQuestions: number;
  teams: RankingEntryView[];
};

export type ParticipantView = {
  phase: LivePhase;
  room: {
    code: string;
    title: string;
    phase: LivePhase;
    playerCount: number;
    questionCount: number;
    finalCheckSeconds: number;
  };
  me: {
    id: string;
    name: string;
    teamId: string;
    teamName: string;
    teamColor: string;
    status: PlayerStatus;
  };
  question: {
    index: number;
    number: number;
    total: number;
    text: string;
    timeLimitSeconds: number;
    deadlineAt: string | null;
  } | null;
  ownAnswer: {
    text: string;
    submittedAt: string;
    updatedAt: string;
  } | null;
  counts: {
    teamAnswered: number;
    teamMembers: number;
    totalAnswered: number;
    totalParticipants: number;
  };
  teams: TeamStatusView[];
  reveal: RevealView | null;
  scoreboard: ScoreboardView | null;
  currentResult: ScoreboardView | null;
  final: FinalView | null;
  serverNow: string;
};

export type HostTeamView = TeamStatusView & {
  memberCount: number;
  players: Array<{ id: string; name: string; status: PlayerStatus }>;
  groups: VisibleAnswerGroup[];
};

export type HostView = {
  phase: LivePhase;
  room: {
    code: string;
    title: string;
    screenToken: string;
    phase: LivePhase;
    currentQuestionIndex: number;
    totalQuestions: number;
    phaseEndsAt: string | null;
    finalCheckSeconds: number;
    frozen: boolean;
    playerCount: number;
  };
  me: ParticipantView["me"] | null;
  ownAnswer: ParticipantView["ownAnswer"];
  question: ParticipantView["question"];
  counts: ParticipantView["counts"];
  teams: HostTeamView[];
  questions: LiveQuestion[];
  reveal: RevealView | null;
  scoreboard: ScoreboardView | null;
  currentResult: ScoreboardView | null;
  final: FinalView | null;
  serverNow: string;
};

export type StageView = {
  phase: LivePhase;
  roomCode: string;
  title: string;
  joinUrl: string | null;
  question: ParticipantView["question"];
  counts: {
    totalAnswered: number;
    totalParticipants: number;
    teams: TeamStatusView[];
  };
  reveal: RevealView | null;
  scoreboard: ScoreboardView | null;
  final: FinalView | null;
  serverNow: string;
};

export type PublicRoomView = {
  code: string;
  title: string;
  phase: LivePhase;
  teams: Array<{
    id: string;
    name: string;
    color: string;
    capacity: number;
    memberCount: number;
    isFull: boolean;
  }>;
  playerCount: number;
  questionCount: number;
};
