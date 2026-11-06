import type { ResultData, ResultTeam } from "@/lib/demo/p07";
import { MIN_ANSWER_COUNT, formatRate } from "@/lib/scoring";
import { CheckIcon } from "./icons";

type ResultScreenProps = {
  data: ResultData;
};

function TeamDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

function ResultSummary({ team, ownAnswer }: { team: ResultTeam; ownAnswer: string | null }) {
  const ratePercent =
    team.rate === null ? null : Math.round(team.rate * 100);
  const points = team.points;
  const isScored = ratePercent !== null && points !== null;
  const isPerfect = points === 10;

  return (
    <section
      aria-labelledby="own-result-heading"
      className={`mt-4 rounded-2xl border-2 p-4 ${
        isPerfect
          ? "border-sun-yellow bg-[#fff9e6]"
          : isScored
            ? "border-line-soft bg-paper-white"
            : "border-faded-gray bg-[#fafafa]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <TeamDot color={team.color} />
          <h2
            id="own-result-heading"
            className="truncate text-sm font-extrabold text-charcoal"
          >
            {team.name}
          </h2>
          <span className="shrink-0 rounded-full bg-storybook-green px-2 py-0.5 text-[9px] font-extrabold text-eager-green-ink">
            あなたのチーム
          </span>
        </div>

        {isPerfect ? (
          <span className="shrink-0 rounded-full bg-sun-yellow px-2.5 py-1 text-[10px] font-extrabold text-night-ink">
            全員一致
          </span>
        ) : !isScored ? (
          <span className="shrink-0 rounded-full bg-[#f2f2f2] px-2.5 py-1 text-[10px] font-extrabold text-pencil-gray">
            採点対象外
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold tracking-[0.14em] text-pencil-gray">
            あなたの回答
          </p>
          <p className="mt-1 break-words text-[22px] font-extrabold leading-tight text-charcoal">
            {ownAnswer === null ? "回答なし" : `「${ownAnswer}」`}
          </p>
          {ownAnswer === null ? (
            <p className="mt-1 text-[11px] font-medium text-pencil-gray">
              今回は回答していません
            </p>
          ) : null}
        </div>

        {isScored ? (
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-extrabold tracking-[0.14em] text-pencil-gray">
              獲得
            </p>
            <p className="font-numeric text-[40px] font-extrabold leading-none text-eager-green-ink">
              +{points}
              <span className="ml-0.5 text-[15px]">pt</span>
            </p>
          </div>
        ) : null}
      </div>

      {isScored ? (
        <>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold tracking-[0.14em] text-pencil-gray">
                一致率
              </p>
              <p className="font-numeric text-[32px] font-extrabold leading-tight text-charcoal">
                {formatRate(team.rate ?? 0)}
              </p>
            </div>
            <p className="pb-0.5 text-right text-xs font-bold text-pencil-gray">
              {team.topAnswerCount} / {team.answerCount}人一致
            </p>
          </div>

          <div
            role="progressbar"
            aria-label="チームの一致率"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={ratePercent ?? 0}
            className="mt-2 h-2.5 overflow-hidden rounded-full bg-line-soft"
          >
            <div
              className="h-full rounded-full bg-eager-green"
              style={{ width: `${ratePercent ?? 0}%` }}
            />
          </div>
        </>
      ) : (
        <p className="mt-3 text-xs font-bold text-[#9a5b00]">
          回答者{MIN_ANSWER_COUNT}人未満のため得点なし
        </p>
      )}

      <div className="mt-3 flex items-center justify-between border-t-2 border-line-soft pt-2.5">
        <p className="text-xs font-bold text-pencil-gray">累計</p>
        <p className="font-numeric text-xl font-extrabold text-charcoal">
          {team.totalPoints}
          <span className="ml-0.5 text-[12px]">pt</span>
        </p>
      </div>
    </section>
  );
}

export function ResultScreen({ data }: ResultScreenProps) {
  const ownTeam =
    data.teams.find((team) => team.id === data.ownTeamId) ?? data.teams[0];

  if (!ownTeam) {
    return null;
  }

  const questionProgress = Math.min(
    100,
    Math.round(
      (data.questionNumber / Math.max(1, data.totalQuestions)) * 100,
    ),
  );
  const teamsById = [...data.teams].sort((a, b) => a.id.localeCompare(b.id));

  return (
    <div className="h-full bg-meadow-mist">
      <div className="mx-auto flex h-full w-full max-w-[480px] flex-col bg-paper-white">
        <header className="shrink-0 border-b-2 border-line-soft bg-paper-white">
          <div className="flex items-center justify-between gap-4 px-5 pb-3 pt-[calc(12px+env(safe-area-inset-top))]">
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-eager-green text-lg font-extrabold text-night-ink"
              >
                以
              </span>
              <div className="min-w-0">
                <p className="font-numeric text-[10px] font-extrabold uppercase tracking-[0.18em] text-pencil-gray">
                  Room {data.roomCode}
                </p>
                <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                  <TeamDot color={ownTeam.color} />
                  <span className="truncate text-sm font-extrabold text-charcoal">
                    {ownTeam.name}
                  </span>
                  <span className="truncate text-caption text-pencil-gray">
                    / {data.playerName}
                  </span>
                </div>
              </div>
            </div>

            <span className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg bg-storybook-green px-2 text-[10px] font-extrabold text-eager-green-ink">
              <CheckIcon className="size-3.5" />
              結果
            </span>
          </div>

          <div
            className="h-1 w-full bg-line-soft"
            role="progressbar"
            aria-label="お題の進行状況"
            aria-valuemin={0}
            aria-valuemax={data.totalQuestions}
            aria-valuenow={Math.min(
              data.questionNumber,
              data.totalQuestions,
            )}
          >
            <div
              className="h-full bg-eager-green transition-[width] duration-500"
              style={{ width: `${questionProgress}%` }}
            />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-5 compact:pb-6 compact:pt-4">
          <p className="text-caption font-bold text-pencil-gray">
            第{data.questionNumber}問{" "}
            <span className="font-medium text-pencil-gray">
              / 全{data.totalQuestions}問
            </span>
          </p>

          <h1 className="mt-1 font-rounded text-[26px] font-extrabold leading-tight tracking-[-0.01em] text-charcoal">
            結果
          </h1>
          <p className="mt-1 text-sm font-bold leading-6 text-pencil-gray">
            「{data.questionText}」
          </p>

          <ResultSummary team={ownTeam} ownAnswer={data.ownAnswer} />

          <section aria-labelledby="overall-ranking-heading" className="mt-5">
            <div className="flex items-end justify-between gap-3">
              <h2
                id="overall-ranking-heading"
                className="text-base font-extrabold text-charcoal"
              >
                総合順位
              </h2>
              <p className="text-[10px] font-bold text-pencil-gray">
                第{data.questionNumber}問終了時点
              </p>
            </div>

            <ol className="mt-2 divide-y-2 divide-line-soft overflow-hidden rounded-xl border-2 border-line-soft">
              {data.teams.map((team) => {
                const isOwn = team.id === ownTeam.id;

                return (
                  <li
                    key={team.id}
                    className={`flex min-h-12 items-center gap-2.5 px-3 py-2 ${
                      isOwn ? "bg-[#f7ffe9]" : "bg-paper-white"
                    }`}
                  >
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded-full font-numeric text-[11px] font-extrabold ${
                        team.rank === 1
                          ? "bg-sun-yellow text-night-ink"
                          : "bg-[#f2f2f2] text-pencil-gray"
                      }`}
                    >
                      {team.rank}
                    </span>
                    <TeamDot color={team.color} />
                    <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-charcoal">
                      {team.name}
                      {isOwn ? (
                        <span className="ml-1.5 rounded bg-storybook-green px-1.5 py-0.5 text-[9px] font-extrabold text-eager-green-ink">
                          あなたのチーム
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-numeric text-lg font-extrabold text-charcoal">
                      {team.totalPoints}
                      <span className="ml-0.5 text-[11px]">pt</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          <section aria-labelledby="all-answers-heading" className="mt-5">
            <h2
              id="all-answers-heading"
              className="text-base font-extrabold text-charcoal"
            >
              みんなの回答
            </h2>

            <ul className="mt-2 space-y-2">
              {teamsById.map((team) => {
                const isOwn = team.id === ownTeam.id;
                const groups = [...team.groups].sort(
                  (a, b) => b.count - a.count,
                );

                return (
                  <li
                    key={team.id}
                    className={`rounded-xl border-2 p-3 ${
                      isOwn
                        ? "border-[#b8e986] bg-[#f7ffe9]"
                        : "border-line-soft bg-paper-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <TeamDot color={team.color} />
                        <h3 className="truncate text-xs font-extrabold text-charcoal">
                          {team.name}
                        </h3>
                        {isOwn ? (
                          <span className="shrink-0 text-[9px] font-extrabold text-eager-green-ink">
                            あなたのチーム
                          </span>
                        ) : null}
                      </div>
                      <span className="shrink-0 font-numeric text-[11px] font-bold text-pencil-gray">
                        {team.answerCount} / {team.participantCount}人
                      </span>
                    </div>

                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {groups.map((group, index) => {
                        const isTop = index === 0;

                        return (
                          <li
                            key={group.text}
                            className={`flex max-w-full items-start gap-1 rounded-lg px-2 py-1 ${
                              isTop ? "bg-[#fff4e5]" : "bg-[#f7f7f7]"
                            }`}
                          >
                            <span
                              className={`min-w-0 break-words text-xs font-bold leading-5 ${
                                isTop ? "text-[#7a4a00]" : "text-charcoal"
                              }`}
                            >
                              {group.text}
                            </span>
                            <span
                              className={`shrink-0 font-numeric text-[11px] font-extrabold leading-5 ${
                                isTop ? "text-[#9a5b00]" : "text-pencil-gray"
                              }`}
                            >
                              ×{group.count}
                            </span>
                            {group.mergedFrom ? (
                              <span className="text-[9px] font-bold leading-5 text-spark-blue-ink">
                                （{group.mergedFrom}）
                              </span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </section>

          <p className="mt-4 text-center text-[11px] font-medium text-pencil-gray">
            次のお題をお待ちください
          </p>
        </main>
      </div>
    </div>
  );
}
