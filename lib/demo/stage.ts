import { calcScore } from "@/lib/scoring";

export type StageTeamResult = {
  id: string;
  name: string;
  color: string;
  answerCount: number;
  participantCount: number;
  topAnswerCount: number;
  rate: number | null;
  points: number | null;
  totalPoints: number;
};

export type StageRankingEntry = {
  teamId: string;
  name: string;
  color: string;
  totalPoints: number;
};

export type StageResultData = {
  roomCode: string;
  questionNumber: number;
  totalQuestions: number;
  questionText: string;
  teams: StageTeamResult[];
  ranking: StageRankingEntry[];
};

export type StageScorePreviewState = "scored" | "excluded" | "two_teams";

type TeamInput = {
  id: string;
  name: string;
  color: string;
  answerCount: number;
  participantCount: number;
  topAnswerCount: number;
  totalPoints: number;
};

function toTeam(input: TeamInput): StageTeamResult {
  const score = calcScore(input.answerCount, input.topAnswerCount);

  return {
    ...input,
    rate: score.status === "scored" ? score.rate : null,
    points: score.status === "scored" ? score.points : null,
  };
}

function toRanking(teams: StageTeamResult[]): StageRankingEntry[] {
  return [...teams]
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((team) => ({
      teamId: team.id,
      name: team.name,
      color: team.color,
      totalPoints: team.totalPoints,
    }));
}

const baseTeams: TeamInput[] = [
  {
    id: "team-a",
    name: "チームA",
    color: "#58cc02",
    answerCount: 6,
    participantCount: 6,
    topAnswerCount: 5,
    totalPoints: 21,
  },
  {
    id: "team-b",
    name: "チームB",
    color: "#1cb0f6",
    answerCount: 6,
    participantCount: 6,
    topAnswerCount: 6,
    totalPoints: 23,
  },
  {
    id: "team-c",
    name: "チームC",
    color: "#ce82ff",
    answerCount: 6,
    participantCount: 6,
    topAnswerCount: 3,
    totalPoints: 12,
  },
  {
    id: "team-d",
    name: "チームD",
    color: "#ff9600",
    answerCount: 6,
    participantCount: 6,
    topAnswerCount: 4,
    totalPoints: 18,
  },
  {
    id: "team-e",
    name: "チームE",
    color: "#ff4b4b",
    answerCount: 5,
    participantCount: 6,
    topAnswerCount: 3,
    totalPoints: 15,
  },
];

const scoredTeams = baseTeams.map(toTeam);

const excludedTeams = baseTeams.map((team) =>
  team.id === "team-c"
    ? toTeam({
        ...team,
        answerCount: 3,
        topAnswerCount: 2,
      })
    : toTeam(team),
);

const twoTeams = scoredTeams.filter((team) =>
  ["team-a", "team-b"].includes(team.id),
);

export const stageMocks: Record<StageScorePreviewState, StageResultData> = {
  scored: {
    roomCode: "4821",
    questionNumber: 3,
    totalQuestions: 8,
    questionText: "朝ごはんといえば？",
    teams: scoredTeams,
    ranking: toRanking(scoredTeams),
  },
  excluded: {
    roomCode: "4821",
    questionNumber: 3,
    totalQuestions: 8,
    questionText: "朝ごはんといえば？",
    teams: excludedTeams,
    ranking: toRanking(excludedTeams),
  },
  two_teams: {
    roomCode: "4821",
    questionNumber: 3,
    totalQuestions: 8,
    questionText: "朝ごはんといえば？",
    teams: twoTeams,
    ranking: toRanking(twoTeams),
  },
};
