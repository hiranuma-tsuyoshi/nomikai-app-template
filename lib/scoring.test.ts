import { describe, expect, it } from "vitest";
import { normalizeAnswer } from "./normalize";
import { calcScore, formatRate } from "./scoring";

describe("calcScore", () => {
  it.each([
    [6, 6, 10],
    [6, 5, 8],
    [6, 4, 7],
    [6, 3, 5],
    [6, 2, 3],
    [6, 0, 0],
    [5, 5, 10],
    [5, 4, 8],
    [5, 3, 6],
    [5, 2, 4],
    [4, 4, 10],
    [4, 3, 8],
    [4, 2, 5],
  ])(
    "answerCount=%i, maxGroup=%i -> %i points",
    (answerCount, maxGroupSize, expected) => {
      const result = calcScore(answerCount, maxGroupSize);
      expect(result.status).toBe("scored");
      if (result.status === "scored") {
        expect(result.points).toBe(expected);
      }
    },
  );

  it("returns not_scored when fewer than 4 answers", () => {
    expect(calcScore(3, 3)).toEqual({
      status: "not_scored",
      rate: null,
      points: null,
    });
    expect(calcScore(0, 0)).toEqual({
      status: "not_scored",
      rate: null,
      points: null,
    });
  });

  it("clamps maxGroupSize to answerCount", () => {
    expect(calcScore(4, 6)).toEqual({
      status: "scored",
      rate: 1,
      points: 10,
    });
  });

  it("throws on invalid input", () => {
    expect(() => calcScore(-1, 0)).toThrow();
    expect(() => calcScore(4.5, 4)).toThrow();
  });
});

describe("formatRate", () => {
  it("formats a rate as a rounded percentage", () => {
    expect(formatRate(5 / 6)).toBe("83%");
    expect(formatRate(1)).toBe("100%");
    expect(formatRate(0)).toBe("0%");
  });
});

describe("normalizeAnswer", () => {
  it("normalizes width, whitespace, katakana, case, and trailing punctuation", () => {
    expect(normalizeAnswer("  ＣＵＲＲＹ  ")).toBe("curry");
    expect(normalizeAnswer("カレー")).toBe("かれー");
    expect(normalizeAnswer("カレー！")).toBe("かれー");
    expect(normalizeAnswer("カレー ライス")).toBe("かれーらいす");
  });

  it("keeps the long vowel mark", () => {
    expect(normalizeAnswer("ラーメン")).toBe("らーめん");
  });
});
