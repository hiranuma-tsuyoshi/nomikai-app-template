export const MIN_ANSWER_COUNT = 4;
export const MAX_POINTS = 10;

export type ScoreResult =
  | { status: "scored"; rate: number; points: number }
  | { status: "not_scored"; rate: null; points: null };

/**
 * 一致率方式の得点計算。
 * 回答者4人未満は採点対象外（0点とは区別する）。
 */
export function calcScore(
  answerCount: number,
  maxGroupSize: number,
): ScoreResult {
  if (!Number.isInteger(answerCount) || !Number.isInteger(maxGroupSize)) {
    throw new Error("answerCount and maxGroupSize must be integers");
  }
  if (answerCount < 0 || maxGroupSize < 0) {
    throw new Error("answerCount and maxGroupSize must be non-negative");
  }
  if (answerCount < MIN_ANSWER_COUNT) {
    return { status: "not_scored", rate: null, points: null };
  }

  const safeMax = Math.min(maxGroupSize, answerCount);
  const rate = safeMax / answerCount;

  return {
    status: "scored",
    rate,
    points: Math.round(rate * MAX_POINTS),
  };
}

export function formatRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
