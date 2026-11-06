import type { StageFinalData, StageFinalTeam } from "@/lib/demo/s05";
import { AnimatedScore } from "./animated-score";

type StageFinalProps = {
  data: StageFinalData;
};

function getGridLayout(teamCount: number) {
  const remaining = Math.max(1, teamCount - 1);

  if (remaining <= 5) {
    return { columns: remaining, rows: 1 };
  }

  const rows = Math.ceil(remaining / 5);
  const columns = Math.ceil(remaining / rows);

  return { columns: Math.min(6, columns), rows };
}

function WinnerCard({ team, totalQuestions }: { team: StageFinalTeam; totalQuestions: number }) {
  return (
    <article
      aria-labelledby="stage-winner-name"
      className="animate-stage-rise relative flex min-h-0 w-full flex-col justify-between overflow-hidden rounded-[clamp(18px,1.6vw,32px)] border-[3px] border-stage-yellow bg-stage-yellow p-[clamp(16px,1.5vw,32px)] text-stage-bg"
    >
      <span
        aria-hidden="true"
        className="absolute -right-[4vw] -top-[12vh] size-[30vw] rounded-full border-[clamp(18px,2vw,40px)] border-stage-bg/[0.07]"
      />

      <div className="relative flex flex-wrap items-center justify-between gap-[1vw]">
        <span className="animate-stage-pop inline-flex items-center rounded-full bg-stage-bg px-[clamp(12px,1vw,20px)] py-[clamp(4px,0.55vh,8px)] text-[clamp(15px,1.15vw,22px)] font-extrabold tracking-[0.18em] text-stage-yellow">
          優勝
        </span>
        <p className="text-[clamp(14px,1vw,19px)] font-bold tracking-[0.08em] text-stage-bg/80">
          全{totalQuestions}問終了
        </p>
      </div>

      <div className="relative mt-[clamp(6px,1.2vh,16px)] flex flex-wrap items-end justify-between gap-x-[2vw] gap-y-[clamp(4px,0.8vh,10px)]">
        <div className="flex min-w-0 items-center gap-[clamp(10px,1vw,20px)]">
          <span
            aria-hidden="true"
            className="size-[clamp(18px,1.7vw,34px)] shrink-0 rounded-full border-[3px] border-stage-bg"
            style={{ backgroundColor: team.color }}
          />
          <h3
            id="stage-winner-name"
            className="truncate font-rounded text-[clamp(52px,7.8vw,150px)] font-extrabold leading-[1.35] tracking-[-0.02em]"
          >
            {team.name}
          </h3>
        </div>

        <p className="shrink-0 font-numeric text-[clamp(60px,8.6vw,164px)] font-extrabold leading-[0.9] tabular-nums">
          <AnimatedScore value={team.totalPoints} delay={260} />
          <span className="ml-[0.08em] text-[0.34em] font-bold">pt</span>
        </p>
      </div>

      <p className="relative mt-[clamp(6px,1vh,12px)] text-[clamp(14px,1.1vw,21px)] font-bold text-stage-bg/80">
        全員一致 {team.perfectCount}回 ・ 最終お題 +{team.lastQuestionPoints}pt
      </p>
    </article>
  );
}

function RankingCard({
  team,
  rank,
  dense,
  index,
}: {
  team: StageFinalTeam;
  rank: number;
  dense: boolean;
  index: number;
}) {
  return (
    <article
      aria-labelledby={`stage-final-team-${team.id}`}
      className={`animate-stage-rise flex min-h-0 w-full flex-col justify-between overflow-hidden rounded-[clamp(14px,1.2vw,24px)] border-[3px] p-[clamp(12px,1.1vw,24px)] ${
        rank <= 3
          ? "border-white/15 bg-stage-surface text-stage-fg"
          : "border-white/10 bg-white/[0.035] text-stage-fg"
      }`}
      style={{ animationDelay: `${320 + index * 80}ms` }}
    >
      <div className="flex items-center justify-between gap-[0.8vw]">
        <span className="rounded-full bg-white/10 px-[clamp(8px,0.7vw,14px)] py-[clamp(3px,0.45vh,7px)] font-numeric text-[clamp(13px,1vw,19px)] font-extrabold text-stage-muted">
          {rank}位
        </span>
        <span
          aria-hidden="true"
          className="size-[clamp(11px,0.9vw,18px)] shrink-0 rounded-full"
          style={{ backgroundColor: team.color }}
        />
      </div>

      <h3
        id={`stage-final-team-${team.id}`}
        className={`mt-[clamp(6px,1vh,12px)] truncate font-rounded font-extrabold leading-tight ${
          dense
            ? "text-[clamp(20px,1.7vw,34px)]"
            : "text-[clamp(24px,2.2vw,42px)]"
        }`}
      >
        {team.name}
      </h3>

      <div className="mt-auto flex flex-wrap items-end justify-between gap-x-[0.8vw] gap-y-[clamp(2px,0.4vh,6px)] pt-[clamp(6px,1vh,12px)]">
        <div className="min-w-0">
          <p className="text-[clamp(12px,0.9vw,17px)] font-bold text-stage-muted">
            全員一致 {team.perfectCount}回
          </p>
          <p className="mt-0.5 text-[clamp(11px,0.82vw,15px)] font-bold text-stage-muted">
            最終お題 +{team.lastQuestionPoints}pt
          </p>
        </div>
        <p
          className={`shrink-0 font-numeric font-extrabold leading-none tabular-nums ${
            dense
              ? "text-[clamp(30px,2.8vw,56px)]"
              : "text-[clamp(36px,3.4vw,66px)]"
          }`}
        >
          <AnimatedScore value={team.totalPoints} delay={440 + index * 80} />
          <span className="ml-[0.1em] text-[0.38em] font-bold">pt</span>
        </p>
      </div>
    </article>
  );
}

export function StageFinal({ data }: StageFinalProps) {
  const layout = getGridLayout(data.teams.length);
  const winner = data.teams[0];
  const runnersUp = data.teams.slice(1);
  const dense = runnersUp.length >= 5 || data.teams.length > 6;

  return (
    <div className="stage relative flex h-full flex-col overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-[12vw] -top-[22vh] size-[46vw] rounded-full border-[clamp(24px,3vw,56px)] border-white/[0.025]" />
        <div className="absolute -right-[8vw] top-[9vh] h-[38vh] w-[22vw] -rotate-12 border-[3px] border-white/[0.04]" />
        <div className="absolute bottom-[-22vh] left-[38vw] size-[40vw] rounded-full bg-stage-yellow/[0.04]" />
        <div className="absolute left-[17vw] top-[12vh] size-0 border-l-[5vw] border-r-[5vw] border-b-[9vw] border-l-transparent border-r-transparent border-b-stage-pink/[0.04]" />
        <div className="absolute right-[18vw] top-[9vh] size-[1.1vw] rounded-full bg-stage-pink/25" />
        <div className="absolute bottom-[16vh] left-[9vw] size-[0.8vw] rounded-full bg-stage-cyan/25" />
        <div className="absolute bottom-[9vh] right-[7vw] h-[1.6vw] w-[0.7vw] rotate-[24deg] bg-stage-yellow/20" />
      </div>

      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 items-start justify-between gap-[3vw] px-[4vw] pb-[2.2vh] pt-[3.2vh]">
          <div className="min-w-0">
            <div className="flex items-center gap-[0.9vw]">
              <span className="rounded-full bg-stage-yellow px-[clamp(10px,0.9vw,18px)] py-[clamp(4px,0.55vh,8px)] font-numeric text-[clamp(13px,0.95vw,17px)] font-extrabold tracking-[0.12em] text-stage-bg">
                ゲーム終了
              </span>
              <span className="font-numeric text-[clamp(13px,0.95vw,17px)] font-bold tracking-[0.14em] text-stage-muted">
                ルーム {data.roomCode}
              </span>
            </div>

            <h1
              id="stage-final-heading"
              className="mt-[clamp(8px,1.2vh,18px)] font-rounded text-[clamp(42px,4.6vw,88px)] font-extrabold leading-[1.02] tracking-[-0.02em]"
            >
              最終<span className="text-stage-yellow">結果</span>
            </h1>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-[clamp(6px,0.8vh,12px)]">
            <p className="text-[clamp(14px,1vw,19px)] font-bold tracking-[0.14em] text-stage-muted">
              全{data.totalQuestions}問
            </p>
            <div
              role="progressbar"
              aria-label="お題の進行状況"
              aria-valuemin={0}
              aria-valuemax={data.totalQuestions}
              aria-valuenow={data.totalQuestions}
              className="flex gap-[clamp(3px,0.35vw,7px)]"
            >
              {Array.from({ length: data.totalQuestions }, (_, index) => (
                <span
                  key={index}
                  aria-hidden="true"
                  className="h-[clamp(6px,0.9vh,12px)] w-[clamp(15px,1.25vw,26px)] rounded-full bg-stage-green"
                />
              ))}
            </div>
            <p className="font-numeric text-[clamp(15px,1vw,19px)] font-bold text-stage-muted">
              {data.totalQuestions} / {data.totalQuestions}
            </p>
          </div>
        </header>

        <main
          aria-labelledby="stage-final-heading"
          className="flex min-h-0 flex-1 flex-col px-[4vw] pb-[3.2vh]"
        >
          <div className="mb-[clamp(6px,0.9vh,13px)] flex items-end justify-between gap-[2vw]">
            <h2
              id="stage-final-ranking-heading"
              className="font-rounded text-[clamp(24px,2vw,38px)] font-extrabold"
            >
              最終順位
            </h2>
            <p className="font-numeric text-[clamp(15px,1vw,19px)] font-bold text-stage-muted">
              {data.teams.length}チーム
            </p>
          </div>

          <ol
            aria-labelledby="stage-final-ranking-heading"
            className="grid min-h-0 flex-1 auto-rows-fr gap-[clamp(10px,1.2vw,24px)]"
            style={{
              gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
              gridTemplateRows: `1.35fr repeat(${layout.rows}, minmax(0, 1fr))`,
            }}
          >
            <li className="flex min-h-0" style={{ gridColumn: "1 / -1" }}>
              <WinnerCard team={winner} totalQuestions={data.totalQuestions} />
            </li>
            {runnersUp.map((team, index) => (
              <li key={team.id} className="flex min-h-0">
                <RankingCard
                  team={team}
                  rank={index + 2}
                  dense={dense}
                  index={index}
                />
              </li>
            ))}
          </ol>
        </main>
      </div>
    </div>
  );
}
