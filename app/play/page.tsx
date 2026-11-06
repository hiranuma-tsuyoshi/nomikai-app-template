import type { Metadata } from "next";
import Link from "next/link";
import {
  AnswerScreen,
  type AnswerScreenPreviewState,
} from "@/components/game/answer-screen";
import {
  FinalCheckScreen,
  type FinalCheckPreviewState,
} from "@/components/game/final-check-screen";
import {
  ResultScreen,
} from "@/components/game/result-screen";
import { ParticipantApp } from "@/components/live/participant-app";
import { p04Mock } from "@/lib/demo/p04";
import { p06Mock } from "@/lib/demo/p06";
import { p07Mocks, type ResultPreviewState } from "@/lib/demo/p07";

export const metadata: Metadata = {
  title: "参加者 | 以心伝心ゲーム",
  description: "お題に回答して、チームの答えを揃えよう。",
};

const answerPreviewStates: Array<{
  id: AnswerScreenPreviewState;
  label: string;
}> = [
  { id: "default", label: "通常" },
  { id: "typing", label: "入力中" },
  { id: "submitted", label: "送信済み" },
  { id: "closed", label: "締切" },
  { id: "error", label: "通信エラー" },
  { id: "low_time", label: "残り10秒" },
];

const finalCheckPreviewStates: Array<{
  id: FinalCheckPreviewState;
  label: string;
}> = [
  { id: "final_check", label: "最終確認" },
  { id: "final_check_confirmed", label: "確定済み" },
  { id: "final_check_editing", label: "修正中" },
  { id: "final_check_unanswered", label: "未回答" },
  { id: "final_check_low_time", label: "残り5秒" },
  { id: "final_check_timeup", label: "時間切れ" },
];

const resultPreviewStates: Array<{
  id: ResultPreviewState;
  label: string;
}> = [
  { id: "result", label: "結果" },
  { id: "result_perfect", label: "全員一致" },
  { id: "result_excluded", label: "採点対象外" },
  { id: "result_unanswered", label: "回答なし" },
];

type PlayPageProps = {
  searchParams: Promise<{
    preview?: string;
    state?: string;
    code?: string;
  }>;
};

export default async function PlayPage({ searchParams }: PlayPageProps) {
  const params = await searchParams;
  const previewMode = params.preview === "1";

  if (!previewMode) {
    return <ParticipantApp initialCode={params.code} />;
  }
  const currentFinalCheckState = finalCheckPreviewStates.find(
    (state) => state.id === params.state,
  )?.id;
  const currentResultState = resultPreviewStates.find(
    (state) => state.id === params.state,
  )?.id;
  const currentAnswerState = answerPreviewStates.some(
    (state) => state.id === params.state,
  )
    ? (params.state as AnswerScreenPreviewState)
    : "default";

  return (
    <div className="flex h-dvh flex-col bg-meadow-mist">
      {previewMode ? (
        <div className="shrink-0 bg-night-ink text-white">
          <div className="mx-auto flex w-full max-w-[480px] items-center gap-2 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/50">
              参加者 Preview
            </span>

            {answerPreviewStates.map((state) => {
              const isActive =
                !currentFinalCheckState &&
                !currentResultState &&
                state.id === currentAnswerState;
              return (
                <Link
                  key={state.id}
                  href={`/play?preview=1&state=${state.id}`}
                  aria-current={isActive ? "true" : undefined}
                  className={`inline-flex min-h-9 shrink-0 items-center rounded-lg px-2.5 text-[11px] font-extrabold transition-colors ${
                    isActive
                      ? "bg-white text-night-ink"
                      : "border border-white/20 text-white/80 hover:bg-white/10"
                  }`}
                >
                  {state.label}
                </Link>
              );
            })}

            <span
              aria-hidden="true"
              className="h-5 w-px shrink-0 bg-white/20"
            />

            {finalCheckPreviewStates.map((state) => {
              const isActive = state.id === currentFinalCheckState;
              return (
                <Link
                  key={state.id}
                  href={`/play?preview=1&state=${state.id}`}
                  aria-current={isActive ? "true" : undefined}
                  className={`inline-flex min-h-9 shrink-0 items-center rounded-lg px-2.5 text-[11px] font-extrabold transition-colors ${
                    isActive
                      ? "bg-[#ffcc00] text-night-ink"
                      : "border border-white/20 text-white/80 hover:bg-white/10"
                  }`}
                >
                  {state.label}
                </Link>
              );
            })}

            <span
              aria-hidden="true"
              className="h-5 w-px shrink-0 bg-white/20"
            />

            {resultPreviewStates.map((state) => {
              const isActive = state.id === currentResultState;
              return (
                <Link
                  key={state.id}
                  href={`/play?preview=1&state=${state.id}`}
                  aria-current={isActive ? "true" : undefined}
                  className={`inline-flex min-h-9 shrink-0 items-center rounded-lg px-2.5 text-[11px] font-extrabold transition-colors ${
                    isActive
                      ? "bg-eager-green text-night-ink"
                      : "border border-white/20 text-white/80 hover:bg-white/10"
                  }`}
                >
                  {state.label}
                </Link>
              );
            })}

            <Link
              href="/play"
              className="ml-auto inline-flex min-h-9 shrink-0 items-center rounded-lg border border-white/25 px-2.5 text-[11px] font-extrabold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              閉じる
            </Link>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        {currentFinalCheckState ? (
          <FinalCheckScreen
            key={currentFinalCheckState}
            data={p06Mock}
            previewState={currentFinalCheckState}
          />
        ) : currentResultState ? (
          <ResultScreen
            key={currentResultState}
            data={p07Mocks[currentResultState]}
          />
        ) : (
          <AnswerScreen
            key={currentAnswerState}
            data={p04Mock}
            previewState={currentAnswerState}
          />
        )}
      </div>
    </div>
  );
}
