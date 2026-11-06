export const ROOM_PHASES = [
  "WAITING",
  "READY",
  "ANSWERING",
  "ANSWER_CLOSED",
  "FINAL_CHECK",
  "REVEAL",
  "GROUPING",
  "SCORED",
  "FINISHED",
] as const;

export type RoomPhase = (typeof ROOM_PHASES)[number];

export const PLAYER_STATUSES = ["active", "sleeping", "left"] as const;

export type PlayerStatus = (typeof PLAYER_STATUSES)[number];

export const SCORE_STATUSES = ["scored", "not_scored"] as const;

export type ScoreStatus = (typeof SCORE_STATUSES)[number];
