export type StageAnswerGroup = {
  text: string;
  count: number;
  mergedFrom?: string;
};

export type StageAnswerTeam = {
  id: string;
  name: string;
  color: string;
  answerCount: number;
  participantCount: number;
  groups: StageAnswerGroup[];
};

export type StageRevealData = {
  roomCode: string;
  questionNumber: number;
  totalQuestions: number;
  questionText: string;
  teams: StageAnswerTeam[];
};

export type StageRevealPreviewState =
  | "reveal"
  | "reveal_two_teams"
  | "reveal_six_teams";

const baseTeams: StageAnswerTeam[] = [
  {
    id: "team-a",
    name: "チームA",
    color: "#58cc02",
    answerCount: 6,
    participantCount: 6,
    groups: [
      { text: "カレー", count: 5 },
      { text: "ごはん", count: 1 },
    ],
  },
  {
    id: "team-b",
    name: "チームB",
    color: "#1cb0f6",
    answerCount: 6,
    participantCount: 6,
    groups: [{ text: "カレー", count: 6, mergedFrom: "カレーライス統合" }],
  },
  {
    id: "team-c",
    name: "チームC",
    color: "#ce82ff",
    answerCount: 6,
    participantCount: 6,
    groups: [
      { text: "ごはん", count: 3 },
      { text: "パン", count: 2 },
      { text: "うどん", count: 1 },
    ],
  },
  {
    id: "team-d",
    name: "チームD",
    color: "#ff9600",
    answerCount: 6,
    participantCount: 6,
    groups: [
      { text: "カレー", count: 4 },
      { text: "シリアル", count: 2 },
    ],
  },
  {
    id: "team-e",
    name: "チームE",
    color: "#ff4b4b",
    answerCount: 5,
    participantCount: 6,
    groups: [
      { text: "トースト", count: 3 },
      { text: "ごはん", count: 2 },
    ],
  },
];

const sixTeams: StageAnswerTeam[] = [
  ...baseTeams,
  {
    id: "team-f",
    name: "チームF",
    color: "#ffc800",
    answerCount: 6,
    participantCount: 6,
    groups: [
      { text: "パン", count: 4 },
      { text: "ごはん", count: 2 },
    ],
  },
];

const common = {
  roomCode: "4821",
  questionNumber: 3,
  totalQuestions: 8,
  questionText: "朝ごはんといえば？",
};

function cloneTeams(teams: StageAnswerTeam[]): StageAnswerTeam[] {
  return teams.map((team) => ({
    ...team,
    groups: team.groups.map((group) => ({ ...group })),
  }));
}

export const stageRevealMocks: Record<
  StageRevealPreviewState,
  StageRevealData
> = {
  reveal: {
    ...common,
    teams: cloneTeams(baseTeams),
  },
  reveal_two_teams: {
    ...common,
    teams: cloneTeams(baseTeams.slice(0, 2)),
  },
  reveal_six_teams: {
    ...common,
    teams: cloneTeams(sixTeams),
  },
};
