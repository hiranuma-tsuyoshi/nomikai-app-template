import { countCharacters } from "./format";

export const QUESTION_TEXT_MAX = 100;
export const QUESTION_TIME_MIN = 10;
export const QUESTION_TIME_MAX = 600;
export const QUESTION_TIME_DEFAULT = 60;
export const QUESTIONS_STORAGE_KEY = "nomikai.questions.v1";

export type Question = {
  id: string;
  text: string;
  timeLimitSeconds: number;
};

export type QuestionDraft = {
  text: string;
  timeLimitSeconds: number;
};

/**
 * 初期表示とプレビューで使うお題。
 * H-05/H-06のモック（第3問: 朝ごはん、第4問: 飲み会で最初に頼むもの）と揃えている。
 */
export const seedQuestions: Question[] = [
  {
    id: "question-1",
    text: "休日の過ごし方といえば？",
    timeLimitSeconds: 60,
  },
  {
    id: "question-2",
    text: "好きな季節といえば？",
    timeLimitSeconds: 60,
  },
  {
    id: "question-3",
    text: "朝ごはんといえば？",
    timeLimitSeconds: 60,
  },
  {
    id: "question-4",
    text: "飲み会で最初に頼むものといえば？",
    timeLimitSeconds: 60,
  },
  {
    id: "question-5",
    text: "仕事の後に欲しいものといえば？",
    timeLimitSeconds: 60,
  },
  {
    id: "question-6",
    text: "旅行で行きたい場所といえば？",
    timeLimitSeconds: 90,
  },
  {
    id: "question-7",
    text: "最近ハマっていることといえば？",
    timeLimitSeconds: 60,
  },
  {
    id: "question-8",
    text: "この飲み会を一言で表すと？",
    timeLimitSeconds: 90,
  },
];

export function isQuestionTextValid(value: string): boolean {
  const length = countCharacters(value);

  return value.trim().length > 0 && length <= QUESTION_TEXT_MAX;
}

export function parseQuestionTimeLimit(value: string | number): number | null {
  const parsed = typeof value === "number" ? value : Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < QUESTION_TIME_MIN ||
    parsed > QUESTION_TIME_MAX
  ) {
    return null;
  }

  return parsed;
}

/**
 * localStorageから読んだ値を検証する。
 * 空配列は「お題をすべて削除した状態」として有効。不正な値はnull。
 */
export function parseQuestions(value: unknown): Question[] | null {
  if (!Array.isArray(value)) return null;

  const ids = new Set<string>();
  const questions: Question[] = [];

  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return null;

    const { id, text, timeLimitSeconds } = entry as Record<string, unknown>;

    if (typeof id !== "string" || id.trim().length === 0 || ids.has(id)) {
      return null;
    }
    if (typeof text !== "string" || !isQuestionTextValid(text)) return null;
    if (
      typeof timeLimitSeconds !== "number" ||
      parseQuestionTimeLimit(timeLimitSeconds) === null
    ) {
      return null;
    }

    ids.add(id);
    questions.push({ id, text, timeLimitSeconds });
  }

  return questions;
}

export function loadQuestions(): Question[] | null {
  try {
    const raw = window.localStorage.getItem(QUESTIONS_STORAGE_KEY);
    if (raw === null) return null;

    return parseQuestions(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveQuestions(questions: Question[]): boolean {
  try {
    window.localStorage.setItem(QUESTIONS_STORAGE_KEY, JSON.stringify(questions));
    return true;
  } catch {
    return false;
  }
}

export function formatQuestionTotal(questions: Question[]): string {
  const totalSeconds = questions.reduce(
    (sum, question) => sum + question.timeLimitSeconds,
    0,
  );
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) return `${seconds}秒`;
  if (seconds === 0) return `${minutes}分`;

  return `${minutes}分${seconds}秒`;
}
