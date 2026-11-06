export type HostPhase = "answering" | "final_check" | "reveal" | "scored";

export type HostAnswerGroup = {
  text: string;
  count: number;
  mergedNote?: string;
};

export type HostTeam = {
  id: string;
  name: string;
  color: string;
  answered: number;
  memberCount: number;
  baselinePoints: number;
  groups: HostAnswerGroup[];
};

export type HostConsoleData = {
  roomCode: string;
  hostName: string;
  hostTeamId: string;
  questionNumber: number;
  totalQuestions: number;
  questionText: string;
  nextQuestionText: string;
  timeLimitSeconds: number;
  initialRemainingSeconds: number;
  finalCheckSeconds: number;
  finalCheckInitialSeconds: number;
  maxAnswerLength: number;
  mySubmittedAnswer: string | null;
  teams: HostTeam[];
};

const answeringTeams: HostTeam[] = [
  {
    id: "team-a",
    name: "チームA",
    color: "#58cc02",
    answered: 5,
    memberCount: 6,
    baselinePoints: 21,
    groups: [
      { text: "カレー", count: 4 },
      { text: "ごはん", count: 1 },
    ],
  },
  {
    id: "team-b",
    name: "チームB",
    color: "#1cb0f6",
    answered: 5,
    memberCount: 6,
    baselinePoints: 23,
    groups: [
      { text: "カレー", count: 4 },
      { text: "味噌汁", count: 1, mergedNote: "「みそ汁」を統合" },
    ],
  },
  {
    id: "team-c",
    name: "チームC",
    color: "#ce82ff",
    answered: 5,
    memberCount: 6,
    baselinePoints: 12,
    groups: [
      { text: "ごはん", count: 4 },
      { text: "パン", count: 1 },
    ],
  },
  {
    id: "team-d",
    name: "チームD",
    color: "#ff9600",
    answered: 3,
    memberCount: 6,
    baselinePoints: 18,
    groups: [
      { text: "トースト", count: 2 },
      { text: "シリアル", count: 1 },
    ],
  },
  {
    id: "team-e",
    name: "チームE",
    color: "#ff4b4b",
    answered: 4,
    memberCount: 6,
    baselinePoints: 15,
    groups: [
      { text: "うどん", count: 3 },
      { text: "カレー", count: 1 },
    ],
  },
];

const closedTeams: HostTeam[] = answeringTeams.map((team) =>
  team.id === "team-a"
    ? {
        ...team,
        answered: 6,
        groups: [
          { text: "カレー", count: 5 },
          { text: "ごはん", count: 1 },
        ],
      }
    : { ...team, groups: team.groups.map((group) => ({ ...group })) },
);

const common = {
  roomCode: "4821",
  hostName: "山田",
  hostTeamId: "team-a",
  questionNumber: 3,
  totalQuestions: 8,
  questionText: "朝ごはんといえば？",
  nextQuestionText: "飲み会で最初に頼むものといえば？",
  timeLimitSeconds: 60,
  initialRemainingSeconds: 42,
  finalCheckSeconds: 30,
  finalCheckInitialSeconds: 24,
  maxAnswerLength: 20,
};

function cloneTeams(teams: HostTeam[]): HostTeam[] {
  return teams.map((team) => ({
    ...team,
    groups: team.groups.map((group) => ({ ...group })),
  }));
}

export const hostMocks: Record<HostPhase, HostConsoleData> = {
  answering: {
    ...common,
    mySubmittedAnswer: null,
    teams: cloneTeams(answeringTeams),
  },
  final_check: {
    ...common,
    mySubmittedAnswer: "カレー",
    teams: cloneTeams(closedTeams),
  },
  reveal: {
    ...common,
    mySubmittedAnswer: "カレー",
    teams: cloneTeams(closedTeams),
  },
  scored: {
    ...common,
    mySubmittedAnswer: "カレー",
    teams: cloneTeams(closedTeams),
  },
};
