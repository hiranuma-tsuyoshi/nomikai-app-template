export type FinalCheckQuestion = {
  roomCode: string;
  teamName: string;
  teamColor: string;
  playerName: string;
  questionNumber: number;
  totalQuestions: number;
  questionText: string;
  finalCheckSeconds: number;
  initialRemainingSeconds: number;
  maxAnswerLength: number;
  submittedAnswer: string | null;
};

/**
 * P-06 の表示確認用データ。
 * 実データ接続時はAPIのレスポンスを同じ形に変換して渡す。
 */
export const p06Mock: FinalCheckQuestion = {
  roomCode: "4821",
  teamName: "チームA",
  teamColor: "#58cc02",
  playerName: "ひらぬま",
  questionNumber: 3,
  totalQuestions: 8,
  questionText: "朝ごはんといえば？",
  finalCheckSeconds: 30,
  initialRemainingSeconds: 24,
  maxAnswerLength: 20,
  submittedAnswer: "カレー",
};
