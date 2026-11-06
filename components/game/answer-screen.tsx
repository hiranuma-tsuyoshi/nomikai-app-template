"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import type { AnswerScreenQuestion } from "@/lib/demo/p04";
import { countCharacters, isValidAnswer } from "@/lib/format";
import {
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  LockIcon,
  PencilIcon,
  RefreshIcon,
  SparklesIcon,
  UsersIcon,
  WifiOffIcon,
  XIcon,
} from "./icons";
import { TimerRing } from "./timer-ring";

export type AnswerScreenPreviewState =
  | "default"
  | "typing"
  | "submitted"
  | "closed"
  | "error"
  | "low_time";

type AnswerStatus = "answering" | "submitting" | "submitted" | "closed";

export type AnswerScreenLiveProps = {
  initialAnswer: string | null;
  deadlineAt: string | null;
  onSubmit: (text: string) => Promise<void>;
};

type AnswerScreenProps = {
  data: AnswerScreenQuestion;
  previewState?: AnswerScreenPreviewState;
  live?: AnswerScreenLiveProps;
};

function getInitialStatus(
  previewState: AnswerScreenPreviewState,
): AnswerStatus {
  if (previewState === "submitted") return "submitted";
  if (previewState === "closed") return "closed";
  return "answering";
}

function secondsUntil(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
}

export function AnswerScreen({
  data,
  previewState = "default",
  live,
}: AnswerScreenProps) {
  const liveRemaining = live ? secondsUntil(live.deadlineAt) : null;
  const liveStatus: AnswerStatus | null = live
    ? liveRemaining === 0
      ? "closed"
      : live.initialAnswer
        ? "submitted"
        : "answering"
    : null;
  const initialStatus = liveStatus ?? getInitialStatus(previewState);
  const initialRemaining =
    live !== undefined
      ? liveRemaining ?? 0
      : previewState === "closed"
        ? 0
        : previewState === "low_time"
          ? 9
          : data.initialRemainingSeconds;
  const initialAnswer = live
    ? ""
    : previewState === "typing" || previewState === "error"
      ? "カレー"
      : "";
  const initialSubmittedAnswer = live
    ? live.initialAnswer ?? ""
    : previewState === "submitted" || previewState === "closed"
      ? "カレー"
      : "";

  const [remainingSeconds, setRemainingSeconds] = useState(initialRemaining);
  const [answer, setAnswer] = useState(initialAnswer);
  const [status, setStatus] = useState<AnswerStatus>(initialStatus);
  const [submittedAnswer, setSubmittedAnswer] = useState(
    initialSubmittedAnswer,
  );
  const [answeredCount, setAnsweredCount] = useState(data.answerCount);
  const [isOffline, setIsOffline] = useState(previewState === "error");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const deadlineRef = useRef<number | null>(null);
  const countedRef = useRef(
    initialStatus === "submitted" || initialStatus === "closed",
  );
  const lowAnnouncedRef = useRef(false);

  useEffect(() => {
    if (initialStatus === "closed") return;

    deadlineRef.current = Date.now() + initialRemaining * 1000;
    const interval = window.setInterval(() => {
      const deadline = deadlineRef.current;
      if (deadline === null) return;

      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemainingSeconds(next);

      if (next === 0) {
        window.clearInterval(interval);
        setStatus("closed");
        setLiveMessage("回答受付が終了しました");
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [initialRemaining, initialStatus]);

  useEffect(() => {
    if (
      remainingSeconds > 0 &&
      remainingSeconds <= 10 &&
      !lowAnnouncedRef.current
    ) {
      lowAnnouncedRef.current = true;
      setLiveMessage("残り10秒です");
    }
  }, [remainingSeconds]);

  const characterCount = countCharacters(answer);
  const isLowTime =
    remainingSeconds > 0 &&
    remainingSeconds <= 10 &&
    status !== "closed";
  const isOverLimit = characterCount > data.maxAnswerLength;
  const canSubmit =
    status === "answering" &&
    remainingSeconds > 0 &&
    !isOffline &&
    !isOverLimit &&
    isValidAnswer(answer, data.maxAnswerLength);
  const answeredPercent = Math.min(
    100,
    Math.round(
      (answeredCount / Math.max(1, data.participantCount)) * 100,
    ),
  );
  const questionProgress = Math.min(
    100,
    Math.round(
      (data.questionNumber / Math.max(1, data.totalQuestions)) * 100,
    ),
  );
  const answerErrorId = errorMessage ? "answer-error" : undefined;
  const answerDescriptionIds = [
    "answer-help",
    answerErrorId,
  ]
    .filter(Boolean)
    .join(" ");

  function handleClear() {
    setAnswer("");
    setErrorMessage(null);
    inputRef.current?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setStatus("submitting");
    setErrorMessage(null);

    try {
      if (live) {
        await live.onSubmit(answer.trim());
      } else {
        // プレビューでは送信の間合いだけ再現する。
        await new Promise((resolve) => window.setTimeout(resolve, 650));
      }

      const nextAnswer = answer.trim();
      const liveDeadline = live?.deadlineAt
        ? new Date(live.deadlineAt).getTime()
        : null;
      const deadline = liveDeadline ?? deadlineRef.current;
      const isPastDeadline = deadline !== null && Date.now() >= deadline;

      setSubmittedAnswer(nextAnswer);
      setAnswer(nextAnswer);

      if (isPastDeadline) {
        // 送信中に締切をまたいだ場合、回答は保持しつつ受付終了として扱う。
        setStatus("closed");
        setLiveMessage("回答受付が終了しました");
      } else {
        setStatus("submitted");
        setLiveMessage("回答を送信しました");
      }

      if (!countedRef.current) {
        countedRef.current = true;
        setAnsweredCount((count) =>
          Math.min(data.participantCount, count + 1),
        );
      }

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch (error) {
      setStatus("answering");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "送信できませんでした。通信を確認して、もう一度お試しください。",
      );
      setLiveMessage("送信できませんでした");
    }
  }

  function handleEdit(event: MouseEvent<HTMLButtonElement>) {
    // 同じ位置で「修正」ボタンが「送信」ボタンに入れ替わると、
    // クリックの既定動作が新しいボタンに移る場合がある。
    // クリック処理が終わってから編集状態へ切り替える。
    event.preventDefault();

    if (remainingSeconds <= 0) {
      setStatus("closed");
      setLiveMessage("回答受付が終了しました");
      return;
    }

    setLiveMessage("回答を修正できます");

    window.setTimeout(() => {
      setStatus("answering");
      setAnswer(submittedAnswer);
      setErrorMessage(null);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }, 0);
  }

  function handleRetry() {
    setIsOffline(false);
    setErrorMessage(null);
    setLiveMessage("再接続しました");
  }

  const footerHelper =
    status === "submitting"
      ? "送信中です。画面を閉じないでください"
      : status === "submitted"
        ? "締切までは何度でも修正できます"
        : status === "closed"
          ? "回答が公開されるまでお待ちください"
          : isOffline
            ? "通信が戻ると回答できます"
            : answer.trim().length === 0
              ? "回答を入力すると送信できます"
              : "締切まで何度でも修正できます";

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

            <TimerRing
              remainingSeconds={remainingSeconds}
              totalSeconds={data.timeLimitSeconds}
              isLow={isLowTime}
              isClosed={status === "closed"}
            />
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

        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-5 pt-5 compact:pb-3 compact:pt-3 short:pb-3 short:pt-3">
          <div className="flex min-h-6 items-center justify-between gap-3">
            <p className="text-caption font-bold text-pencil-gray">
              第{data.questionNumber}問{" "}
              <span className="font-medium text-pencil-gray">
                / 全{data.totalQuestions}問
              </span>
            </p>

            {isLowTime ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#fff0f0] px-2.5 py-1 text-[11px] font-extrabold text-alert-red-ink">
                <ClockIcon className="size-3.5" />
                あと{remainingSeconds}秒
              </span>
            ) : null}
          </div>

          <section aria-labelledby="question-heading" className="mt-3 short:mt-2">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-storybook-green text-eager-green-ink">
                <SparklesIcon className="size-4" />
              </span>
              <span className="text-caption font-extrabold text-eager-green-ink">
                お題
              </span>
            </div>
            <h1
              id="question-heading"
              className="text-balance font-rounded text-[28px] font-extrabold leading-[1.35] tracking-[-0.01em] text-charcoal short:text-[24px]"
            >
              {data.questionText}
            </h1>
            <p className="mt-2 text-sm leading-6 text-pencil-gray short:hidden">
              チームの答えがどれだけ揃うかを競います。
            </p>
          </section>

          {isOffline && status !== "closed" ? (
            <div
              role="status"
              className="mt-4 flex items-center justify-between gap-3 rounded-xl border-2 border-[#ffd0d0] bg-[#fff5f5] p-3"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-alert-red-ink">
                  <WifiOffIcon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-alert-red-ink">
                    再接続中...
                  </p>
                  <p className="mt-0.5 text-[11px] leading-4 text-pencil-gray">
                    入力内容は保持されています
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border-2 border-[#ffb4b4] bg-white px-3 text-[11px] font-extrabold text-alert-red-ink transition-transform active:translate-y-px"
              >
                <RefreshIcon className="size-3.5" />
                再試行
              </button>
            </div>
          ) : null}

          <div className="mt-4">
            {status === "submitted" ? (
              <section
                aria-labelledby="submitted-heading"
                className="animate-rise-in rounded-xl border-2 border-[#b8e986] bg-[#f7ffe9] p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="animate-check-pop grid size-11 shrink-0 place-items-center rounded-full bg-eager-green text-night-ink">
                    <CheckIcon className="size-6" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-caption font-extrabold text-eager-green-ink">
                      送信済み
                    </p>
                    <h2
                      id="submitted-heading"
                      className="mt-0.5 text-lg font-extrabold text-charcoal"
                    >
                      回答を受け付けました
                    </h2>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border-2 border-[#d7e8c0] bg-white px-4 py-3">
                  <p className="text-caption font-bold text-pencil-gray">
                    あなたの回答
                  </p>
                  <p className="mt-0.5 break-words text-2xl font-extrabold text-charcoal">
                    「{submittedAnswer}」
                  </p>
                </div>

                <p className="mt-3 text-caption leading-5 text-pencil-gray">
                  公開までお待ちください。締切前なら下のボタンから修正できます。
                </p>
              </section>
            ) : status === "closed" ? (
              <section
                aria-labelledby="closed-heading"
                className="rounded-xl border-2 border-line-soft bg-[#f7f7f7] p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-pencil-gray">
                    <ClockIcon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-numeric text-[10px] font-extrabold uppercase tracking-[0.16em] text-pencil-gray">
                      Time up
                    </p>
                    <h2
                      id="closed-heading"
                      className="mt-0.5 text-lg font-extrabold text-charcoal"
                    >
                      回答受付が終了しました
                    </h2>
                  </div>
                </div>

                {submittedAnswer ? (
                  <div className="mt-4 rounded-xl border-2 border-line-soft bg-white px-4 py-3">
                    <p className="text-caption font-bold text-pencil-gray">
                      あなたの回答
                    </p>
                    <p className="mt-0.5 break-words text-xl font-extrabold text-charcoal">
                      「{submittedAnswer}」
                    </p>
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-pencil-gray">
                    今回は回答が間に合いませんでした。次のお題で挑戦しましょう。
                  </p>
                )}

                <p className="mt-3 text-caption leading-5 text-pencil-gray">
                  まもなく回答が公開されます。
                </p>
              </section>
            ) : (
              <form
                id="answer-form"
                onSubmit={handleSubmit}
                aria-busy={status === "submitting"}
                className="rounded-xl border-2 border-line-soft bg-paper-white p-4 compact:p-3 short:p-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <label
                    htmlFor="answer"
                    className="text-sm font-extrabold text-charcoal"
                  >
                    あなたの回答
                  </label>
                  <span
                    className={`font-numeric text-caption font-bold tabular-nums ${
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
                    id="answer"
                    name="answer"
                    type="text"
                    value={answer}
                    onChange={(event) => {
                      setAnswer(event.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="答えを入力"
                    maxLength={data.maxAnswerLength}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="send"
                    disabled={status === "submitting"}
                    aria-invalid={Boolean(errorMessage)}
                    aria-describedby={answerDescriptionIds}
                    className={`h-14 w-full rounded-xl border-2 bg-paper-white px-4 pr-12 text-[17px] font-bold text-charcoal transition-colors placeholder:font-medium placeholder:text-pencil-gray disabled:bg-[#f7f7f7] short:h-12 ${
                      errorMessage
                        ? "border-alert-red focus:border-alert-red"
                        : "border-faded-gray focus:border-spark-blue"
                    }`}
                  />

                  {answer.length > 0 && status !== "submitting" ? (
                    <button
                      type="button"
                      onClick={handleClear}
                      aria-label="入力を消す"
                      className="absolute right-1.5 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-lg text-pencil-gray transition-colors hover:bg-[#f2f2f2] hover:text-charcoal active:translate-y-[calc(-50%+1px)]"
                    >
                      <XIcon className="size-4" />
                    </button>
                  ) : null}
                </div>

                {errorMessage ? (
                  <p
                    id="answer-error"
                    role="alert"
                    className="mt-2 text-caption font-bold leading-5 text-alert-red-ink"
                  >
                    {errorMessage}
                  </p>
                ) : null}

                <p
                  id="answer-help"
                  className="mt-2 text-caption leading-5 text-pencil-gray short:hidden"
                >
                  短く答えると、チームの答えが揃いやすくなります。
                </p>
              </form>
            )}
          </div>

          <section
            aria-label="回答状況"
            className="mt-4 rounded-xl border-2 border-line-soft bg-paper-white p-4 compact:mt-3 compact:p-3 short:mt-3 short:p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-1.5 text-sm font-extrabold text-charcoal">
                <UsersIcon className="size-4 text-pencil-gray" />
                回答済み
              </p>
              <p className="font-numeric text-sm font-extrabold tabular-nums text-charcoal">
                {answeredCount}{" "}
                <span className="text-pencil-gray">
                  / {data.participantCount}人
                </span>
              </p>
            </div>

            <div
              role="progressbar"
              aria-label="回答済み人数"
              aria-valuemin={0}
              aria-valuemax={data.participantCount}
              aria-valuenow={answeredCount}
              aria-valuetext={`${answeredCount} / ${data.participantCount}人`}
              className="mt-2 h-2 overflow-hidden rounded-full bg-line-soft"
            >
              <div
                className="h-full rounded-full bg-eager-green transition-[width] duration-500"
                style={{ width: `${answeredPercent}%` }}
              />
            </div>

            <p className="mt-2 text-caption text-pencil-gray">
              {answeredCount >= data.participantCount
                ? "全員回答済み"
                : status === "closed"
                  ? `未回答${Math.max(0, data.participantCount - answeredCount)}人`
                  : `あと${Math.max(0, data.participantCount - answeredCount)}人`}
            </p>
          </section>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-pencil-gray short:mt-2">
            <LockIcon className="size-3.5" />
            回答は公開まで他の人に見えません
          </p>
        </main>

        <footer className="shrink-0 border-t-2 border-line-soft bg-paper-white px-5 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 short:pb-[calc(8px+env(safe-area-inset-bottom))] short:pt-2">
          {status === "submitted" ? (
            <button
              type="button"
              onClick={handleEdit}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-faded-gray bg-paper-white text-[15px] font-extrabold text-spark-blue-ink transition-transform active:translate-y-px short:min-h-12"
            >
              <PencilIcon className="size-4" />
              回答を修正する
            </button>
          ) : status === "closed" ? (
            <div className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-line-soft bg-[#f7f7f7] text-[15px] font-extrabold text-pencil-gray short:min-h-12">
              <LockIcon className="size-4" />
              回答受付は終了しました
            </div>
          ) : (
            <button
              type="submit"
              form="answer-form"
              disabled={!canSubmit}
              aria-busy={status === "submitting"}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-eager-green text-[17px] font-extrabold text-night-ink transition-transform active:translate-y-px disabled:bg-[#e5e5e5] disabled:text-faded-gray disabled:active:translate-y-0 short:min-h-12"
            >
              {status === "submitting" ? (
                <span
                  aria-hidden="true"
                  className="size-5 animate-spin rounded-full border-[3px] border-night-ink/20 border-t-night-ink"
                />
              ) : (
                <ArrowRightIcon className="size-5" />
              )}
              {status === "submitting"
                ? "送信中..."
                : isOffline
                  ? "再接続を待っています"
                  : "回答する"}
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
