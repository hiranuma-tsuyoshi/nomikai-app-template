import type { StageAnswerTeam, StageRevealData } from "@/lib/demo/s03";

type StageRevealProps = {
  data: StageRevealData;
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

function AnswerTeamCard({
  team,
  index,
  dense,
}: {
  team: StageAnswerTeam;
  index: number;
  dense: boolean;
}) {
  const groups = [...team.groups].sort((a, b) => b.count - a.count);

  return (
    <article
      aria-labelledby={`reveal-team-${team.id}`}
      className="animate-stage-rise relative flex min-h-0 w-full flex-col overflow-hidden rounded-[clamp(16px,1.4vw,28px)] border-[3px] border-white/10 bg-stage-surface p-[clamp(12px,1.1vw,24px)]"
      style={{ animationDelay: `${120 + index * 70}ms` }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[clamp(5px,0.6vh,9px)]"
        style={{ backgroundColor: team.color }}
      />

      <div className="flex items-center justify-between gap-[1vw]">
        <div className="flex min-w-0 items-center gap-[clamp(6px,0.8vw,14px)]">
          <span
            aria-hidden="true"
            className="size-[clamp(9px,0.8vw,15px)] shrink-0 rounded-full"
            style={{ backgroundColor: team.color }}
          />
          <h2
            id={`reveal-team-${team.id}`}
            className="truncate font-rounded text-[clamp(20px,1.8vw,34px)] font-extrabold leading-none"
          >
            {team.name}
          </h2>
        </div>

        <span className="shrink-0 rounded-full bg-white/10 px-[clamp(8px,0.7vw,14px)] py-[clamp(3px,0.5vh,7px)] font-numeric text-[clamp(13px,0.95vw,18px)] font-bold text-stage-muted">
          {team.answerCount} / {team.participantCount}人
        </span>
      </div>

      <ul className="mt-[clamp(8px,1.4vh,18px)] flex min-h-0 flex-1 flex-col justify-center gap-[clamp(4px,0.9vh,12px)]">
        {groups.map((group, groupIndex) => {
          const isTop = groupIndex === 0;

          return (
            <li
              key={group.text}
              className={`rounded-[clamp(8px,0.8vw,16px)] px-[clamp(8px,0.8vw,16px)] py-[clamp(5px,0.85vh,11px)] ${
                isTop ? "bg-white/[0.07]" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-[1vw]">
                <div className="min-w-0">
                  <p
                    className={`break-words font-rounded font-bold leading-tight ${
                      dense
                        ? "text-[clamp(15px,1.1vw,22px)]"
                        : "text-[clamp(17px,1.35vw,26px)]"
                    } ${isTop ? "text-stage-fg" : "text-stage-muted"}`}
                  >
                    {group.text}
                  </p>
                  {group.mergedFrom ? (
                    <p className="mt-0.5 text-[clamp(10px,0.72vw,14px)] font-bold leading-tight text-stage-cyan">
                      （{group.mergedFrom}）
                    </p>
                  ) : null}
                </div>

                <span
                  aria-label={`${group.count}人`}
                  className={`shrink-0 rounded-[clamp(6px,0.55vw,10px)] px-[clamp(8px,0.65vw,13px)] py-[clamp(3px,0.45vh,7px)] font-numeric font-extrabold leading-none ${
                    isTop
                      ? "bg-stage-yellow text-stage-bg"
                      : "bg-white/10 text-stage-fg"
                  } ${
                    dense
                      ? "text-[clamp(15px,1.1vw,22px)]"
                      : "text-[clamp(16px,1.25vw,24px)]"
                  }`}
                >
                  ×{group.count}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

export function StageReveal({ data }: StageRevealProps) {
  const layout = getGridLayout(data.teams.length);
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
              <span className="rounded-full bg-stage-pink px-[clamp(10px,0.9vw,18px)] py-[clamp(4px,0.55vh,8px)] font-numeric text-[clamp(13px,0.95vw,17px)] font-extrabold tracking-[0.12em] text-white">
                回答公開
              </span>
              <span className="font-numeric text-[clamp(13px,0.95vw,17px)] font-bold tracking-[0.14em] text-stage-muted">
                ルーム {data.roomCode}
              </span>
            </div>

            <h1
              id="stage-reveal-heading"
              className="mt-[clamp(8px,1.2vh,18px)] font-rounded text-[clamp(42px,4.6vw,88px)] font-extrabold leading-[1.02] tracking-[-0.02em]"
            >
              第{data.questionNumber}問{" "}
              <span className="text-stage-yellow">回答</span>
            </h1>
            <p className="mt-[clamp(4px,0.8vh,12px)] max-w-[76vw] text-balance font-rounded text-[clamp(24px,2.4vw,46px)] font-bold leading-tight text-stage-muted">
              「{data.questionText}」
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-[clamp(6px,0.8vh,12px)]">
            <p className="text-[clamp(14px,1vw,19px)] font-bold tracking-[0.14em] text-stage-muted">
              進行
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
          aria-labelledby="stage-reveal-heading"
          className="flex min-h-0 flex-1 flex-col px-[4vw] pb-[3.2vh]"
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
                <AnswerTeamCard team={team} index={index} dense={dense} />
              </li>
            ))}
          </ul>
        </main>
      </div>
    </div>
  );
}
