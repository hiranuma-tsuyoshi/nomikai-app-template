"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  QUESTION_TEXT_MAX,
  QUESTION_TIME_DEFAULT,
  QUESTION_TIME_MAX,
  QUESTION_TIME_MIN,
  formatQuestionTotal,
  isQuestionTextValid,
  parseQuestionTimeLimit,
  seedQuestions,
  type Question,
} from "@/lib/questions";
import { countCharacters } from "@/lib/format";
import {
  ApiRequestError,
  postJson,
  putJson,
} from "@/lib/client/use-live-data";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  LockIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from "../game/icons";

export type QuestionPreviewState = "default" | "empty" | "editing" | "delete";

type QuestionManagerProps = {
  previewMode?: boolean;
  previewState?: QuestionPreviewState;
};

type EditorState =
  | { mode: "create" }
  | { mode: "edit"; id: string }
  | null;

type QuestionsApiResponse = {
  questions: Array<{
    id: string;
    text: string;
    timeLimitSeconds: number;
    orderIndex?: number;
  }>;
  frozen: boolean;
};

function cloneSeedQuestions(): Question[] {
  return seedQuestions.map((question) => ({ ...question }));
}

function getInitialQuestions(
  previewMode: boolean,
  previewState: QuestionPreviewState,
): Question[] {
  if (!previewMode) return [];
  return previewState === "empty" ? [] : cloneSeedQuestions();
}

function getInitialEditor(
  previewMode: boolean,
  previewState: QuestionPreviewState,
): EditorState {
  return previewMode && previewState === "editing"
    ? { mode: "edit", id: "question-3" }
    : null;
}

function createQuestionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `question-${crypto.randomUUID()}`;
  }

  return `question-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function QuestionManager({
  previewMode = false,
  previewState = "default",
}: QuestionManagerProps) {
  const [questions, setQuestions] = useState<Question[]>(() =>
    getInitialQuestions(previewMode, previewState),
  );
  const [hydrated, setHydrated] = useState(previewMode);
  const [editor, setEditor] = useState<EditorState>(() =>
    getInitialEditor(previewMode, previewState),
  );
  const [text, setText] = useState(() =>
    previewMode && previewState === "editing"
      ? seedQuestions[2].text
      : "",
  );
  const [timeLimit, setTimeLimit] = useState(() =>
    previewMode && previewState === "editing"
      ? String(seedQuestions[2].timeLimitSeconds)
      : String(QUESTION_TIME_DEFAULT),
  );
  const [textTouched, setTextTouched] = useState(false);
  const [timeTouched, setTimeTouched] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(() =>
    previewMode && previewState === "delete" ? "question-2" : null,
  );
  const [storageError, setStorageError] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const [frozen, setFrozen] = useState(false);
  const [loading, setLoading] = useState(!previewMode);
  const [saving, setSaving] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [authKey, setAuthKey] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement | null>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement | null>(null);
  const addButtonRef = useRef<HTMLButtonElement | null>(null);

  const refreshQuestions = useCallback(async () => {
    if (previewMode) return;

    setLoading(true);
    setStorageError(null);
    try {
      const response = await fetch("/api/host/questions", {
        cache: "no-store",
        credentials: "include",
      });
      const body = (await response.json().catch(() => ({}))) as
        | QuestionsApiResponse
        | { error?: string };

      if (response.status === 401) {
        setAuthRequired(true);
        return;
      }
      if (!response.ok) {
        throw new Error(
          (body as { error?: string }).error ?? "お題を読み込めませんでした",
        );
      }

      const data = body as QuestionsApiResponse;
      setQuestions(
        data.questions.map(({ id, text, timeLimitSeconds }) => ({
          id,
          text,
          timeLimitSeconds,
        })),
      );
      setFrozen(data.frozen);
      setAuthRequired(false);
      setHydrated(true);
    } catch (error) {
      setStorageError(
        error instanceof Error
          ? error.message
          : "お題を読み込めませんでした。通信を確認してください。",
      );
    } finally {
      setLoading(false);
    }
  }, [previewMode]);

  useEffect(() => {
    if (previewMode) return;
    void refreshQuestions();
  }, [previewMode, refreshQuestions]);

  useEffect(() => {
    if (!editor) return;
    textInputRef.current?.focus();
  }, [editor]);

  useEffect(() => {
    if (deleteId) cancelDeleteRef.current?.focus();
  }, [deleteId]);

  const editingIndex =
    editor?.mode === "edit"
      ? questions.findIndex((question) => question.id === editor.id)
      : -1;
  const deletingQuestion =
    questions.find((question) => question.id === deleteId) ?? null;
  const textLength = countCharacters(text);
  const parsedTimeLimit = parseQuestionTimeLimit(timeLimit);
  const textError =
    text.trim().length === 0
      ? "お題を入力してください"
      : textLength > QUESTION_TEXT_MAX
        ? `お題は${QUESTION_TEXT_MAX}文字以内で入力してください`
        : null;
  const timeError =
    parsedTimeLimit === null
      ? `制限時間は${QUESTION_TIME_MIN}〜${QUESTION_TIME_MAX}秒の整数で入力してください`
      : null;
  const showTextError =
    textTouched ||
    textLength > QUESTION_TEXT_MAX ||
    (text.length > 0 && text.trim().length === 0);
  const showTimeError =
    timeTouched ||
    (timeLimit !== "" && parsedTimeLimit === null);
  const canSave = isQuestionTextValid(text) && parsedTimeLimit !== null;
  const totalTime = formatQuestionTotal(questions);
  const longestTime =
    questions.length > 0
      ? Math.max(...questions.map((question) => question.timeLimitSeconds))
      : 0;

  async function commitQuestions(
    next: Question[],
    message: string,
  ): Promise<boolean> {
    setStorageError(null);

    if (previewMode) {
      setQuestions(next);
      setLiveMessage(message);
      return true;
    }

    setSaving(true);
    try {
      const data = await putJson<QuestionsApiResponse>("/api/host/questions", {
        questions: next.map(({ id, text, timeLimitSeconds }) => ({
          id,
          text,
          timeLimitSeconds,
        })),
      });
      setQuestions(
        data.questions.map(({ id, text, timeLimitSeconds }) => ({
          id,
          text,
          timeLimitSeconds,
        })),
      );
      setFrozen(data.frozen);
      setLiveMessage(message);
      return true;
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        setAuthRequired(true);
      }
      setStorageError(
        error instanceof Error ? error.message : "変更を保存できませんでした",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authKey.trim() || authBusy) return;

    setAuthBusy(true);
    setAuthError(null);
    try {
      await postJson("/api/host/auth", { key: authKey.trim() });
      setAuthKey("");
      setAuthRequired(false);
      await refreshQuestions();
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "司会者キーを確認してください",
      );
    } finally {
      setAuthBusy(false);
    }
  }

  function startCreate() {
    if (frozen || saving) return;
    setEditor({ mode: "create" });
    setText("");
    setTimeLimit(String(QUESTION_TIME_DEFAULT));
    setTextTouched(false);
    setTimeTouched(false);
    setStorageError(null);
  }

  function startEdit(question: Question) {
    if (frozen || saving) return;
    setEditor({ mode: "edit", id: question.id });
    setText(question.text);
    setTimeLimit(String(question.timeLimitSeconds));
    setTextTouched(false);
    setTimeTouched(false);
    setStorageError(null);
  }

  function closeEditor() {
    setEditor(null);
    setTextTouched(false);
    setTimeTouched(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTextTouched(true);
    setTimeTouched(true);

    if (!canSave || !editor || parsedTimeLimit === null || saving) return;

    const trimmedText = text.trim();
    let saved = false;

    if (editor.mode === "create") {
      const question: Question = {
        id: createQuestionId(),
        text: trimmedText,
        timeLimitSeconds: parsedTimeLimit,
      };
      saved = await commitQuestions(
        [...questions, question],
        `お題を追加しました。全${questions.length + 1}問です`,
      );
    } else {
      const index = questions.findIndex(
        (question) => question.id === editor.id,
      );
      if (index < 0) return;

      const nextQuestions = questions.map((question) =>
        question.id === editor.id
          ? {
              ...question,
              text: trimmedText,
              timeLimitSeconds: parsedTimeLimit,
            }
          : question,
      );
      saved = await commitQuestions(
        nextQuestions,
        `第${index + 1}問のお題を更新しました`,
      );
    }

    if (saved) closeEditor();
  }

  function moveQuestion(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= questions.length || saving || frozen) return;

    const nextQuestions = [...questions];
    const [moved] = nextQuestions.splice(index, 1);
    nextQuestions.splice(target, 0, moved);
    void commitQuestions(
      nextQuestions,
      `「${moved.text}」を${offset === -1 ? "上" : "下"}へ移動しました。第${target + 1}問です`,
    );
  }

  function requestDelete(questionId: string) {
    if (frozen || saving) return;
    setDeleteId(questionId);
  }

  function cancelDelete() {
    setDeleteId(null);
  }

  async function confirmDelete() {
    if (!deletingQuestion || saving || frozen) return;

    const nextQuestions = questions.filter(
      (question) => question.id !== deletingQuestion.id,
    );
    const saved = await commitQuestions(
      nextQuestions,
      `「${deletingQuestion.text}」を削除しました。全${nextQuestions.length}問です`,
    );
    if (!saved) return;

    if (editor?.mode === "edit" && editor.id === deletingQuestion.id) {
      closeEditor();
    }
    setDeleteId(null);
    requestAnimationFrame(() => addButtonRef.current?.focus());
  }

  function handleDeleteDialogKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelDelete();
    }
  }

  if (authRequired) {
    return (
      <div className="grid min-h-dvh place-items-center bg-meadow-mist px-5">
        <form onSubmit={handleAuth} className="w-full max-w-[390px] card p-6">
          <div className="text-center">
            <span
              aria-hidden="true"
              className="mx-auto grid size-14 place-items-center rounded-2xl bg-eager-green text-2xl font-extrabold text-night-ink"
            >
              以
            </span>
            <h1 className="mt-4 text-xl font-extrabold text-charcoal">
              司会者ログイン
            </h1>
            <p className="mt-2 text-sm leading-6 text-pencil-gray">
              お題を編集するには、本番用の司会者キーが必要です。
            </p>
          </div>

          <label
            htmlFor="questions-host-key"
            className="mt-5 block text-sm font-extrabold text-charcoal"
          >
            司会者キー
          </label>
          <input
            id="questions-host-key"
            type="password"
            value={authKey}
            onChange={(event) => setAuthKey(event.target.value)}
            autoComplete="current-password"
            className="input mt-1.5"
          />

          {authError ? (
            <p role="alert" className="mt-2 text-xs font-bold text-alert-red-ink">
              {authError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={authBusy || !authKey.trim()}
            className="btn btn-primary mt-5 w-full disabled:bg-[#e5e5e5] disabled:text-faded-gray"
          >
            {authBusy ? "確認中…" : "ログイン"}
          </button>
          <Link
            href="/host"
            className="mt-3 block text-center text-xs font-bold text-spark-blue-ink underline"
          >
            進行管理へ戻る
          </Link>
        </form>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-meadow-mist px-6">
        <div className="text-center">
          <span
            aria-hidden="true"
            className="mx-auto block size-10 animate-spin rounded-full border-4 border-line-soft border-t-eager-green"
          />
          <p className="mt-4 text-sm font-bold text-pencil-gray">
            お題を読み込んでいます…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-hydrated={hydrated ? "true" : "false"}
      className="min-h-full bg-meadow-mist"
    >
      <header className="border-b-2 border-line-soft bg-paper-white">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-5 py-3 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-eager-green text-lg font-extrabold text-night-ink"
            >
              以
            </span>
            <div className="min-w-0">
              <p className="font-numeric text-[10px] font-extrabold uppercase tracking-[0.18em] text-pencil-gray">
                Host Console
              </p>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold text-charcoal">
                  お題管理
                </h1>
                <span className="rounded bg-[#f2f2f2] px-1.5 py-0.5 font-numeric text-[11px] font-extrabold text-pencil-gray">
                  全{questions.length}問
                </span>
                {frozen ? (
                  <span className="rounded bg-[#fff4e5] px-1.5 py-0.5 text-[10px] font-extrabold text-[#9a5b00]">
                    変更不可
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-4">
            <div className="hidden items-center gap-4 md:flex">
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-pencil-gray">
                  お題
                </p>
                <p className="font-numeric text-sm font-extrabold tabular-nums text-charcoal">
                  {questions.length}問
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-pencil-gray">
                  合計時間
                </p>
                <p className="font-numeric text-sm font-extrabold tabular-nums text-charcoal">
                  {totalTime}
                </p>
              </div>
            </div>
            <Link
              href="/host"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border-2 border-faded-gray bg-paper-white px-3 text-xs font-extrabold text-spark-blue-ink transition-colors hover:bg-[#f7f7f7]"
            >
              進行管理へ
              <ArrowRightIcon className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1440px] gap-4 px-5 py-4 lg:px-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          {frozen ? (
            <div
              role="status"
              className="flex items-start gap-2 rounded-xl border-2 border-[#ffd9a8] bg-[#fff8ee] px-4 py-3 text-xs font-bold leading-5 text-[#9a5b00]"
            >
              <LockIcon className="mt-0.5 size-4 shrink-0" />
              ゲーム開始後のため、お題は変更できません。ゲームをリセットすると編集できます。
            </div>
          ) : null}

          {storageError ? (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-[#ffd0d0] bg-[#fff8f8] px-4 py-3 text-xs font-bold leading-5 text-alert-red-ink"
            >
              <AlertTriangleIcon className="size-4 shrink-0" />
              <span className="min-w-0 flex-1">{storageError}</span>
              <button
                type="button"
                onClick={() => void refreshQuestions()}
                className="rounded-lg border-2 border-[#ffd0d0] px-2.5 py-1 text-[11px] font-extrabold"
              >
                再読み込み
              </button>
            </div>
          ) : null}

          <section aria-labelledby="question-list-heading" className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2
                  id="question-list-heading"
                  className="text-lg font-extrabold text-charcoal"
                >
                  お題一覧
                </h2>
                <p className="mt-0.5 text-caption text-pencil-gray">
                  上から順に出題されます。編集・削除・並べ替えができます。
                </p>
              </div>
              <button
                ref={addButtonRef}
                type="button"
                onClick={startCreate}
                disabled={frozen || saving || editor !== null}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-eager-green px-4 text-sm font-extrabold text-night-ink transition-transform active:translate-y-px disabled:bg-[#e5e5e5] disabled:text-faded-gray disabled:active:translate-y-0"
              >
                <PlusIcon className="size-4" />
                お題を追加
              </button>
            </div>

            {questions.length === 0 ? (
              <div className="mt-4 rounded-xl border-2 border-dashed border-faded-gray bg-[#fafafa] px-6 py-10 text-center">
                <p className="text-sm font-extrabold text-charcoal">
                  お題がありません
                </p>
                <p className="mt-1 text-xs leading-5 text-pencil-gray">
                  ゲームを始めるには、お題を1問以上追加してください。
                </p>
                <button
                  type="button"
                  onClick={startCreate}
                  disabled={frozen || saving}
                  className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-eager-green px-4 text-xs font-extrabold text-night-ink transition-transform active:translate-y-px disabled:bg-[#e5e5e5] disabled:text-faded-gray disabled:active:translate-y-0"
                >
                  <PlusIcon className="size-4" />
                  最初のお題を追加
                </button>
              </div>
            ) : (
              <ol aria-label="お題一覧" className="mt-3 space-y-2">
                {questions.map((question, index) => {
                  const isEditing =
                    editor?.mode === "edit" && editor.id === question.id;
                  const isFirst = index === 0;
                  const isLast = index === questions.length - 1;

                  return (
                    <li
                      key={question.id}
                      data-question-id={question.id}
                      data-editing={isEditing ? "true" : undefined}
                      className={`rounded-xl border-2 transition-colors ${
                        isEditing
                          ? "border-eager-green bg-[#fbfff5]"
                          : "border-line-soft bg-paper-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#f2f2f2] font-numeric text-sm font-extrabold tabular-nums text-pencil-gray">
                          {index + 1}
                        </span>

                        <div className="min-w-0 flex-1 basis-[240px]">
                          <p className="break-words text-sm font-extrabold leading-6 text-charcoal">
                            {question.text}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-pencil-gray">
                            <ClockIcon className="size-3.5" />
                            制限時間 {question.timeLimitSeconds}秒
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <div className="flex items-center rounded-lg border-2 border-line-soft">
                            <button
                              type="button"
                              onClick={() => moveQuestion(index, -1)}
                              disabled={isFirst || frozen || saving}
                              aria-label={`「${question.text}」を上へ移動`}
                              className="grid size-9 place-items-center rounded-l-md text-pencil-gray transition-colors hover:bg-[#f7f7f7] disabled:cursor-not-allowed disabled:text-[#d8d8d8] disabled:hover:bg-transparent"
                            >
                              <ChevronUpIcon className="size-4" />
                            </button>
                            <span
                              aria-hidden="true"
                              className="h-6 w-px bg-line-soft"
                            />
                            <button
                              type="button"
                              onClick={() => moveQuestion(index, 1)}
                              disabled={isLast || frozen || saving}
                              aria-label={`「${question.text}」を下へ移動`}
                              className="grid size-9 place-items-center rounded-r-md text-pencil-gray transition-colors hover:bg-[#f7f7f7] disabled:cursor-not-allowed disabled:text-[#d8d8d8] disabled:hover:bg-transparent"
                            >
                              <ChevronDownIcon className="size-4" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => startEdit(question)}
                            disabled={frozen || saving}
                            className="inline-flex min-h-9 items-center gap-1 rounded-lg border-2 border-line-soft px-2.5 text-[11px] font-extrabold text-spark-blue-ink transition-colors hover:bg-[#f2fbff] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <PencilIcon className="size-3.5" />
                            編集
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDelete(question.id)}
                            disabled={frozen || saving}
                            className="inline-flex min-h-9 items-center gap-1 rounded-lg border-2 border-[#ffd0d0] px-2.5 text-[11px] font-extrabold text-alert-red-ink transition-colors hover:bg-[#fff5f5] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <TrashIcon className="size-3.5" />
                            削除
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          {editor ? (
            <section
              aria-labelledby="question-editor-heading"
              className="card p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-numeric text-[10px] font-extrabold uppercase tracking-[0.16em] text-pencil-gray">
                    {editor.mode === "create"
                      ? "New Question"
                      : `Question ${editingIndex + 1}`}
                  </p>
                  <h2
                    id="question-editor-heading"
                    className="mt-1 text-lg font-extrabold text-charcoal"
                  >
                    {editor.mode === "create"
                      ? "お題を追加"
                      : `第${editingIndex + 1}問を編集`}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeEditor}
                  aria-label="編集を閉じる"
                  className="grid size-9 place-items-center rounded-lg border-2 border-line-soft text-pencil-gray transition-colors hover:bg-[#f7f7f7]"
                >
                  <XIcon className="size-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-4" noValidate>
                <div className="flex items-baseline justify-between gap-2">
                  <label
                    htmlFor="question-text"
                    className="text-xs font-extrabold text-charcoal"
                  >
                    お題
                  </label>
                  <span
                    data-question-text-counter="true"
                    className={`font-numeric text-[10px] font-bold tabular-nums ${
                      textLength > QUESTION_TEXT_MAX
                        ? "text-alert-red-ink"
                        : "text-pencil-gray"
                    }`}
                  >
                    {textLength} / {QUESTION_TEXT_MAX}文字
                  </span>
                </div>
                <textarea
                  ref={textInputRef}
                  id="question-text"
                  name="question-text"
                  rows={3}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onBlur={() => setTextTouched(true)}
                  aria-invalid={showTextError && textError ? true : undefined}
                  aria-describedby={
                    showTextError && textError
                      ? "question-text-help question-text-error"
                      : "question-text-help"
                  }
                  placeholder="例: 朝ごはんといえば？"
                  className="mt-1 w-full resize-none rounded-xl border-2 border-faded-gray bg-paper-white px-3 py-2.5 text-sm font-bold leading-6 text-charcoal placeholder:font-medium placeholder:text-pencil-gray focus:border-spark-blue focus:outline-none"
                />
                <p
                  id="question-text-help"
                  className="mt-1 text-[10px] leading-4 text-pencil-gray"
                >
                  1〜{QUESTION_TEXT_MAX}文字。前後の空白は保存時に除去します。
                </p>
                {showTextError && textError ? (
                  <p
                    id="question-text-error"
                    role="alert"
                    className="mt-1 text-[11px] font-bold text-alert-red-ink"
                  >
                    {textError}
                  </p>
                ) : null}

                <div className="mt-4">
                  <label
                    htmlFor="question-time-limit"
                    className="text-xs font-extrabold text-charcoal"
                  >
                    制限時間
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      id="question-time-limit"
                      name="question-time-limit"
                      type="number"
                      inputMode="numeric"
                      min={QUESTION_TIME_MIN}
                      max={QUESTION_TIME_MAX}
                      step={1}
                      value={timeLimit}
                      onChange={(event) => setTimeLimit(event.target.value)}
                      onBlur={() => setTimeTouched(true)}
                      aria-invalid={showTimeError && timeError ? true : undefined}
                      aria-describedby={
                        showTimeError && timeError
                          ? "question-time-help question-time-error"
                          : "question-time-help"
                      }
                      className="h-11 w-28 rounded-xl border-2 border-faded-gray bg-paper-white px-3 font-numeric text-sm font-extrabold tabular-nums text-charcoal focus:border-spark-blue focus:outline-none"
                    />
                    <span className="text-xs font-bold text-pencil-gray">秒</span>
                  </div>
                  <p
                    id="question-time-help"
                    className="mt-1 text-[10px] leading-4 text-pencil-gray"
                  >
                    {QUESTION_TIME_MIN}〜{QUESTION_TIME_MAX}秒の整数。
                  </p>
                  {showTimeError && timeError ? (
                    <p
                      id="question-time-error"
                      role="alert"
                      className="mt-1 text-[11px] font-bold text-alert-red-ink"
                    >
                      {timeError}
                    </p>
                  ) : null}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    type="submit"
                    disabled={!canSave || saving || frozen}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-eager-green px-3 text-xs font-extrabold text-night-ink transition-transform active:translate-y-px disabled:bg-[#e5e5e5] disabled:text-faded-gray disabled:active:translate-y-0"
                  >
                    <CheckIcon className="size-4" />
                    {saving ? "保存中…" : "保存する"}
                  </button>
                  <button
                    type="button"
                    onClick={closeEditor}
                    className="min-h-11 rounded-xl border-2 border-faded-gray bg-paper-white px-3 text-xs font-extrabold text-charcoal transition-colors hover:bg-[#f7f7f7]"
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            </section>
          ) : (
            <section
              aria-labelledby="question-rules-heading"
              className="card p-5"
            >
              <h2
                id="question-rules-heading"
                className="text-lg font-extrabold text-charcoal"
              >
                お題の設定
              </h2>

              <dl className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-[#fafafa] px-2 py-2 text-center">
                  <dt className="text-[10px] font-bold text-pencil-gray">
                    問題数
                  </dt>
                  <dd className="font-numeric text-lg font-extrabold tabular-nums text-charcoal">
                    {questions.length}
                  </dd>
                </div>
                <div className="rounded-lg bg-[#fafafa] px-2 py-2 text-center">
                  <dt className="text-[10px] font-bold text-pencil-gray">
                    合計時間
                  </dt>
                  <dd className="font-numeric text-sm font-extrabold tabular-nums text-charcoal">
                    {totalTime}
                  </dd>
                </div>
                <div className="rounded-lg bg-[#fafafa] px-2 py-2 text-center">
                  <dt className="text-[10px] font-bold text-pencil-gray">
                    最長
                  </dt>
                  <dd className="font-numeric text-sm font-extrabold tabular-nums text-charcoal">
                    {longestTime}秒
                  </dd>
                </div>
              </dl>

              <ul className="mt-4 space-y-2 text-xs leading-5 text-charcoal">
                <li className="flex items-start gap-2">
                  <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-eager-green-ink" />
                  お題は1〜{QUESTION_TEXT_MAX}文字
                </li>
                <li className="flex items-start gap-2">
                  <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-eager-green-ink" />
                  制限時間は{QUESTION_TIME_MIN}〜{QUESTION_TIME_MAX}秒
                </li>
                <li className="flex items-start gap-2">
                  <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-eager-green-ink" />
                  一覧の上から順に出題
                </li>
              </ul>

              <div className="mt-4 rounded-xl border-2 border-line-soft bg-[#fafafa] p-3">
                <p className="text-xs font-extrabold text-charcoal">
                  保存について
                </p>
                <p className="mt-1 text-[11px] leading-5 text-pencil-gray">
                  {previewMode
                    ? "プレビューでは変更は保存されません。"
                    : "変更はサーバーに保存され、参加者・司会者・スクリーン全画面に反映されます。"}
                </p>
              </div>
            </section>
          )}
        </aside>
      </main>

      {deletingQuestion ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-night-ink/45 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-question-heading"
            aria-describedby="delete-question-description"
            onKeyDown={handleDeleteDialogKeyDown}
            className="w-full max-w-md rounded-2xl border-2 border-line-soft bg-paper-white p-5"
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff0f0] text-alert-red"
              >
                <TrashIcon className="size-5" />
              </span>
              <div className="min-w-0">
                <h2
                  id="delete-question-heading"
                  className="text-lg font-extrabold text-charcoal"
                >
                  お題を削除しますか？
                </h2>
                <p
                  id="delete-question-description"
                  className="mt-1 text-xs leading-5 text-pencil-gray"
                >
                  「{deletingQuestion.text}」を削除します。この操作は取り消せません。
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                ref={cancelDeleteRef}
                type="button"
                onClick={cancelDelete}
                className="min-h-11 rounded-xl border-2 border-faded-gray bg-paper-white px-3 text-xs font-extrabold text-charcoal transition-colors hover:bg-[#f7f7f7]"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={saving || frozen}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-alert-red px-3 text-xs font-extrabold text-white transition-transform active:translate-y-px disabled:opacity-50"
              >
                <TrashIcon className="size-4" />
                {saving ? "削除中…" : "削除する"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </div>
    </div>
  );
}
