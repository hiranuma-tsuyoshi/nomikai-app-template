export type StageFinalTeam = {
  id: string;
  name: string;
  color: string;
  totalPoints: number;
  perfectCount: number;
  lastQuestionPoints: number;
};

export type StageFinalData = {
  roomCode: string;
  totalQuestions: number;
  teams: StageFinalTeam[];
};

export type StageFinalPreviewState =
  | "final"
  | "final_two_teams"
  | "final_six_teams";

const finalTeams: StageFinalTeam[] = [
  {
    id: "team-b",
    name: "チームB",
    color: "#1cb0f6",
    totalPoints: 72,
    perfectCount: 5,
    lastQuestionPoints: 10,
  },
  {
    id: "team-a",
    name: "チームA",
    color: "#58cc02",
    totalPoints: 68,
    perfectCount: 4,
    lastQuestionPoints: 8,
  },
  {
    id: "team-d",
    name: "チームD",
    color: "#ff9600",
    totalPoints: 61,
    perfectCount: 3,
    lastQuestionPoints: 7,
  },
  {
    id: "team-e",
    name: "チームE",
    color: "#ff4b4b",
    totalPoints: 54,
    perfectCount: 2,
    lastQuestionPoints: 6,
  },
  {
    id: "team-c",
    name: "チームC",
    color: "#ce82ff",
    totalPoints: 47,
    perfectCount: 1,
    lastQuestionPoints: 5,
  },
  {
    id: "team-f",
    name: "チームF",
    color: "#ffc800",
    totalPoints: 43,
    perfectCount: 0,
    lastQuestionPoints: 4,
  },
];

function withTeams(teams: StageFinalTeam[]): StageFinalData {
  return {
    roomCode: "4821",
    totalQuestions: 8,
    teams,
  };
}

export const stageFinalMocks: Record<
  StageFinalPreviewState,
  StageFinalData
> = {
  final: withTeams(finalTeams.slice(0, 5)),
  final_two_teams: withTeams(finalTeams.slice(0, 2)),
  final_six_teams: withTeams(finalTeams),
};
