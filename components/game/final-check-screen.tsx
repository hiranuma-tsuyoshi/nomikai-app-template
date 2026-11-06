"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { FinalCheckQuestion } from "@/lib/demo/p06";
import { countCharacters, formatTime, isValidAnswer } from "@/lib/format";
import {
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  LockIcon,
  PencilIcon,
  SparklesIcon,
  XIcon,
} from "./icons";

export type FinalCheckPreviewState =
  | "final_check"
  | "final_check_confirmed"
  | "final_check_editing"
  | "final_check_unanswered"
  | "final_check_low_time"
  | "final_check_timeup";

export type FinalCheckLiveProps = {
  deadlineAt: string | null;
  onSave: (text: string) => Promise<void>;
};

type FinalCheckScreenProps = {
  data: FinalCheckQuestion;
  previewState?: FinalCheckPreviewState;
  live?: FinalCheckLiveProps;
};

const PREVIEW_SECONDS: Record<FinalCheckPreviewState, number> = {
  final_check: 24,
  final_check_confirmed: 18,
  final_check_editing: 16,
  final_check_unanswered: 12,
  final_check_low_time: 5,
  final_check_timeup: 0,
};

function secondsUntil(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
}

export function FinalCheckScreen({
  data,
  previewState = "final_check",
  live,
}: FinalCheckScreenProps) {
  const initialRemaining =
    live !== undefined
      ? secondsUntil(live.deadlineAt)
      : PREVIEW_SECONDS[previewState];
  const initialAnswer =
    live !== undefined
      ? data.submittedAnswer
      : previewState === "final_check_unanswered"
        ? null
        : data.submittedAnswer;
  const initialPublished = live !== undefined && initialRemaining === 0;

  const [remainingSeconds, setRemainingSeconds] = useState(initialRemaining);
  const [answer, setAnswer] = useState<string | null>(initialAnswer);
  const [draft, setDraft] = useState(initialAnswer ?? "");
  const [isEditing, setIsEditing] = useState(
    previewState === "final_check_editing",
  );
  const [isConfirmed, setIsConfirmed] = useState(
    previewState === "final_check_confirmed",
  );
  const [isPublished, setIsPublished] = useState(
    initialPublished || previewState === "final_check_timeup",
  );
  const [liveMessage, setLiveMessage] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const lowAnnouncedRef = useRef(false);

  useEffect(() => {
    if (initialRemaining <= 0) return;

    const deadline = Date.now() + initialRemaining * 1000;
    const interval = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemainingSeconds(next);

      if (next === 0) {
        window.clearInterval(interval);
        setIsPublished(true);
        setIsEditing(false);
        setLiveMessage("回答が公開されました");
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [initialRemaining]);

  useEffect(() => {
    if (
      remainingSeconds > 0 &&
      remainingSeconds <= 10 &&
      !lowAnnouncedRef.current
    ) {
      lowAnnouncedRef.current = true;
      setLiveMessage("公開まで残り10秒です");
    }
  }, [remainingSeconds]);

  const characterCount = countCharacters(draft);
  const isLowTime =
    !isPublished && remainingSeconds > 0 && remainingSeconds <= 10;
  const canSave =
    isEditing &&
    !isPublished &&
    isValidAnswer(draft, data.maxAnswerLength);
  const questionProgress = Math.min(
    100,
    Math.round(
      (data.questionNumber / Math.max(1, data.totalQuestions)) * 100,
    ),
  );

  function handleEdit() {
    if (isPublished || answer === null) return;
    setDraft(answer);
    setIsEditing(true);
    setLiveMessage("回答を修正できます");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setDraft(answer ?? "");
    setLiveMessage("修正をやめました");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;

    const nextAnswer = draft.trim();
    if (live) {
      try {
        await live.onSave(nextAnswer);
      } catch (error) {
        setLiveMessage(
          error instanceof Error ? error.message : "修正を保存できませんでした",
        );
        return;
      }
    }

    setAnswer(nextAnswer);
    setDraft(nextAnswer);
    setIsEditing(false);
    // 回答を変えたら、もう一度「確定」してもらう。
    setIsConfirmed(false);
    setLiveMessage("回答を修正しました");
  }

  function handleConfirm() {
    if (isPublished || answer === null || isEditing) return;
    setIsConfirmed(true);
    setLiveMessage("この回答で確定しました。公開までは修正できます");
  }

  const footerHelper = isPublished
    ? "結果は次の画面に表示されます"
    : isEditing
      ? "修正はすぐに反映されます"
      : answer === null
        ? "次のお題で挑戦しましょう"
        : isConfirmed
          ? "公開までは「回答を修正する」から変更できます"
          : "確定後も公開までは修正できます";

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
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: data.teamColor }}
                  />
                  <span className="truncate text-sm font-extrabold text-charcoal">
                    {data.teamName}
                  </span>
                  <span className="truncate text-caption text-pencil-gray">
                    / {data.playerName}
                  </span>
                </div>
              </div>
            </div>

            {isPublished ? (
              <span className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg bg-storybook-green px-2 text-[10px] font-extrabold text-eager-green-ink">
                <CheckIcon className="size-3.5" />
                公開
              </span>
            ) : (
              <div
                role="timer"
                aria-live="off"
                aria-label={`公開まで ${formatTime(remainingSeconds)}`}
                className="shrink-0 text-right"
              >
                <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-pencil-gray">
                  公開まで
                </p>
                <p
                  className={`font-numeric text-[24px] font-extrabold leading-tight tabular-nums ${
                    isLowTime ? "text-alert-red-ink" : "text-charcoal"
                  }`}
                >
                  {formatTime(remainingSeconds)}
                </p>
              </div>
            )}
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

        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-5 pt-5 compact:pb-3 compact:pt-3 short:pb-2 short:pt-2">
          <div className="flex min-h-6 items-center justify-between gap-3">
            <p className="text-caption font-bold text-pencil-gray">
              第{data.questionNumber}問{" "}
              <span className="font-medium text-pencil-gray">
                / 全{data.totalQuestions}問
              </span>
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#fff4e5] px-2.5 py-1 text-[11px] font-extrabold text-[#9a5b00]">
              {isPublished ? (
                <CheckIcon className="size-3.5" />
              ) : (
                <LockIcon className="size-3.5" />
              )}
              {isPublished ? "公開" : "最終確認"}
            </span>
          </div>

          <section aria-labelledby="final-check-heading" className="mt-3 short:mt-1">
            <h1
              id="final-check-heading"
              className="font-rounded text-[26px] font-extrabold leading-tight tracking-[-0.01em] text-charcoal short:text-[22px]"
            >
              {isPublished ? "回答が公開されました" : "回答を公開する前に"}
            </h1>
            <p className="mt-1 text-sm leading-6 text-pencil-gray short:hidden">
              表示されるのは、あなたの回答だけです。
            </p>
          </section>

          <section
            aria-label="お題"
            className="mt-3 flex items-start gap-2 rounded-xl bg-[#fafafa] px-3.5 py-2.5 short:hidden"
          >
            <SparklesIcon className="mt-0.5 size-4 shrink-0 text-eager-green-ink" />
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-pencil-gray">
                お題
              </p>
              <p className="text-sm font-extrabold leading-5 text-charcoal">
                {data.questionText}
              </p>
            </div>
          </section>

          <section
            aria-labelledby="your-answer-heading"
            className="mt-3 rounded-xl border-2 border-line-soft bg-paper-white p-4 compact:p-3 short:mt-1 short:p-2.5"
          >
            <div className="flex items-center justify-between gap-3">
              <h2
                id="your-answer-heading"
                className="text-sm font-extrabold text-charcoal"
              >
                あなたの回答
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f2f2f2] px-2 py-1 text-[10px] font-extrabold text-charcoal">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ backgroundColor: data.teamColor }}
                />
                {data.teamName}
              </span>
            </div>

            {isEditing ? (
              <form
                id="final-check-form"
                onSubmit={handleSave}
                className="mt-3 short:mt-2"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <label
                    htmlFor="final-check-answer"
                    className="text-xs font-extrabold text-charcoal"
                  >
                    回答を修正
                  </label>
                  <span
                    className={`font-numeric text-[11px] font-bold tabular-nums ${
                      characterCount >= data.maxAnswerLength
                        ? "text-tangerine"
                        : "text-pencil-gray"
                    }`}
                  >
                    {characterCount} / {data.maxAnswerLength}文字
                  </span>
                </div>

                <div className="relative mt-2">
                  <input
                    ref={inputRef}
                    id="final-check-answer"
                    name="final-check-answer"
                    type="text"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="答えを入力"
                    maxLength={data.maxAnswerLength}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="done"
                    className="h-14 w-full rounded-xl border-2 border-faded-gray bg-paper-white px-4 pr-12 text-[17px] font-bold text-charcoal transition-colors placeholder:font-medium placeholder:text-pencil-gray focus:border-spark-blue short:h-12"
                  />

                  {draft.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setDraft("")}
                      aria-label="入力を消す"
                      className="absolute right-1.5 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-lg text-pencil-gray transition-colors hover:bg-[#f2f2f2] hover:text-charcoal active:translate-y-[calc(-50%+1px)]"
                    >
                      <XIcon className="size-4" />
                    </button>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="mt-2 min-h-11 text-xs font-extrabold text-pencil-gray underline-offset-4 hover:underline"
                >
                  修正をやめる
                </button>
              </form>
            ) : (
              <>
                <p className="mt-2 break-words text-[28px] font-extrabold leading-tight text-charcoal short:text-[22px]">
                  {answer === null ? "回答なし" : `「${answer}」`}
                </p>

                {answer === null ? (
                  <p className="mt-2 text-caption leading-5 text-pencil-gray">
                    今回は回答が間に合いませんでした。公開までお待ちください。
                  </p>
                ) : null}

                {!isPublished && answer !== null ? (
                  <button
                    type="button"
                    onClick={handleEdit}
                    className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border-2 border-faded-gray bg-paper-white text-xs font-extrabold text-spark-blue-ink transition-transform active:translate-y-px"
                  >
                    <PencilIcon className="size-3.5" />
                    回答を修正する
                  </button>
                ) : null}

                {isPublished && answer !== null ? (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-pencil-gray">
                    <LockIcon className="size-3.5" />
                    公開済みのため修正できません
                  </p>
                ) : null}
              </>
            )}
          </section>

          {isPublished ? (
            <section
              aria-label="公開状態"
              className="mt-3 flex items-start gap-2.5 rounded-xl border-2 border-[#b8e986] bg-[#f7ffe9] p-3 short:mt-1 short:p-2"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-eager-green text-night-ink">
                <CheckIcon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-eager-green-ink">
                  回答を公開しました
                </p>
                <p className="mt-0.5 text-[11px] leading-4 text-pencil-gray short:hidden">
                  結果は次の画面に表示されます。
                </p>
              </div>
            </section>
          ) : isConfirmed && !isEditing ? (
            <section
              aria-label="確定状態"
              className="mt-3 flex items-start gap-2.5 rounded-xl border-2 border-[#b8e986] bg-[#f7ffe9] p-3 short:mt-1 short:p-2"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-eager-green text-night-ink">
                <CheckIcon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-eager-green-ink">
                  この回答で確定しました
                </p>
                <p className="mt-0.5 text-[11px] leading-4 text-pencil-gray short:hidden">
                  公開までは何度でも修正できます。
                </p>
              </div>
            </section>
          ) : null}

          <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#f7f7f7] px-3.5 py-2.5 short:mt-1 short:bg-transparent short:px-0 short:py-1">
            <LockIcon className="mt-0.5 size-4 shrink-0 text-pencil-gray" />
            <div>
              <p className="text-xs font-extrabold text-charcoal">
                他のチームの回答は公開まで見えません
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-pencil-gray short:hidden">
                公開後に結果がまとめて表示されます。
              </p>
            </div>
          </div>

          <p className="mt-2 flex items-start justify-center gap-1.5 text-center text-[11px] leading-4 text-pencil-gray short:hidden">
            <ClockIcon className="mt-0.5 size-3.5 shrink-0" />
            確定は意思表示です。時間になると自動で公開されます。
          </p>
        </main>

        <footer className="shrink-0 border-t-2 border-line-soft bg-paper-white px-5 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 short:pb-[calc(8px+env(safe-area-inset-bottom))] short:pt-2">
          {isPublished ? (
            <div className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#b8e986] bg-[#f7ffe9] text-[15px] font-extrabold text-eager-green-ink short:min-h-12">
              <CheckIcon className="size-4" />
              回答を公開しました
            </div>
          ) : isEditing ? (
            <button
              type="submit"
              form="final-check-form"
              disabled={!canSave}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-eager-green text-[17px] font-extrabold text-night-ink transition-transform active:translate-y-px disabled:bg-[#e5e5e5] disabled:text-faded-gray disabled:active:translate-y-0 short:min-h-12"
            >
              <ArrowRightIcon className="size-5" />
              修正を保存する
            </button>
          ) : answer === null ? (
            <div className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-line-soft bg-[#f7f7f7] text-[15px] font-extrabold text-pencil-gray short:min-h-12">
              <LockIcon className="size-4" />
              回答がありません
            </div>
          ) : isConfirmed ? (
            <div className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#b8e986] bg-[#f7ffe9] text-[15px] font-extrabold text-eager-green-ink short:min-h-12">
              <CheckIcon className="size-4" />
              この回答で確定済み
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConfirm}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-eager-green text-[17px] font-extrabold text-night-ink transition-transform active:translate-y-px short:min-h-12"
            >
              <CheckIcon className="size-5" />
              この内容で確定
            </button>
          )}

          <p className="mt-2 min-h-4 text-center text-[11px] font-medium leading-4 text-pencil-gray short:mt-1">
            {footerHelper}
          </p>
        </footer>

        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {liveMessage}
        </div>
      </div>
    </div>
  );
}
