"use client";

import type { StageResultData, StageTeamResult } from "@/lib/demo/stage";
import { formatRate } from "@/lib/scoring";
import { AnimatedScore, ConsistencyBar } from "./animated-score";

type StageScoreboardProps = {
  data: StageResultData;
};

function getGridLayout(teamCount: number) {
  if (teamCount <= 1) return { columns: 1, spans: [1] };
  if (teamCount === 2) return { columns: 2, spans: [1, 1] };
  if (teamCount === 3) return { columns: 3, spans: [1, 1, 1] };
  if (teamCount === 4) return { columns: 2, spans: [1, 1, 1, 1] };
  if (teamCount === 5) {
    return { columns: 6, spans: [2, 2, 2, 3, 3] };
  }
  if (teamCount === 6) {
    return { columns: 3, spans: [1, 1, 1, 1, 1, 1] };
  }

  const columns = Math.min(6, Math.max(4, Math.ceil(teamCount / 2)));
  return { columns, spans: Array.from({ length: teamCount }, () => 1) };
}

function getRankingColumns(teamCount: number) {
  if (teamCount <= 1) return "minmax(0, 1fr)";

  return Array.from({ length: teamCount }, (_, index) => {
    if (index === 0) return "1.2fr";
    return "1fr";
  }).join(" ");
}

function TeamResultCard({
  team,
  index,
  dense,
}: {
  team: StageTeamResult;
  index: number;
  dense: boolean;
}) {
  const isPerfect = team.rate === 1;
  const isExcluded = team.rate === null;
  const delay = 140 + index * 80;

  return (
    <article
      aria-labelledby={`stage-team-${team.id}`}
      className={`animate-stage-rise relative flex w-full min-h-0 flex-col overflow-hidden rounded-[clamp(16px,1.4vw,28px)] border-[3px] p-[clamp(12px,1.1vw,24px)] ${
        isPerfect
          ? "border-stage-yellow bg-stage-yellow text-stage-bg"
          : isExcluded
            ? "border-white/10 bg-[#241052] text-stage-fg"
            : "border-white/10 bg-stage-surface text-stage-fg"
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {!isPerfect ? (
        <span
          aria-hidden="true"
          className={`absolute inset-x-0 top-0 h-[clamp(5px,0.6vh,9px)] ${
            isExcluded ? "opacity-45" : ""
          }`}
          style={{ backgroundColor: team.color }}
        />
      ) : null}

      <div className="flex items-center justify-between gap-[1vw]">
        <div className="flex min-w-0 items-center gap-[0.8vw]">
          <span
            aria-hidden="true"
            className="size-[clamp(12px,1.05vw,20px)] shrink-0 rounded-full"
            style={{ backgroundColor: team.color }}
          />
          <h2
            id={`stage-team-${team.id}`}
            className={`truncate font-rounded font-extrabold leading-none ${
              dense
                ? "text-[clamp(18px,1.5vw,30px)]"
                : "text-[clamp(22px,2vw,38px)]"
            }`}
          >
            {team.name}
          </h2>
          <span
            className={`shrink-0 font-numeric text-[clamp(15px,1.05vw,20px)] font-bold leading-none ${
              isPerfect ? "text-stage-bg" : "text-stage-muted"
            }`}
          >
            回答 {team.answerCount} / {team.participantCount}人
          </span>
        </div>

        {isPerfect ? (
          <span className="animate-stage-pop shrink-0 rounded-full bg-stage-bg px-[clamp(8px,0.7vw,14px)] py-[clamp(3px,0.5vh,7px)] text-[clamp(14px,1vw,19px)] font-extrabold tracking-[0.06em] text-stage-yellow">
            全員一致
          </span>
        ) : isExcluded ? (
          <span className="shrink-0 rounded-full bg-stage-pink px-[clamp(8px,0.7vw,14px)] py-[clamp(3px,0.5vh,7px)] text-[clamp(14px,1vw,19px)] font-extrabold tracking-[0.06em] text-white">
            採点対象外
          </span>
        ) : null}
      </div>

      <div className="mt-auto flex items-end justify-between gap-[1vw] pt-[clamp(4px,0.8vh,10px)]">
        <div>
          <p
            className={`text-[clamp(14px,1vw,19px)] font-bold tracking-[0.08em] ${
              isPerfect ? "text-stage-bg" : "text-stage-muted"
            }`}
          >
            一致率
          </p>
          <p
            className={`mt-[clamp(2px,0.4vh,6px)] font-numeric font-extrabold leading-none tabular-nums ${
              dense
                ? "text-[clamp(30px,3vw,54px)]"
                : "text-[clamp(40px,5.5vh,74px)]"
            } ${isPerfect ? "text-stage-bg" : isExcluded ? "text-stage-muted" : "text-stage-fg"}`}
          >
            {team.rate === null ? "—" : formatRate(team.rate)}
          </p>
        </div>

        <div className="text-right">
          <p
            className={`text-[clamp(14px,1vw,19px)] font-bold tracking-[0.08em] ${
              isPerfect ? "text-stage-bg" : "text-stage-muted"
            }`}
          >
            獲得
          </p>
          <p
            className={`mt-[clamp(2px,0.4vh,6px)] font-numeric font-extrabold leading-none tabular-nums ${
              dense
                ? "text-[clamp(46px,4.8vw,88px)]"
                : "text-[clamp(60px,8.8vh,118px)]"
            } ${
              isPerfect
                ? "text-stage-bg"
                : isExcluded
                  ? "text-stage-muted"
                  : "text-stage-green"
            }`}
          >
            {team.points === null ? (
              "—"
            ) : (
              <span className="inline-flex items-baseline">
                <span className="mr-[0.05em] align-top text-[0.42em]">+</span>
                <AnimatedScore value={team.points} delay={delay + 180} />
                <span className="ml-[0.12em] text-[0.3em]">pt</span>
              </span>
            )}
          </p>
        </div>
      </div>

      {team.rate === null ? (
        <p
          className={`mt-[clamp(8px,1.2vh,16px)] text-[clamp(16px,1.05vw,20px)] font-bold text-stage-muted`}
        >
          回答者4人未満のため得点なし
        </p>
      ) : (
        <div className="mt-[clamp(6px,0.9vh,12px)]">
          <div className="flex items-center gap-[clamp(8px,0.8vw,16px)]">
            <div className="min-w-0 flex-1">
              <ConsistencyBar
                rate={team.rate}
                isPerfect={isPerfect}
                delay={delay + 260}
              />
            </div>
            <p
              className={`shrink-0 font-numeric text-[clamp(16px,1.05vw,20px)] font-bold ${
                isPerfect ? "text-stage-bg" : "text-stage-muted"
              }`}
            >
              {team.topAnswerCount} / {team.answerCount}人一致
            </p>
          </div>
        </div>
      )}
    </article>
  );
}

export function StageScoreboard({ data }: StageScoreboardProps) {
  const layout = getGridLayout(data.teams.length);
  const rankingColumns = getRankingColumns(data.ranking.length);
  const dense = data.teams.length > 6;

  return (
    <div className="stage relative flex h-full flex-col overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-[10vw] -top-[24vh] size-[48vw] rounded-full border-[clamp(24px,3vw,56px)] border-white/[0.025]" />
        <div className="absolute -right-[6vw] top-[8vh] h-[34vh] w-[24vw] rotate-12 border-[3px] border-white/[0.04]" />
        <div className="absolute bottom-[-20vh] left-[36vw] size-[36vw] rounded-full bg-stage-cyan/[0.035]" />
        <div className="absolute left-[17vw] top-[10vh] size-0 border-l-[5vw] border-r-[5vw] border-b-[9vw] border-l-transparent border-r-transparent border-b-stage-pink/[0.035]" />
      </div>

      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 items-start justify-between gap-[3vw] px-[4vw] pb-[2.2vh] pt-[3.2vh]">
          <div className="min-w-0">
            <div className="flex items-center gap-[0.9vw]">
              <span className="rounded-full bg-stage-pink px-[clamp(10px,0.9vw,18px)] py-[clamp(4px,0.55vh,8px)] font-numeric text-[clamp(13px,0.95vw,17px)] font-extrabold uppercase tracking-[0.16em] text-white">
                Score Reveal
              </span>
              <span className="font-numeric text-[clamp(13px,0.95vw,17px)] font-bold uppercase tracking-[0.18em] text-stage-muted">
                Room {data.roomCode}
              </span>
            </div>

            <h1
              id="stage-result-heading"
              className="mt-[clamp(8px,1.2vh,18px)] font-rounded text-[clamp(42px,4.6vw,88px)] font-extrabold leading-[1.02] tracking-[-0.02em]"
            >
              第{data.questionNumber}問{" "}
              <span className="text-stage-yellow">結果</span>
            </h1>
            <p className="mt-[clamp(4px,0.8vh,12px)] max-w-[76vw] text-balance font-rounded text-[clamp(24px,2.4vw,46px)] font-bold leading-tight text-stage-muted">
              「{data.questionText}」
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-[clamp(6px,0.8vh,12px)]">
            <p className="text-[clamp(14px,1vw,19px)] font-bold uppercase tracking-[0.18em] text-stage-muted">
              一致率 × 10
            </p>
            <div
              role="progressbar"
              aria-label="お題の進行状況"
              aria-valuemin={0}
              aria-valuemax={data.totalQuestions}
              aria-valuenow={data.questionNumber}
              className="flex gap-[clamp(3px,0.35vw,7px)]"
            >
              {Array.from({ length: data.totalQuestions }, (_, index) => (
                <span
                  key={index}
                  aria-hidden="true"
                  className={`h-[clamp(6px,0.9vh,12px)] w-[clamp(15px,1.25vw,26px)] rounded-full ${
                    index < data.questionNumber
                      ? index === data.questionNumber - 1
                        ? "bg-stage-yellow"
                        : "bg-stage-green"
                      : "bg-white/10"
                  }`}
                />
              ))}
            </div>
            <p className="font-numeric text-[clamp(15px,1vw,19px)] font-bold text-stage-muted">
              {data.questionNumber} / {data.totalQuestions}
            </p>
          </div>
        </header>

        <main
          aria-labelledby="stage-result-heading"
          className="flex min-h-0 flex-1 flex-col px-[4vw] pb-[1.6vh]"
        >
          <ul
            className="grid min-h-0 flex-1 auto-rows-fr gap-[clamp(10px,1.2vw,24px)]"
            style={{
              gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
            }}
          >
            {data.teams.map((team, index) => (
              <li
                key={team.id}
                className="flex min-h-0"
                style={{ gridColumn: `span ${layout.spans[index]}` }}
              >
                <TeamResultCard team={team} index={index} dense={dense} />
              </li>
            ))}
          </ul>
        </main>

        <section
          aria-labelledby="stage-ranking-heading"
          className="relative shrink-0 px-[4vw] pb-[3.2vh]"
        >
          <div className="mb-[clamp(6px,0.9vh,13px)] flex items-end justify-between gap-[2vw]">
            <h2
              id="stage-ranking-heading"
              className="font-rounded text-[clamp(24px,2vw,38px)] font-extrabold"
            >
              総合順位
            </h2>
            <p className="font-numeric text-[clamp(15px,1vw,19px)] font-bold text-stage-muted">
              第{data.questionNumber}問終了時点
            </p>
          </div>

          <ol
            className="grid gap-[clamp(8px,0.9vw,18px)]"
            style={{ gridTemplateColumns: rankingColumns }}
          >
            {data.ranking.map((entry, index) => {
              const isLeader = index === 0;

              return (
                <li
                  key={entry.teamId}
                  className={`animate-stage-rise flex min-w-0 items-center justify-between gap-[0.6vw] overflow-hidden rounded-[clamp(10px,0.9vw,18px)] border-2 px-[clamp(10px,0.9vw,18px)] py-[clamp(7px,1vh,14px)] ${
                    isLeader
                      ? "border-stage-yellow bg-stage-yellow text-stage-bg"
                      : index < 3
                        ? "border-white/15 bg-stage-surface text-stage-fg"
                        : "border-white/10 bg-white/[0.035] text-stage-fg"
                  }`}
                  style={{ animationDelay: `${800 + index * 55}ms` }}
                >
                  <span className="flex min-w-0 items-center gap-[0.65vw]">
                    <span
                      aria-label={`${index + 1}位`}
                      className={`font-numeric text-[clamp(22px,2vw,38px)] font-extrabold leading-none ${
                        isLeader ? "text-stage-bg" : "text-stage-muted"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span
                      aria-hidden="true"
                      className="size-[clamp(8px,0.75vw,14px)] shrink-0 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span
                      className={`truncate font-rounded text-[clamp(20px,1.6vw,32px)] font-extrabold ${
                        isLeader ? "text-stage-bg" : "text-stage-fg"
                      }`}
                    >
                      {entry.name}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 font-numeric text-[clamp(26px,2.2vw,42px)] font-extrabold leading-none tabular-nums ${
                      isLeader ? "text-stage-bg" : "text-stage-fg"
                    }`}
                  >
                    {entry.totalPoints}
                    <span className="ml-[0.1em] text-[0.5em] font-bold">pt</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </div>
  );
}
