import type { Metadata } from "next";
import Link from "next/link";
import {
  QuestionManager,
  type QuestionPreviewState,
} from "@/components/host/question-manager";

export const metadata: Metadata = {
  title: "お題管理 | 以心伝心ゲーム",
  description: "ゲームで出題するお題の追加・編集・削除・並べ替えを行います。",
};

const previewStates: Array<{ id: QuestionPreviewState; label: string }> = [
  { id: "default", label: "通常" },
  { id: "empty", label: "お題なし" },
  { id: "editing", label: "編集中" },
  { id: "delete", label: "削除確認" },
];

type QuestionsPageProps = {
  searchParams: Promise<{
    preview?: string;
    state?: string;
  }>;
};

export default async function QuestionsPage({
  searchParams,
}: QuestionsPageProps) {
  const params = await searchParams;
  const previewMode = params.preview === "1";
  const currentState: QuestionPreviewState = previewStates.some(
    (state) => state.id === params.state,
  )
    ? (params.state as QuestionPreviewState)
    : "default";

  return (
    <div className="flex h-dvh flex-col bg-meadow-mist">
      {previewMode ? (
        <div
          role="navigation"
          aria-label="H-07 プレビュー状態"
          className="shrink-0 bg-night-ink text-white"
        >
          <div className="mx-auto flex w-full max-w-[1440px] items-center gap-2 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:px-8">
            <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/50">
              H-07 Preview
            </span>

            {previewStates.map((state) => {
              const isActive = state.id === currentState;

              return (
                <Link
                  key={state.id}
                  href={`/host/questions?preview=1&state=${state.id}`}
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

            <Link
              href="/host/questions"
              className="ml-auto inline-flex min-h-9 shrink-0 items-center rounded-lg border border-white/25 px-2.5 text-[11px] font-extrabold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              閉じる
            </Link>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <QuestionManager
          key={`${previewMode ? "preview" : "live"}-${currentState}`}
          previewMode={previewMode}
          previewState={currentState}
        />
      </div>
    </div>
  );
}
