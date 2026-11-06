import { describe, expect, it } from "vitest";
import { countCharacters, formatTime, isValidAnswer } from "./format";

describe("formatTime", () => {
  it("formats seconds as mm:ss", () => {
    expect(formatTime(47)).toBe("00:47");
    expect(formatTime(60)).toBe("01:00");
    expect(formatTime(3599)).toBe("59:59");
  });

  it("clamps invalid and negative values", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(-5)).toBe("00:00");
    expect(formatTime(4.9)).toBe("00:04");
  });
});

describe("countCharacters", () => {
  it("counts Japanese characters", () => {
    expect(countCharacters("カレー")).toBe(3);
    expect(countCharacters("")).toBe(0);
  });

  it("counts an emoji as one character", () => {
    expect(countCharacters("🍛")).toBe(1);
    expect(countCharacters("カレー🍛")).toBe(4);
  });
});

describe("isValidAnswer", () => {
  it("accepts a non-empty answer within the limit", () => {
    expect(isValidAnswer("カレー")).toBe(true);
    expect(isValidAnswer("  カレー  ")).toBe(true);
  });

  it("rejects empty and whitespace-only answers", () => {
    expect(isValidAnswer("")).toBe(false);
    expect(isValidAnswer("   ")).toBe(false);
  });

  it("rejects answers over the limit", () => {
    expect(isValidAnswer("あ".repeat(20))).toBe(true);
    expect(isValidAnswer("あ".repeat(21))).toBe(false);
  });
});
