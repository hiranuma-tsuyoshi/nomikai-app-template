import { describe, expect, it } from "vitest";
import {
  formatQuestionTotal,
  isQuestionTextValid,
  parseQuestionTimeLimit,
  parseQuestions,
  seedQuestions,
} from "./questions";

describe("isQuestionTextValid", () => {
  it("accepts 1 to 100 characters", () => {
    expect(isQuestionTextValid("朝ごはんといえば？")).toBe(true);
    expect(isQuestionTextValid("あ".repeat(100))).toBe(true);
  });

  it("rejects empty, whitespace-only, and over 100 characters", () => {
    expect(isQuestionTextValid("")).toBe(false);
    expect(isQuestionTextValid("   ")).toBe(false);
    expect(isQuestionTextValid("あ".repeat(101))).toBe(false);
  });
});

describe("parseQuestionTimeLimit", () => {
  it("accepts integers from 10 to 600", () => {
    expect(parseQuestionTimeLimit("10")).toBe(10);
    expect(parseQuestionTimeLimit("60")).toBe(60);
    expect(parseQuestionTimeLimit(600)).toBe(600);
  });

  it("rejects out-of-range, decimal, and empty values", () => {
    expect(parseQuestionTimeLimit("9")).toBeNull();
    expect(parseQuestionTimeLimit("601")).toBeNull();
    expect(parseQuestionTimeLimit("60.5")).toBeNull();
    expect(parseQuestionTimeLimit("")).toBeNull();
  });
});

describe("parseQuestions", () => {
  it("accepts a valid list and an empty list", () => {
    expect(parseQuestions(seedQuestions)).toEqual(seedQuestions);
    expect(parseQuestions([])).toEqual([]);
  });

  it("rejects malformed entries and duplicate ids", () => {
    expect(parseQuestions(null)).toBeNull();
    expect(parseQuestions([{ ...seedQuestions[0], text: "" }])).toBeNull();
    expect(
      parseQuestions([
        { ...seedQuestions[0], timeLimitSeconds: 601 },
      ]),
    ).toBeNull();
    expect(
      parseQuestions([seedQuestions[0], { ...seedQuestions[1], id: "question-1" }]),
    ).toBeNull();
  });
});

describe("formatQuestionTotal", () => {
  it("formats seconds and minutes", () => {
    expect(formatQuestionTotal([])).toBe("0秒");
    expect(formatQuestionTotal([{ id: "a", text: "a", timeLimitSeconds: 45 }])).toBe(
      "45秒",
    );
    expect(
      formatQuestionTotal([{ id: "a", text: "a", timeLimitSeconds: 600 }]),
    ).toBe("10分");
    expect(
      formatQuestionTotal([{ id: "a", text: "a", timeLimitSeconds: 90 }]),
    ).toBe("1分30秒");
  });
});
