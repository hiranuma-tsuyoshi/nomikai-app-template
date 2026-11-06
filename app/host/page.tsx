import type { Metadata } from "next";
import Link from "next/link";
import { GroupingConsole } from "@/components/host/grouping-console";
import { HostConsole } from "@/components/host/host-console";
import { HostApp } from "@/components/live/host-app";
import { hostMocks, type HostPhase } from "@/lib/demo/h05";
import { groupingMock } from "@/lib/demo/h06";

export const metadata: Metadata = {
  title: "進行管理 | 以心伝心ゲーム",
  description: "お題の出題から回答の統合、得点確定までを進行します。",
};

type HostPreviewState = HostPhase | "grouping";

const previewStates: Array<{ id: HostPreviewState; label: string }> = [
  { id: "answering", label: "回答受付中" },
  { id: "final_check", label: "最終確認" },
  { id: "reveal", label: "回答公開" },
  { id: "grouping", label: "グループ統合" },
  { id: "scored", label: "得点確定" },
];

type HostPageProps = {
  searchParams: Promise<{
    preview?: string;
    state?: string;
  }>;
};

export default async function HostPage({ searchParams }: HostPageProps) {
  const params = await searchParams;
  const previewMode = params.preview === "1";

  if (!previewMode) {
    return <HostApp />;
  }

  const currentState: HostPreviewState = previewStates.some(
    (state) => state.id === params.state,
  )
    ? (params.state as HostPreviewState)
    : "answering";

  return (
    <div className="flex h-dvh flex-col bg-meadow-mist">
      {previewMode ? (
        <div
          role="navigation"
          aria-label="H-05 / H-06 プレビュー状態"
          className="shrink-0 bg-night-ink text-white"
        >
          <div className="mx-auto flex w-full max-w-[1440px] items-center gap-2 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:px-8">
            <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/50">
              H-05 / H-06 Preview
            </span>

            {previewStates.map((state) => {
              const isActive = state.id === currentState;

              return (
                <Link
                  key={state.id}
                  href={`/host?preview=1&state=${state.id}`}
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
              href="/host"
              className="ml-auto inline-flex min-h-9 shrink-0 items-center rounded-lg border border-white/25 px-2.5 text-[11px] font-extrabold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              閉じる
            </Link>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {currentState === "grouping" ? (
          <GroupingConsole
            key={currentState}
            data={groupingMock}
            previewMode={previewMode}
          />
        ) : (
          <HostConsole
            key={currentState}
            data={hostMocks[currentState]}
            previewState={currentState}
          />
        )}
      </div>
    </div>
  );
}
