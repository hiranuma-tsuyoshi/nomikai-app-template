"use client";

import { useState, type FormEvent } from "react";
import type { AnswerScreenQuestion } from "@/lib/demo/p04";
import type { FinalCheckQuestion } from "@/lib/demo/p06";
import type { ResultData, ResultTeam } from "@/lib/demo/p07";
import {
  AnswerScreen,
  type AnswerScreenLiveProps,
} from "@/components/game/answer-screen";
import {
  FinalCheckScreen,
  type FinalCheckLiveProps,
} from "@/components/game/final-check-screen";
import { ResultScreen } from "@/components/game/result-screen";
import { postJson, usePollingJson } from "@/lib/client/use-live-data";
import type { ParticipantView, PublicRoomView } from "@/lib/live/types";

type StateResponse = { view: ParticipantView };

function secondsUntil(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
}

function answerScreenData(view: ParticipantView): AnswerScreenQuestion {
  const question = view.question!;
  return {
    roomCode: view.room.code,
    teamName: view.me.teamName,
    teamColor: view.me.teamColor,
    playerName: view.me.name,
    questionNumber: question.number,
    totalQuestions: question.total,
    questionText: question.text,
    timeLimitSeconds: question.timeLimitSeconds,
    initialRemainingSeconds: secondsUntil(question.deadlineAt),
    answerCount: view.counts.totalAnswered,
    participantCount: view.counts.totalParticipants,
    maxAnswerLength: 20,
  };
}

function finalCheckData(view: ParticipantView): FinalCheckQuestion {
  const question = view.question!;
  return {
    roomCode: view.room.code,
    teamName: view.me.teamName,
    teamColor: view.me.teamColor,
    playerName: view.me.name,
    questionNumber: question.number,
    totalQuestions: question.total,
    questionText: question.text,
    finalCheckSeconds: view.room.finalCheckSeconds,
    initialRemainingSeconds: secondsUntil(question.deadlineAt),
    maxAnswerLength: 20,
    submittedAnswer: view.ownAnswer?.text ?? null,
  };
}

function resultData(view: ParticipantView): ResultData {
  const current = view.currentResult!;
  const order = new Map(
    current.ranking.map((entry) => [entry.teamId, entry.rank] as const),
  );
  const teams: ResultTeam[] = current.teams
    .map((team) => ({
      ...team,
      groups: team.groups,
      rank: order.get(team.id) ?? 0,
    }))
    .sort((a, b) => a.rank - b.rank || b.totalPoints - a.totalPoints)
    .map((team, index) => ({ ...team, rank: team.rank || index + 1 }));

  return {
    roomCode: view.room.code,
    playerName: view.me.name,
    ownTeamId: view.me.teamId,
    ownAnswer: view.ownAnswer?.text ?? null,
    questionNumber: current.questionNumber,
    totalQuestions: current.totalQuestions,
    questionText: current.questionText,
    teams,
  };
}

export function ParticipantApp({ initialCode }: { initialCode?: string }) {
  const { data, error, loading, refresh } =
    usePollingJson<StateResponse>("/api/state", { intervalMs: 1200 });

  if (data?.view) {
    return (
      <div className="h-dvh bg-meadow-mist">
        {error ? (
          <div
            role="status"
            className="fixed inset-x-0 top-0 z-50 bg-tangerine px-4 py-2 text-center text-xs font-extrabold text-night-ink"
          >
            通信が不安定です。自動で再接続します。
          </div>
        ) : null}
        <ParticipantScreen view={data.view} refresh={refresh} />
      </div>
    );
  }

  if (error?.code === "NEEDS_JOIN") {
    return (
      <JoinScreen
        room={error.room as PublicRoomView | undefined}
        initialCode={initialCode}
        onJoined={refresh}
      />
    );
  }

  if (loading) {
    return (
      <div className="grid h-dvh place-items-center bg-meadow-mist px-6">
        <div className="text-center">
          <span
            aria-hidden="true"
            className="mx-auto block size-10 animate-spin rounded-full border-4 border-line-soft border-t-eager-green"
          />
          <p className="mt-4 text-sm font-bold text-pencil-gray">
            ゲームに接続しています…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-dvh place-items-center bg-meadow-mist px-6">
      <div className="w-full max-w-[390px] rounded-xl border-2 border-line-soft bg-paper-white p-6 text-center">
        <p className="text-lg font-extrabold text-charcoal">
          接続できませんでした
        </p>
        <p className="mt-2 text-sm leading-6 text-pencil-gray">
          会場のWi-Fiを確認して、もう一度お試しください。
        </p>
        <button
          type="button"
          onClick={refresh}
          className="btn btn-primary mt-5 w-full"
        >
          再試行
        </button>
      </div>
    </div>
  );
}

function ParticipantScreen({
  view,
  refresh,
}: {
  view: ParticipantView;
  refresh: () => void;
}) {
  if (view.phase === "ANSWERING" && view.question) {
    const live: AnswerScreenLiveProps = {
      initialAnswer: view.ownAnswer?.text ?? null,
      deadlineAt: view.question.deadlineAt,
      onSubmit: async (text) => {
        await postJson<StateResponse>("/api/answers", { text });
        refresh();
      },
    };
    return (
      <AnswerScreen
        key={`answer-${view.question.index}`}
        data={answerScreenData(view)}
        live={live}
      />
    );
  }

  if (view.phase === "FINAL_CHECK" && view.question) {
    const live: FinalCheckLiveProps = {
      deadlineAt: view.question.deadlineAt,
      onSave: async (text) => {
        await postJson<StateResponse>("/api/answers", { text });
        refresh();
      },
    };
    return (
      <FinalCheckScreen
        key={`final-${view.question.index}`}
        data={finalCheckData(view)}
        live={live}
      />
    );
  }

  if (view.phase === "SCORED" && view.currentResult) {
    return <ResultScreen key={`result-${view.question?.index}`} data={resultData(view)} />;
  }

  if (view.phase === "FINISHED" && view.final) {
    return <FinalParticipantScreen view={view} />;
  }

  if (view.phase === "REVEAL" || view.phase === "GROUPING") {
    return <RevealParticipantScreen view={view} />;
  }

  return <WaitingScreen view={view} />;
}

function PageShell({
  children,
  view,
}: {
  children: React.ReactNode;
  view: ParticipantView;
}) {
  return (
    <div className="mx-auto flex h-full w-full max-w-[480px] flex-col bg-paper-white">
      <header className="shrink-0 border-b-2 border-line-soft px-5 pb-3 pt-[calc(12px+env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-eager-green text-lg font-extrabold text-night-ink"
            >
              以
            </span>
            <div className="min-w-0">
              <p className="font-numeric text-[10px] font-extrabold uppercase tracking-[0.18em] text-pencil-gray">
                Room {view.room.code}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm font-extrabold text-charcoal">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ backgroundColor: view.me.teamColor }}
                />
                <span className="truncate">{view.me.teamName}</span>
                <span className="truncate text-caption font-medium text-pencil-gray">
                  / {view.me.name}
                </span>
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-lg bg-[#f2f2f2] px-2.5 py-1 font-numeric text-[11px] font-extrabold text-pencil-gray">
            {view.room.playerCount}人
          </span>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-5">
        {children}
      </main>
    </div>
  );
}

function WaitingScreen({ view }: { view: ParticipantView }) {
  return (
    <PageShell view={view}>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <span className="grid size-16 place-items-center rounded-2xl bg-storybook-green text-3xl">
          🎉
        </span>
        <h1 className="mt-5 font-rounded text-[26px] font-extrabold leading-tight text-charcoal">
          参加登録ができました
        </h1>
        <p className="mt-2 text-sm leading-6 text-pencil-gray">
          {view.phase === "WAITING" || view.phase === "READY"
            ? "ゲーム開始までお待ちください。開始すると自動でお題が表示されます。"
            : "次のお題が始まるまでお待ちください。途中参加も反映されます。"}
        </p>

        <div className="mt-6 w-full rounded-xl border-2 border-line-soft bg-[#fafafa] p-4 text-left">
          <p className="text-caption font-bold text-pencil-gray">ルームコード</p>
          <p className="mt-1 font-numeric text-4xl font-extrabold tracking-[0.18em] text-charcoal">
            {view.room.code}
          </p>
          <p className="mt-3 text-caption font-bold text-pencil-gray">
            あなたのチーム
          </p>
          <p className="mt-1 flex items-center gap-2 text-lg font-extrabold text-charcoal">
            <span
              aria-hidden="true"
              className="size-3 rounded-full"
              style={{ backgroundColor: view.me.teamColor }}
            />
            {view.me.teamName}
          </p>
        </div>

        <div className="mt-5 w-full">
          <p className="text-left text-caption font-extrabold text-pencil-gray">
            チームの参加状況
          </p>
          <ul className="mt-2 grid gap-1.5">
            {view.teams.map((team) => (
              <li
                key={team.id}
                className={`flex items-center justify-between rounded-lg border-2 px-3 py-2 ${
                  team.id === view.me.teamId
                    ? "border-eager-green bg-storybook-green/40"
                    : "border-line-soft bg-paper-white"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: team.color }}
                  />
                  <span className="truncate text-sm font-extrabold text-charcoal">
                    {team.name}
                  </span>
                </span>
                <span className="font-numeric text-xs font-extrabold text-pencil-gray">
                  {team.memberCount}人
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </PageShell>
  );
}

function RevealParticipantScreen({ view }: { view: ParticipantView }) {
  return (
    <PageShell view={view}>
      <div className="text-center">
        <span className="inline-flex rounded-full bg-[#e6f7ff] px-3 py-1 text-xs font-extrabold text-spark-blue-ink">
          回答公開
        </span>
        <h1 className="mt-3 font-rounded text-[25px] font-extrabold leading-tight text-charcoal">
          {view.question?.text ?? "回答が公開されました"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-pencil-gray">
          他チームの回答が見られます。司会者の統合が終わるまでお待ちください。
        </p>
      </div>

      <div className="mt-5 rounded-xl border-2 border-[#b8e986] bg-[#f7ffe9] p-4">
        <p className="text-caption font-bold text-eager-green-ink">
          あなたの回答
        </p>
        <p className="mt-1 break-words text-2xl font-extrabold text-charcoal">
          「{view.ownAnswer?.text ?? "未回答"}」
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {view.reveal?.teams.map((team) => (
          <section
            key={team.id}
            className="overflow-hidden rounded-xl border-2 border-line-soft bg-paper-white"
          >
            <div className="flex items-center justify-between gap-3 border-b-2 border-line-soft px-3 py-2">
              <span className="flex items-center gap-2 text-sm font-extrabold text-charcoal">
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: team.color }}
                />
                {team.name}
              </span>
              <span className="font-numeric text-[11px] font-bold text-pencil-gray">
                {team.answerCount} / {team.participantCount}人
              </span>
            </div>
            <ul className="divide-y-2 divide-line-soft">
              {team.groups.map((group) => (
                <li
                  key={group.id}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-bold text-charcoal">
                      {group.text}
                    </span>
                    {group.mergedFrom ? (
                      <span className="mt-0.5 block text-[10px] font-bold text-[#6b3bb5]">
                        {group.mergedFrom}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 rounded bg-[#f2f2f2] px-2 py-0.5 font-numeric text-xs font-extrabold text-charcoal">
                    ×{group.count}
                  </span>
                </li>
              ))}
              {team.groups.length === 0 ? (
                <li className="px-3 py-3 text-xs font-bold text-pencil-gray">
                  回答なし
                </li>
              ) : null}
            </ul>
          </section>
        ))}
      </div>
    </PageShell>
  );
}

function FinalParticipantScreen({ view }: { view: ParticipantView }) {
  const final = view.final!;
  const own = final.teams.find((team) => team.teamId === view.me.teamId);
  const winner = final.teams[0];

  return (
    <PageShell view={view}>
      <div className="text-center">
        <span className="inline-flex rounded-full bg-sun-yellow px-3 py-1 text-xs font-extrabold text-night-ink">
          ゲーム終了
        </span>
        <h1 className="mt-3 font-rounded text-[30px] font-extrabold leading-tight text-charcoal">
          最終結果
        </h1>
        {winner ? (
          <div className="mt-4 rounded-xl border-2 border-sun-yellow bg-[#fffbe5] p-4">
            <p className="text-caption font-extrabold text-[#9a7600]">優勝</p>
            <p className="mt-1 flex items-center justify-center gap-2 text-2xl font-extrabold text-charcoal">
              <span
                aria-hidden="true"
                className="size-3 rounded-full"
                style={{ backgroundColor: winner.color }}
              />
              {winner.name}
            </p>
            <p className="mt-1 font-numeric text-xl font-extrabold text-charcoal">
              {winner.totalPoints} pt
            </p>
          </div>
        ) : null}
      </div>

      {own ? (
        <div className="mt-4 rounded-xl border-2 border-line-soft bg-paper-white p-4 text-center">
          <p className="text-caption font-bold text-pencil-gray">あなたのチーム</p>
          <p className="mt-1 text-lg font-extrabold text-charcoal">
            {own.name} ・ {own.rank}位
          </p>
          <p className="mt-0.5 font-numeric text-sm font-bold text-pencil-gray">
            {own.totalPoints} pt / 全員一致 {own.perfectCount}回
          </p>
        </div>
      ) : null}

      <ol className="mt-5 space-y-2">
        {final.teams.map((team) => (
          <li
            key={team.teamId}
            className={`flex items-center justify-between gap-3 rounded-xl border-2 px-3 py-2.5 ${
              team.teamId === view.me.teamId
                ? "border-eager-green bg-storybook-green/40"
                : "border-line-soft bg-paper-white"
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="w-6 shrink-0 font-numeric text-sm font-extrabold text-pencil-gray">
                {team.rank}
              </span>
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: team.color }}
              />
              <span className="truncate text-sm font-extrabold text-charcoal">
                {team.name}
              </span>
            </span>
            <span className="shrink-0 font-numeric text-lg font-extrabold text-charcoal">
              {team.totalPoints}
              <span className="ml-0.5 text-[11px] font-bold text-pencil-gray">
                pt
              </span>
            </span>
          </li>
        ))}
      </ol>
    </PageShell>
  );
}

function JoinScreen({
  room,
  initialCode,
  onJoined,
}: {
  room?: PublicRoomView;
  initialCode?: string;
  onJoined: () => void;
}) {
  const [code, setCode] = useState(room?.code ?? initialCode ?? "4821");
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState(
    room?.teams.find((team) => !team.isFull)?.id ?? room?.teams[0]?.id ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedTeam = room?.teams.find((team) => team.id === teamId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (!name.trim()) {
      setError("名前を入力してください");
      return;
    }
    if (!teamId) {
      setError("チームを選んでください");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await postJson("/api/join", { code: code.trim(), name: name.trim(), teamId });
      onJoined();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "参加できませんでした。もう一度お試しください。",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-meadow-mist px-5 py-6">
      <div className="mx-auto w-full max-w-[390px]">
        <div className="text-center">
          <span
            aria-hidden="true"
            className="mx-auto grid size-14 place-items-center rounded-2xl bg-eager-green text-2xl font-extrabold text-night-ink"
          >
            以
          </span>
          <h1 className="mt-4 font-rounded text-[28px] font-extrabold leading-tight text-charcoal">
            以心伝心ゲーム
          </h1>
          <p className="mt-2 text-sm leading-6 text-pencil-gray">
            お題に答えて、チームの答えがどれだけ揃うかを競います。
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-2xl border-2 border-line-soft bg-paper-white p-5"
        >
          <label htmlFor="room-code" className="text-sm font-extrabold text-charcoal">
            ルームコード
          </label>
          <input
            id="room-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            className="input mt-1.5 text-center font-numeric text-2xl font-extrabold tracking-[0.2em]"
          />

          <label htmlFor="player-name" className="mt-4 block text-sm font-extrabold text-charcoal">
            名前
          </label>
          <input
            id="player-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例: ひらぬま"
            maxLength={20}
            autoComplete="name"
            className="input mt-1.5"
          />

          <fieldset className="mt-4">
            <legend className="text-sm font-extrabold text-charcoal">
              チーム
            </legend>
            <div className="mt-1.5 grid gap-2">
              {(room?.teams ?? []).map((team) => {
                const isSelected = team.id === teamId;
                return (
                  <label
                    key={team.id}
                    className={`flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border-2 px-3 ${
                      isSelected
                        ? "border-eager-green bg-storybook-green/50"
                        : "border-line-soft bg-paper-white"
                    } ${team.isFull ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="team"
                        value={team.id}
                        checked={isSelected}
                        disabled={team.isFull}
                        onChange={() => setTeamId(team.id)}
                        className="size-4 accent-[#58cc02]"
                      />
                      <span
                        aria-hidden="true"
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: team.color }}
                      />
                      <span className="text-sm font-extrabold text-charcoal">
                        {team.name}
                      </span>
                    </span>
                    <span className="font-numeric text-[11px] font-bold text-pencil-gray">
                      {team.memberCount} / {team.capacity}人
                      {team.isFull ? " 満員" : ""}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {error ? (
            <p role="alert" className="mt-3 text-xs font-bold leading-5 text-alert-red-ink">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting || !selectedTeam || selectedTeam.isFull}
            className="btn btn-primary mt-5 w-full text-base disabled:bg-[#e5e5e5] disabled:text-faded-gray"
          >
            {submitting ? "参加しています…" : "参加する"}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] leading-5 text-pencil-gray">
          参加後は、この画面を開いたままにしてください。
        </p>
      </div>
    </div>
  );
}
