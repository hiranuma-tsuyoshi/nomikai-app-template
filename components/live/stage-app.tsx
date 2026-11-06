"use client";

import { useEffect, useState } from "react";
import { StageFinal } from "@/components/stage/stage-final";
import { StageReveal } from "@/components/stage/stage-reveal";
import { StageScoreboard } from "@/components/stage/stage-scoreboard";
import type { StageRevealData } from "@/lib/demo/s03";
import type { StageResultData } from "@/lib/demo/stage";
import type { StageFinalData } from "@/lib/demo/s05";
import { formatTime } from "@/lib/format";
import { usePollingJson } from "@/lib/client/use-live-data";
import type { StageView } from "@/lib/live/types";

type StageResponse = { view: StageView };

function useCountdown(deadlineAt: string | null): number {
  const [remaining, setRemaining] = useState(() =>
    deadlineAt
      ? Math.max(0, Math.ceil((new Date(deadlineAt).getTime() - Date.now()) / 1000))
      : 0,
  );

  useEffect(() => {
    if (!deadlineAt) {
      setRemaining(0);
      return;
    }
    const update = () =>
      setRemaining(
        Math.max(
          0,
          Math.ceil((new Date(deadlineAt).getTime() - Date.now()) / 1000),
        ),
      );
    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [deadlineAt]);

  return remaining;
}

export function StageApp({ token }: { token?: string }) {
  const url = token
    ? `/api/stage?token=${encodeURIComponent(token)}`
    : "/api/stage";
  const { data, error, loading, refresh } =
    usePollingJson<StageResponse>(url, { intervalMs: 1000 });

  if (!data?.view) {
    return (
      <div className="stage grid h-dvh place-items-center px-8">
        {loading ? (
          <div className="text-center">
            <span
              aria-hidden="true"
              className="mx-auto block size-12 animate-spin rounded-full border-4 border-white/15 border-t-stage-yellow"
            />
            <p className="mt-5 font-rounded text-xl font-bold text-stage-muted">
              スクリーンを接続しています…
            </p>
          </div>
        ) : (
          <div className="max-w-[560px] text-center">
            <p className="font-rounded text-3xl font-extrabold">
              スクリーンに接続できません
            </p>
            <p className="mt-3 text-lg text-stage-muted">
              {error?.error ?? "会場Wi-FiとURLを確認してください。"}
            </p>
            <button
              type="button"
              onClick={refresh}
              className="mt-6 rounded-xl bg-stage-yellow px-6 py-3 text-lg font-extrabold text-stage-bg"
            >
              再試行
            </button>
          </div>
        )}
      </div>
    );
  }

  const view = data.view;
  return (
    <div className="relative h-dvh overflow-hidden bg-stage-bg">
      <StageScreen view={view} />
      {error ? (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-stage-pink px-5 py-2 text-sm font-extrabold text-white">
          再接続中…
        </div>
      ) : null}
    </div>
  );
}

function StageScreen({ view }: { view: StageView }) {
  const remaining = useCountdown(view.question?.deadlineAt ?? null);

  if (view.phase === "WAITING" || view.phase === "READY") {
    return <StageWaiting view={view} />;
  }

  if (view.phase === "ANSWERING" || view.phase === "FINAL_CHECK") {
    return <StageQuestion view={view} remaining={remaining} />;
  }

  if ((view.phase === "REVEAL" || view.phase === "GROUPING") && view.reveal) {
    const data: StageRevealData = {
      roomCode: view.roomCode,
      questionNumber: view.reveal.questionNumber,
      totalQuestions: view.reveal.totalQuestions,
      questionText: view.reveal.questionText,
      teams: view.reveal.teams.map((team) => ({
        id: team.id,
        name: team.name,
        color: team.color,
        answerCount: team.answerCount,
        participantCount: team.participantCount,
        groups: team.groups.map((group) => ({
          text: group.text,
          count: group.count,
          mergedFrom: group.mergedFrom,
        })),
      })),
    };
    return <StageReveal data={data} />;
  }

  if (view.phase === "SCORED" && view.scoreboard) {
    const data: StageResultData = {
      roomCode: view.roomCode,
      questionNumber: view.scoreboard.questionNumber,
      totalQuestions: view.scoreboard.totalQuestions,
      questionText: view.scoreboard.questionText,
      teams: view.scoreboard.teams,
      ranking: view.scoreboard.ranking,
    };
    return <StageScoreboard data={data} />;
  }

  if (view.phase === "FINISHED" && view.final) {
    const data: StageFinalData = {
      roomCode: view.roomCode,
      totalQuestions: view.final.totalQuestions,
      teams: view.final.teams.map((team) => ({
        id: team.teamId,
        name: team.name,
        color: team.color,
        totalPoints: team.totalPoints,
        perfectCount: team.perfectCount,
        lastQuestionPoints: team.lastQuestionPoints,
      })),
    };
    return <StageFinal data={data} />;
  }

  return <StageWaiting view={view} />;
}

function StageWaiting({ view }: { view: StageView }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const joinUrl = view.joinUrl ?? (origin ? `${origin}/play` : "");

  return (
    <div className="stage relative flex h-full flex-col overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-[10vw] -top-[24vh] size-[48vw] rounded-full border-[clamp(24px,3vw,56px)] border-white/[0.025]" />
        <div className="absolute -right-[6vw] top-[8vh] h-[34vh] w-[24vw] rotate-12 border-[3px] border-white/[0.04]" />
        <div className="absolute bottom-[-20vh] left-[36vw] size-[36vw] rounded-full bg-stage-cyan/[0.035]" />
      </div>

      <div className="relative z-10 flex h-full min-h-0 flex-col px-[4vw] py-[3.2vh]">
        <header className="flex shrink-0 items-start justify-between gap-[3vw]">
          <div>
            <div className="flex items-center gap-[0.9vw]">
              <span className="rounded-full bg-stage-pink px-[clamp(10px,0.9vw,18px)] py-[clamp(4px,0.55vh,8px)] font-numeric text-[clamp(13px,0.95vw,17px)] font-extrabold uppercase tracking-[0.16em] text-white">
                参加受付中
              </span>
              <span className="font-numeric text-[clamp(13px,0.95vw,17px)] font-bold tracking-[0.14em] text-stage-muted">
                ルーム {view.roomCode}
              </span>
            </div>
            <h1 className="mt-[clamp(8px,1.2vh,18px)] font-rounded text-[clamp(42px,4.6vw,88px)] font-extrabold leading-[1.02] tracking-[-0.02em]">
              以心伝心<span className="text-stage-yellow">ゲーム</span>
            </h1>
            <p className="mt-[clamp(4px,0.8vh,12px)] text-[clamp(20px,1.8vw,34px)] font-bold text-stage-muted">
              お題に答えて、チームの答えを揃えよう
            </p>
          </div>
          <div className="text-right">
            <p className="text-[clamp(14px,1vw,19px)] font-bold uppercase tracking-[0.16em] text-stage-muted">
              参加者
            </p>
            <p className="font-numeric text-[clamp(56px,7vw,130px)] font-extrabold leading-none text-stage-yellow">
              {view.counts.totalParticipants}
              <span className="ml-[0.08em] text-[0.32em] text-stage-fg">人</span>
            </p>
          </div>
        </header>

        <main className="mt-[3vh] grid min-h-0 flex-1 gap-[3vw] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <section className="flex flex-col items-center justify-center rounded-[clamp(18px,1.6vw,32px)] border-[3px] border-white/15 bg-white p-[clamp(16px,1.4vw,28px)] text-stage-bg">
            <p className="font-numeric text-[clamp(20px,1.6vw,32px)] font-extrabold tracking-[0.22em]">
              {view.roomCode}
            </p>
            {joinUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/qr?text=${encodeURIComponent(joinUrl)}`}
                alt="参加用QRコード"
                className="mt-[clamp(10px,1.2vh,18px)] aspect-square w-[min(30vh,26vw)]"
              />
            ) : null}
            <p className="mt-[clamp(10px,1.2vh,18px)] text-center font-rounded text-[clamp(16px,1.2vw,24px)] font-extrabold leading-tight">
              QRを読み取って参加
            </p>
            <p className="mt-1 text-center text-[clamp(12px,0.9vw,17px)] font-bold text-[#777777]">
              {joinUrl}
            </p>
          </section>

          <section className="min-h-0 rounded-[clamp(18px,1.6vw,32px)] border-[3px] border-white/10 bg-stage-surface p-[clamp(16px,1.4vw,28px)]">
            <h2 className="font-rounded text-[clamp(24px,2vw,38px)] font-extrabold">
              チームの参加状況
            </h2>
            <ul className="mt-[clamp(10px,1.4vh,20px)] grid gap-[clamp(8px,1vh,14px)]">
              {view.counts.teams.map((team) => (
                <li
                  key={team.id}
                  className="flex items-center justify-between gap-[1vw] rounded-[clamp(10px,0.9vw,18px)] bg-white/[0.06] px-[clamp(12px,1vw,20px)] py-[clamp(8px,1vh,14px)]"
                >
                  <span className="flex min-w-0 items-center gap-[0.8vw]">
                    <span
                      aria-hidden="true"
                      className="size-[clamp(12px,1.05vw,20px)] rounded-full"
                      style={{ backgroundColor: team.color }}
                    />
                    <span className="truncate font-rounded text-[clamp(20px,1.7vw,32px)] font-extrabold">
                      {team.name}
                    </span>
                  </span>
                  <span className="shrink-0 font-numeric text-[clamp(24px,2vw,38px)] font-extrabold">
                    {team.memberCount}
                    <span className="ml-1 text-[0.45em] font-bold text-stage-muted">人</span>
                  </span>
                </li>
              ))}
            </ul>
            {view.counts.totalParticipants === 0 ? (
              <p className="mt-[2vh] text-center text-[clamp(14px,1vw,19px)] font-bold text-stage-muted">
                参加者が集まるまでお待ちください
              </p>
            ) : null}
          </section>
        </main>
      </div>
    </div>
  );
}

function StageQuestion({
  view,
  remaining,
}: {
  view: StageView;
  remaining: number;
}) {
  const isFinal = view.phase === "FINAL_CHECK";
  const total = Math.max(1, view.counts.totalParticipants);
  const answeredPercent = Math.min(
    100,
    Math.round((view.counts.totalAnswered / total) * 100),
  );

  return (
    <div className="stage relative flex h-full flex-col overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-[10vw] -top-[24vh] size-[48vw] rounded-full border-[clamp(24px,3vw,56px)] border-white/[0.025]" />
        <div className="absolute -right-[6vw] top-[8vh] h-[34vh] w-[24vw] rotate-12 border-[3px] border-white/[0.04]" />
        <div className="absolute bottom-[-20vh] left-[36vw] size-[36vw] rounded-full bg-stage-cyan/[0.035]" />
      </div>
      <div className="relative z-10 flex h-full min-h-0 flex-col px-[4vw] py-[3.2vh]">
        <header className="flex shrink-0 items-start justify-between gap-[3vw]">
          <div className="min-w-0">
            <div className="flex items-center gap-[0.9vw]">
              <span
                className={`rounded-full px-[clamp(10px,0.9vw,18px)] py-[clamp(4px,0.55vh,8px)] font-numeric text-[clamp(13px,0.95vw,17px)] font-extrabold uppercase tracking-[0.14em] ${
                  isFinal ? "bg-stage-yellow text-stage-bg" : "bg-stage-green text-stage-bg"
                }`}
              >
                {isFinal ? "最終確認" : "回答受付中"}
              </span>
              <span className="font-numeric text-[clamp(13px,0.95vw,17px)] font-bold tracking-[0.14em] text-stage-muted">
                ルーム {view.roomCode}
              </span>
            </div>
            <p className="mt-[clamp(8px,1.2vh,18px)] font-numeric text-[clamp(20px,1.7vw,32px)] font-bold text-stage-muted">
              第{view.question?.number}問 / 全{view.question?.total}問
            </p>
          </div>
          <div
            role="timer"
            className={`shrink-0 rounded-[clamp(14px,1.2vw,24px)] border-[3px] px-[clamp(16px,1.6vw,30px)] py-[clamp(8px,1vh,16px)] text-right ${
              remaining <= 10
                ? "border-stage-pink bg-stage-pink/15"
                : "border-white/15 bg-stage-surface"
            }`}
          >
            <p className="text-[clamp(12px,0.9vw,17px)] font-extrabold tracking-[0.14em] text-stage-muted">
              {isFinal ? "公開まで" : "残り時間"}
            </p>
            <p className="font-numeric text-[clamp(48px,6vw,110px)] font-extrabold leading-none tabular-nums">
              {formatTime(remaining)}
            </p>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col justify-center py-[2vh]">
          <h1 className="max-w-[92vw] text-balance font-rounded text-[clamp(40px,4.8vw,92px)] font-extrabold leading-[1.12] tracking-[-0.02em]">
            {view.question?.text}
          </h1>

          <div className="mt-[3vh] grid gap-[1.4vw] sm:grid-cols-2 xl:grid-cols-3">
            {view.counts.teams.map((team) => (
              <div
                key={team.id}
                className="rounded-[clamp(12px,1vw,20px)] border-[3px] border-white/10 bg-stage-surface p-[clamp(12px,1vw,20px)]"
              >
                <div className="flex items-center justify-between gap-[0.8vw]">
                  <span className="flex min-w-0 items-center gap-[0.7vw]">
                    <span
                      aria-hidden="true"
                      className="size-[clamp(10px,0.9vw,17px)] rounded-full"
                      style={{ backgroundColor: team.color }}
                    />
                    <span className="truncate font-rounded text-[clamp(18px,1.5vw,28px)] font-extrabold">
                      {team.name}
                    </span>
                  </span>
                  <span className="shrink-0 font-numeric text-[clamp(20px,1.7vw,32px)] font-extrabold">
                    {team.answered}
                    <span className="ml-0.5 text-[0.5em] font-bold text-stage-muted">
                      / {team.memberCount}人
                    </span>
                  </span>
                </div>
                <div className="mt-[clamp(6px,0.8vh,12px)] h-[clamp(8px,1vh,14px)] overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          (team.answered / Math.max(1, team.memberCount)) * 100,
                        ),
                      )}%`,
                      backgroundColor: team.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </main>

        <footer className="flex shrink-0 items-center justify-between gap-[2vw]">
          <p className="text-[clamp(14px,1.05vw,20px)] font-bold text-stage-muted">
            {isFinal
              ? "公開前の最終確認中です。回答内容はまだ表示されません。"
              : "回答は締切まで何度でも修正できます。"}
          </p>
          <p className="font-numeric text-[clamp(16px,1.2vw,23px)] font-extrabold text-stage-yellow">
            回答 {view.counts.totalAnswered} / {view.counts.totalParticipants}人
            <span className="ml-[0.6vw] text-stage-muted">({answeredPercent}%)</span>
          </p>
        </footer>
      </div>
    </div>
  );
}
