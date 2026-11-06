import {
  answersForQuestion,
  buildFinal,
  buildRanking,
  buildReveal,
  buildScoreboard,
  getCurrentQuestion,
  getQuestionNumber,
  isQuestionPhase,
  isRevealed,
  teamMembers,
  teamStatuses,
} from "./engine";
import type {
  GameState,
  HostView,
  ParticipantView,
  PublicRoomView,
  StageView,
} from "./types";

export function buildPublicRoomView(state: GameState): PublicRoomView {
  return {
    code: state.room.code,
    title: state.room.title,
    phase: state.room.phase,
    teams: [...state.teams]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((team) => {
        const memberCount = teamMembers(state, team.id).length;
        return {
          id: team.id,
          name: team.name,
          color: team.color,
          capacity: team.capacity,
          memberCount,
          isFull: memberCount >= team.capacity,
        };
      }),
    playerCount: state.players.filter((player) => player.status !== "left").length,
    questionCount: state.questions.length,
  };
}

function currentQuestionView(
  state: GameState,
): ParticipantView["question"] {
  const question = getCurrentQuestion(state);
  if (!question || !isQuestionPhase(state.room.phase)) return null;

  return {
    index: state.room.currentQuestionIndex,
    number: getQuestionNumber(state),
    total: state.questions.length,
    text: question.text,
    timeLimitSeconds: question.timeLimitSeconds,
    deadlineAt: state.room.phaseEndsAt,
  };
}

function countsView(state: GameState, questionId: string | null) {
  const teams = teamStatuses(state, questionId);
  return {
    teams,
    totalAnswered: questionId
      ? answersForQuestion(state, questionId).length
      : 0,
    totalParticipants: state.players.filter((player) => player.status !== "left")
      .length,
  };
}

export function buildParticipantView(
  state: GameState,
  playerId: string,
): ParticipantView {
  const player =
    state.players.find((entry) => entry.id === playerId) ?? null;
  if (!player) {
    throw new Error("PLAYER_NOT_FOUND");
  }
  const team =
    state.teams.find((entry) => entry.id === player.teamId) ?? state.teams[0];
  const question = getCurrentQuestion(state);
  const questionId = question?.id ?? null;
  const counts = countsView(state, questionId);
  const ownAnswer =
    question && isQuestionPhase(state.room.phase)
      ? state.answers.find(
          (answer) =>
            answer.questionId === question.id && answer.playerId === player.id,
        ) ?? null
      : null;
  const reveal = isRevealed(state.room.phase) ? buildReveal(state) : null;
  const scored = state.room.phase === "SCORED" || state.room.phase === "FINISHED";

  return {
    phase: state.room.phase,
    room: {
      code: state.room.code,
      title: state.room.title,
      phase: state.room.phase,
      playerCount: state.players.filter((entry) => entry.status !== "left")
        .length,
      questionCount: state.questions.length,
      finalCheckSeconds: state.room.finalCheckSeconds,
    },
    me: {
      id: player.id,
      name: player.name,
      teamId: team.id,
      teamName: team.name,
      teamColor: team.color,
      status: player.status,
    },
    question: question ? currentQuestionView(state) : null,
    ownAnswer: ownAnswer
      ? {
          text: ownAnswer.rawText,
          submittedAt: ownAnswer.submittedAt,
          updatedAt: ownAnswer.updatedAt,
        }
      : null,
    counts: {
      teamAnswered:
        counts.teams.find((entry) => entry.id === team.id)?.answered ?? 0,
      teamMembers:
        counts.teams.find((entry) => entry.id === team.id)?.memberCount ?? 0,
      totalAnswered: counts.totalAnswered,
      totalParticipants: counts.totalParticipants,
    },
    teams: counts.teams,
    reveal,
    scoreboard: scored ? buildScoreboard(state) : null,
    currentResult: scored ? buildScoreboard(state) : null,
    final: state.room.phase === "FINISHED" ? buildFinal(state) : null,
    serverNow: new Date().toISOString(),
  };
}

export function buildHostView(
  state: GameState,
  playerId: string | null,
): HostView {
  const question = getCurrentQuestion(state);
  const questionId = question?.id ?? null;
  const counts = countsView(state, questionId);
  const participant = playerId
    ? buildParticipantView(state, playerId)
    : null;
  const me = participant?.me ?? null;
  const reveal = isRevealed(state.room.phase) ? buildReveal(state) : null;
  const scored = state.room.phase === "SCORED" || state.room.phase === "FINISHED";

  return {
    phase: state.room.phase,
    room: {
      code: state.room.code,
      title: state.room.title,
      screenToken: state.room.screenToken,
      phase: state.room.phase,
      currentQuestionIndex: state.room.currentQuestionIndex,
      totalQuestions: state.questions.length,
      phaseEndsAt: state.room.phaseEndsAt,
      finalCheckSeconds: state.room.finalCheckSeconds,
      frozen: state.questionsFrozen,
      playerCount: state.players.filter((entry) => entry.status !== "left")
        .length,
    },
    me,
    ownAnswer: participant?.ownAnswer ?? null,
    question: currentQuestionView(state),
    counts: {
      teamAnswered: me
        ? counts.teams.find((entry) => entry.id === me.teamId)?.answered ?? 0
        : 0,
      teamMembers: me
        ? counts.teams.find((entry) => entry.id === me.teamId)?.memberCount ?? 0
        : 0,
      totalAnswered: counts.totalAnswered,
      totalParticipants: counts.totalParticipants,
    },
    teams: counts.teams.map((team) => ({
      ...team,
      memberCount: team.memberCount,
      players: state.players
        .filter((player) => player.teamId === team.id)
        .map((player) => ({
          id: player.id,
          name: player.name,
          status: player.status,
        })),
      groups:
        reveal?.teams.find((entry) => entry.id === team.id)?.groups ?? [],
    })),
    questions: [...state.questions].sort((a, b) => a.orderIndex - b.orderIndex),
    reveal,
    scoreboard: scored ? buildScoreboard(state) : null,
    currentResult: scored ? buildScoreboard(state) : null,
    final: state.room.phase === "FINISHED" ? buildFinal(state) : null,
    serverNow: new Date().toISOString(),
  };
}

export function buildStageView(
  state: GameState,
  joinUrl: string | null,
): StageView {
  const question = getCurrentQuestion(state);
  const questionId = question?.id ?? null;
  const counts = countsView(state, questionId);
  const scored = state.room.phase === "SCORED" || state.room.phase === "FINISHED";

  return {
    phase: state.room.phase,
    roomCode: state.room.code,
    title: state.room.title,
    joinUrl,
    question: currentQuestionView(state),
    counts: {
      totalAnswered: counts.totalAnswered,
      totalParticipants: counts.totalParticipants,
      teams: counts.teams,
    },
    reveal: isRevealed(state.room.phase) ? buildReveal(state) : null,
    scoreboard: scored ? buildScoreboard(state) : null,
    final: state.room.phase === "FINISHED" ? buildFinal(state) : null,
    serverNow: new Date().toISOString(),
  };
}

export function buildRankingOnly(state: GameState) {
  return buildRanking(state, false);
}
