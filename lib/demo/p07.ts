import type {
  StageAnswerGroup,
  StageAnswerTeam,
} from "@/lib/demo/s03";
import { stageRevealMocks } from "@/lib/demo/s03";
import {
  stageMocks,
  type StageTeamResult,
} from "@/lib/demo/stage";

export type ResultTeam = StageTeamResult & {
  groups: StageAnswerGroup[];
  rank: number;
};

export type ResultData = {
  roomCode: string;
  playerName: string;
  ownTeamId: string;
  ownAnswer: string | null;
  questionNumber: number;
  totalQuestions: number;
  questionText: string;
  teams: ResultTeam[];
};

export type ResultPreviewState =
  | "result"
  | "result_perfect"
  | "result_excluded"
  | "result_unanswered";

function withGroups(
  score: StageTeamResult,
  answers: StageAnswerTeam,
): ResultTeam {
  return {
    ...score,
    groups: answers.groups.map((group) => ({ ...group })),
    rank: 0,
  };
}

function buildTeams(
  scores: StageTeamResult[],
  answers: StageAnswerTeam[],
): ResultTeam[] {
  const teams = scores.map((score) => {
    const answer = answers.find((team) => team.id === score.id);
    if (!answer) {
      throw new Error(`Missing answers for ${score.id}`);
    }
    return withGroups(score, answer);
  });

  const sorted = [...teams].sort((a, b) => b.totalPoints - a.totalPoints);
  let previousPoints: number | null = null;
  let previousRank = 0;

  return sorted.map((team, index) => {
    const rank =
      team.totalPoints === previousPoints ? previousRank : index + 1;
    previousPoints = team.totalPoints;
    previousRank = rank;
    return { ...team, rank };
  });
}

const scoredAnswers = stageRevealMocks.reveal.teams;

const excludedAnswers = scoredAnswers.map((team) =>
  team.id === "team-c"
    ? {
        ...team,
        answerCount: 3,
        groups: [
          { text: "ごはん", count: 2 },
          { text: "パン", count: 1 },
        ],
      }
    : team,
);

const common = {
  roomCode: "4821",
  playerName: "ひらぬま",
  questionNumber: 3,
  totalQuestions: 8,
  questionText: "朝ごはんといえば？",
};

/**
 * P-07 の表示確認用データ。
 * 実データ接続時はAPIのレスポンスを同じ形に変換して渡す。
 */
export const p07Mocks: Record<ResultPreviewState, ResultData> = {
  result: {
    ...common,
    ownTeamId: "team-a",
    ownAnswer: "カレー",
    teams: buildTeams(stageMocks.scored.teams, scoredAnswers),
  },
  result_perfect: {
    ...common,
    ownTeamId: "team-b",
    ownAnswer: "カレー",
    teams: buildTeams(stageMocks.scored.teams, scoredAnswers),
  },
  result_excluded: {
    ...common,
    ownTeamId: "team-c",
    ownAnswer: "ごはん",
    teams: buildTeams(stageMocks.excluded.teams, excludedAnswers),
  },
  result_unanswered: {
    ...common,
    ownTeamId: "team-a",
    ownAnswer: null,
    teams: buildTeams(stageMocks.scored.teams, scoredAnswers),
  },
};
