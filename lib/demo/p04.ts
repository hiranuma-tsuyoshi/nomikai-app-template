export type AnswerScreenQuestion = {
  roomCode: string;
  teamName: string;
  teamColor: string;
  playerName: string;
  questionNumber: number;
  totalQuestions: number;
  questionText: string;
  timeLimitSeconds: number;
  initialRemainingSeconds: number;
  answerCount: number;
  participantCount: number;
  maxAnswerLength: number;
};

/**
 * P-04 の表示確認用データ。
 * 実データ接続時はAPIのレスポンスを同じ形に変換して渡す。
 */
export const p04Mock: AnswerScreenQuestion = {
  roomCode: "4821",
  teamName: "チームA",
  teamColor: "#58cc02",
  playerName: "ひらぬま",
  questionNumber: 3,
  totalQuestions: 8,
  questionText: "朝ごはんといえば？",
  timeLimitSeconds: 60,
  initialRemainingSeconds: 47,
  answerCount: 18,
  participantCount: 30,
  maxAnswerLength: 20,
};
