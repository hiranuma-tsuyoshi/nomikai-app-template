import type { Metadata } from "next";
import Link from "next/link";
import { StageApp } from "@/components/live/stage-app";
import { StageFinal } from "@/components/stage/stage-final";
import { StageReveal } from "@/components/stage/stage-reveal";
import { StageScoreboard } from "@/components/stage/stage-scoreboard";
import {
  stageRevealMocks,
  type StageRevealPreviewState,
} from "@/lib/demo/s03";
import {
  stageFinalMocks,
  type StageFinalPreviewState,
} from "@/lib/demo/s05";
import {
  stageMocks,
  type StageScorePreviewState,
} from "@/lib/demo/stage";

export const metadata: Metadata = {
  title: "会場スクリーン | 以心伝心ゲーム",
  description:
    "チームの回答と一致率、得点、総合順位、最終結果を会場スクリーンに表示します。",
};

type StagePreviewState =
  | StageRevealPreviewState
  | StageScorePreviewState
  | StageFinalPreviewState;

const previewStates: Array<{
  id: StagePreviewState;
  label: string;
}> = [
  { id: "reveal", label: "公開 5チーム" },
  { id: "reveal_two_teams", label: "公開 2チーム" },
  { id: "reveal_six_teams", label: "公開 6チーム" },
  { id: "scored", label: "通常" },
  { id: "excluded", label: "採点対象外" },
  { id: "two_teams", label: "2チーム" },
  { id: "final", label: "最終結果" },
  { id: "final_two_teams", label: "最終 2チーム" },
  { id: "final_six_teams", label: "最終 6チーム" },
];

function isRevealState(state: StagePreviewState): state is StageRevealPreviewState {
  return state.startsWith("reveal");
}

function isFinalState(state: StagePreviewState): state is StageFinalPreviewState {
  return state.startsWith("final");
}

type StagePageProps = {
  searchParams: Promise<{
    preview?: string;
    state?: string;
    token?: string;
  }>;
};

export default async function StagePage({ searchParams }: StagePageProps) {
  const params = await searchParams;
  const previewMode = params.preview === "1";

  if (!previewMode) {
    return <StageApp token={params.token} />;
  }

  const currentState = previewStates.some((state) => state.id === params.state)
    ? (params.state as StagePreviewState)
    : "scored";

  return (
    <div className="relative h-dvh overflow-hidden bg-stage-bg">
      {isRevealState(currentState) ? (
        <StageReveal
          key={currentState}
          data={stageRevealMocks[currentState]}
        />
      ) : isFinalState(currentState) ? (
        <StageFinal key={currentState} data={stageFinalMocks[currentState]} />
      ) : (
        <StageScoreboard key={currentState} data={stageMocks[currentState]} />
      )}

      {previewMode ? (
        <nav
          aria-label="S-03 / S-04 / S-05 プレビュー状態"
          className="fixed bottom-[clamp(10px,1.8vh,22px)] left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-white/15 bg-[#12072b] px-2.5 py-2"
        >
          <span className="mr-1 shrink-0 font-numeric text-[10px] font-extrabold uppercase tracking-[0.14em] text-stage-muted">
            S-03 / S-04 / S-05
          </span>

          {previewStates.map((state) => {
            const isActive = state.id === currentState;

            return (
              <Link
                key={state.id}
                href={`/stage?preview=1&state=${state.id}`}
                aria-current={isActive ? "true" : undefined}
                className={`inline-flex min-h-9 shrink-0 items-center rounded-lg px-3 text-[11px] font-extrabold transition-colors ${
                  isActive
                    ? "bg-stage-yellow text-stage-bg"
                    : "border border-white/15 text-stage-fg hover:bg-white/10"
                }`}
              >
                {state.label}
              </Link>
            );
          })}

          <Link
            href="/stage"
            className="ml-1 inline-flex min-h-9 shrink-0 items-center rounded-lg border border-white/20 px-3 text-[11px] font-extrabold text-stage-muted transition-colors hover:bg-white/10 hover:text-stage-fg"
          >
            閉じる
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
