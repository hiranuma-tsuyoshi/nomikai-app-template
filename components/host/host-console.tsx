"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type {
  HostAnswerGroup,
  HostConsoleData,
  HostPhase,
  HostTeam,
} from "@/lib/demo/h05";
import { countCharacters, formatTime, isValidAnswer } from "@/lib/format";
import { calcScore, formatRate } from "@/lib/scoring";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  LockIcon,
  PencilIcon,
  PlayIcon,
  StopIcon,
  UsersIcon,
} from "../game/icons";

type HostConsoleProps = {
  data: HostConsoleData;
  previewState: HostPhase;
};

const PHASE_META: Record<
  HostPhase,
  { label: string; chip: string; dot: string }
> = {
  answering: {
    label: "回答受付中",
    chip: "bg-storybook-green text-eager-green-ink",
    dot: "bg-eager-green",
  },
  final_check: {
    label: "最終確認中",
    chip: "bg-[#fff4e5] text-[#9a5b00]",
    dot: "bg-tangerine",
  },
  reveal: {
    label: "回答公開中",
    chip: "bg-[#e6f7ff] text-spark-blue-ink",
    dot: "bg-spark-blue",
  },
  scored: {
    label: "得点確定",
    chip: "bg-[#f3ecff] text-[#6b3bb5]",
    dot: "bg-grape-purple",
  },
};

function getTopCount(team: HostTeam) {
  return team.groups.reduce((max, group) => Math.max(max, group.count), 0);
}

function getTeamScore(team: HostTeam) {
  return calcScore(team.answered, getTopCount(team));
}

function adjustGroupCount(
  groups: HostAnswerGroup[],
  text: string,
  delta: number,
) {
  const next = groups.map((group) => ({ ...group }));
  const index = next.findIndex((group) => group.text === text);

  if (index >= 0) {
    next[index].count += delta;
    if (next[index].count <= 0) next.splice(index, 1);
  } else if (delta > 0) {
    next.push({ text, count: delta });
  }

  return next;
}

function PhaseBadge({ phase }: { phase: HostPhase }) {
  const meta = PHASE_META[phase];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold ${meta.chip}`}
    >
      <span aria-hidden="true" className={`size-2 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function TeamStatus({
  teams,
  hostTeamId,
}: {
  teams: HostTeam[];
  hostTeamId: string;
}) {
  return (
    <section aria-labelledby="team-status-heading" className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="team-status-heading"
            className="text-lg font-extrabold text-charcoal"
          >
            チームの回答状況
          </h2>
          <p className="mt-0.5 text-caption text-pencil-gray">
            回答者4人未満のチームは採点対象外
          </p>
        </div>
        <span className="rounded-lg bg-[#f2f2f2] px-2.5 py-1 font-numeric text-xs font-extrabold text-pencil-gray">
          {teams.reduce((sum, team) => sum + team.answered, 0)} /{" "}
          {teams.reduce((sum, team) => sum + team.memberCount, 0)}人
        </span>
      </div>

      <ul className="mt-4 grid gap-2.5 md:grid-cols-2">
        {teams.map((team) => {
          const isExcluded = team.answered < 4;
          const isHostTeam = team.id === hostTeamId;
          const remaining = Math.max(0, team.memberCount - team.answered);

          return (
            <li
              key={team.id}
              className={`rounded-xl border-2 p-3 ${
                isExcluded
                  ? "border-[#ffd0d0] bg-[#fff8f8]"
                  : "border-line-soft bg-paper-white"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: team.color }}
                  />
                  <span className="truncate text-sm font-extrabold text-charcoal">
                    {team.name}
                  </span>
                  {isHostTeam ? (
                    <span className="shrink-0 rounded bg-[#eef7e5] px-1.5 py-0.5 text-[10px] font-extrabold text-eager-green-ink">
                      あなた
                    </span>
                  ) : null}
                  {isExcluded ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded bg-[#ffecec] px-1.5 py-0.5 text-[10px] font-extrabold text-alert-red-ink">
                      <AlertTriangleIcon className="size-3" />
                      採点対象外
                    </span>
                  ) : null}
                </div>

                <p className="shrink-0 font-numeric text-base font-extrabold tabular-nums text-charcoal">
                  {team.answered}
                  <span className="ml-0.5 text-xs font-bold text-pencil-gray">
                    / {team.memberCount}人
                  </span>
                </p>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-3">
                <div className="flex gap-1.5" aria-hidden="true">
                  {Array.from({ length: team.memberCount }, (_, index) => (
                    <span
                      key={index}
                      className="size-2.5 rounded-full border-2"
                      style={
                        index < team.answered
                          ? {
                              backgroundColor: team.color,
                              borderColor: team.color,
                            }
                          : { borderColor: "#d9d9d9" }
                      }
                    />
                  ))}
                </div>
                <p className="text-[11px] font-bold text-pencil-gray">
                  {remaining === 0 ? "全員回答" : `あと${remaining}人`}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function AnswerGroups({ teams }: { teams: HostTeam[] }) {
  return (
    <section aria-labelledby="answer-groups-heading" className="card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="answer-groups-heading"
            className="text-lg font-extrabold text-charcoal"
          >
            回答グループ
          </h2>
          <p className="mt-0.5 text-caption text-pencil-gray">
            表記揺れは自動でまとめています。統合した回答には理由を表示します。
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#e6f7ff] px-2.5 py-1 text-[11px] font-extrabold text-spark-blue-ink">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-spark-blue" />
          公開中
        </span>
      </div>

      <ul className="mt-3 grid content-start gap-2 md:grid-cols-2">
        {teams.map((team) => {
          const groups = [...team.groups].sort((a, b) => b.count - a.count);
          const isExcluded = team.answered < 4;

          return (
            <li
              key={team.id}
              className={`rounded-xl border-2 p-2.5 ${
                isExcluded
                  ? "border-[#ffd0d0] bg-[#fff8f8]"
                  : "border-line-soft bg-paper-white"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: team.color }}
                  />
                  <span className="truncate text-sm font-extrabold text-charcoal">
                    {team.name}
                  </span>
                </div>
                <span className="shrink-0 font-numeric text-xs font-extrabold text-pencil-gray">
                  {team.answered}人
                </span>
              </div>

              <ul className="mt-2 space-y-1">
                {groups.map((group) => (
                  <li key={group.text}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold text-charcoal">
                        {group.text}
                      </span>
                      <span className="shrink-0 rounded bg-[#f2f2f2] px-1.5 py-0.5 font-numeric text-[11px] font-extrabold text-pencil-gray">
                        ×{group.count}
                      </span>
                    </div>
                    {group.mergedNote ? (
                      <p className="text-[10px] font-bold text-spark-blue-ink">
                        {group.mergedNote}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>

              {isExcluded ? (
                <p className="mt-2 text-[10px] font-bold text-alert-red-ink">
                  回答者4人未満のため採点対象外
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ScoreSummary({ teams }: { teams: HostTeam[] }) {  const rows = teams
    .map((team) => {
      const score = getTeamScore(team);
      const points = score.status === "scored" ? score.points : null;
      const rate = score.status === "scored" ? score.rate : null;

      return {
        team,
        rate,
        points,
        total: team.baselinePoints + (points ?? 0),
      };
    })
    .sort((a, b) => b.total - a.total);

  return (
    <section aria-labelledby="score-summary-heading" className="card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="score-summary-heading"
            className="text-lg font-extrabold text-charcoal"
          >
            第3問の得点
          </h2>
          <p className="mt-0.5 text-caption text-pencil-gray">
            得点 = 一致率 × 10。総合順位は累計ptで決まります。
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#f3ecff] px-2.5 py-1 text-[11px] font-extrabold text-[#6b3bb5]">
          <CheckIcon className="size-3.5" />
          確定
        </span>
      </div>

      <ol className="mt-3 space-y-2">
        {rows.map((row, index) => {
          const isLeader = index === 0;
          const isExcluded = row.points === null;

          return (
            <li
              key={row.team.id}
              className={`grid grid-cols-[28px_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl border-2 px-3 py-2 ${
                isLeader
                  ? "border-[#e0b400] bg-[#fff9df]"
                  : isExcluded
                    ? "border-line-soft bg-[#fafafa]"
                    : "border-line-soft bg-paper-white"
              }`}
            >
              <span
                aria-label={`${index + 1}位`}
                className={`font-numeric text-lg font-extrabold ${
                  isLeader ? "text-[#8a6d00]" : "text-pencil-gray"
                }`}
              >
                {index + 1}
              </span>

              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.team.color }}
                />
                <span className="truncate text-sm font-extrabold text-charcoal">
                  {row.team.name}
                </span>
                {isLeader ? (
                  <span className="shrink-0 rounded bg-[#ffe98a] px-1.5 py-0.5 text-[10px] font-extrabold text-[#6b5500]">
                    首位
                  </span>
                ) : null}
              </span>

              <span className="text-right">
                <span className="block font-numeric text-sm font-extrabold tabular-nums text-charcoal">
                  {row.rate === null ? "—" : formatRate(row.rate)}
                </span>
                <span
                  className={`block font-numeric text-[11px] font-bold ${
                    isExcluded ? "text-pencil-gray" : "text-eager-green-ink"
                  }`}
                >
                  {row.points === null ? "採点対象外" : `+${row.points}pt`}
                </span>
              </span>

              <span className="min-w-[64px] text-right font-numeric text-lg font-extrabold tabular-nums text-charcoal">
                {row.total}
                <span className="ml-0.5 text-xs font-bold text-pencil-gray">
                  pt
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function HostConsole({ data, previewState }: HostConsoleProps) {
  const [phase, setPhase] = useState<HostPhase>(previewState);
  const [remainingSeconds, setRemainingSeconds] = useState(
    previewState === "answering"
      ? data.initialRemainingSeconds
      : previewState === "final_check"
        ? data.finalCheckInitialSeconds
        : 0,
  );
  const [questionNumber, setQuestionNumber] = useState(data.questionNumber);
  const [questionText, setQuestionText] = useState(data.questionText);
  const [teams, setTeams] = useState<HostTeam[]>(() =>
    data.teams.map((team) => ({
      ...team,
      groups: team.groups.map((group) => ({ ...group })),
    })),
  );
  const [submittedAnswer, setSubmittedAnswer] = useState(
    data.mySubmittedAnswer,
  );
  const [draft, setDraft] = useState(data.mySubmittedAnswer ?? "");
  const [isEditing, setIsEditing] = useState(data.mySubmittedAnswer === null);
  const [isStopped, setIsStopped] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"skip" | "abort" | null>(
    null,
  );
  const [liveMessage, setLiveMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isStopped) return;
    if (phase !== "answering" && phase !== "final_check") return;

    const interval = window.setInterval(() => {
      setRemainingSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [phase, isStopped]);

  useEffect(() => {
    if (remainingSeconds > 0 || isStopped) return;

    if (phase === "answering") {
      setPhase("final_check");
      setRemainingSeconds(data.finalCheckSeconds);
      setLiveMessage("回答受付を締め切りました。最終確認を開始します");
    } else if (phase === "final_check") {
      setPhase("reveal");
      setLiveMessage("回答を公開しました");
    }
  }, [data.finalCheckSeconds, isStopped, phase, remainingSeconds]);

  const answeredCount = teams.reduce((sum, team) => sum + team.answered, 0);
  const participantCount = teams.reduce(
    (sum, team) => sum + team.memberCount,
    0,
  );
  const answeredPercent = Math.min(
    100,
    Math.round((answeredCount / Math.max(1, participantCount)) * 100),
  );
  const myTeam = teams.find((team) => team.id === data.hostTeamId) ?? teams[0];
  const canEditAnswer =
    !isStopped && (phase === "answering" || phase === "final_check");
  const characterCount = countCharacters(draft);
  const canSubmit =
    canEditAnswer &&
    isEditing &&
    isValidAnswer(draft, data.maxAnswerLength);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    const nextAnswer = draft.trim();
    const previousAnswer = submittedAnswer;

    setTeams((previousTeams) =>
      previousTeams.map((team) => {
        if (team.id !== data.hostTeamId) return team;

        let groups = team.groups.map((group) => ({ ...group }));
        if (previousAnswer) {
          groups = adjustGroupCount(groups, previousAnswer, -1);
        }
        groups = adjustGroupCount(groups, nextAnswer, 1);

        return {
          ...team,
          answered: previousAnswer
            ? team.answered
            : Math.min(team.memberCount, team.answered + 1),
          groups,
        };
      }),
    );

    setSubmittedAnswer(nextAnswer);
    setDraft(nextAnswer);
    setIsEditing(false);
    setLiveMessage(
      previousAnswer ? "回答を修正しました" : "回答を送信しました",
    );
  }

  function handleEdit() {
    if (!canEditAnswer) return;
    setIsEditing(true);
    setLiveMessage("回答を修正できます");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function startFinalCheck() {
    if (phase !== "answering" || isStopped) return;
    setPhase("final_check");
    setRemainingSeconds(data.finalCheckSeconds);
    setConfirmAction(null);
    setLiveMessage("回答受付を締め切りました。最終確認を開始します");
  }

  function publishNow() {
    if (phase !== "final_check" || isStopped) return;
    setPhase("reveal");
    setRemainingSeconds(0);
    setConfirmAction(null);
    setLiveMessage("回答を公開しました");
  }

  function adjustFinalCheck(delta: number) {
    setRemainingSeconds((seconds) =>
      Math.min(120, Math.max(0, seconds + delta)),
    );
  }

  function confirmScores() {
    if (phase !== "reveal" || isStopped) return;
    setPhase("scored");
    setLiveMessage("得点を確定しました");
  }

  function startNextQuestion(message: string) {
    setQuestionNumber((number) => Math.min(data.totalQuestions, number + 1));
    setQuestionText((text) =>
      text === data.questionText ? data.nextQuestionText : text,
    );
    setTeams((previousTeams) =>
      previousTeams.map((team) => ({
        ...team,
        answered: 0,
        groups: [],
      })),
    );
    setPhase("answering");
    setRemainingSeconds(data.timeLimitSeconds);
    setSubmittedAnswer(null);
    setDraft("");
    setIsEditing(true);
    setConfirmAction(null);
    setLiveMessage(message);
  }

  function confirmSkip() {
    startNextQuestion("お題をスキップしました");
  }

  function confirmAbort() {
    setIsStopped(true);
    setConfirmAction(null);
    setLiveMessage("ゲームを中断しました");
  }

  function resumeGame() {
    setIsStopped(false);
    setLiveMessage("ゲームを再開しました");
  }

  const timerTone =
    phase === "final_check"
      ? "border-[#ffd9a8] bg-[#fff8ee]"
      : "border-line-soft bg-[#fafafa]";

  const timerValue =
    phase === "answering" || phase === "final_check"
      ? formatTime(remainingSeconds)
      : phase === "reveal"
        ? `${answeredCount} / ${participantCount}`
        : "確定";

  const timerLabel =
    phase === "answering"
      ? "残り時間"
      : phase === "final_check"
        ? "公開まで"
        : phase === "reveal"
          ? "回答公開中"
          : "得点確定";

  const timerSub =
    phase === "answering"
      ? `/ ${formatTime(data.timeLimitSeconds)}`
      : phase === "final_check"
        ? "最終確認 30秒"
        : phase === "reveal"
          ? "全チームに公開済み"
          : "会場スクリーンに表示中";

  const questionNote =
    phase === "answering"
      ? "回答は締切まで何度でも修正できます"
      : phase === "final_check"
        ? "公開すると回答を修正できなくなります"
        : phase === "reveal"
          ? "全チームの回答を公開しています"
          : "このお題の得点を確定しました";

  const primaryLabel =
    phase === "answering"
      ? "回答を締め切る"
      : phase === "final_check"
        ? "今すぐ公開する"
        : phase === "reveal"
          ? "得点を確定する"
          : "次のお題へ";

  function handlePrimaryAction() {
    if (phase === "answering") startFinalCheck();
    else if (phase === "final_check") publishNow();
    else if (phase === "reveal") confirmScores();
    else startNextQuestion("次のお題を開始しました");
  }

  return (
    <div className="min-h-full bg-meadow-mist">
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
                Host Console · Room {data.roomCode}
              </p>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold text-charcoal">
                  進行管理
                </h1>
                <span className="rounded bg-[#f2f2f2] px-1.5 py-0.5 font-numeric text-[11px] font-extrabold text-pencil-gray">
                  第{questionNumber}問 / 全{data.totalQuestions}問
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-pencil-gray">
                回答状況
              </p>
              <p className="font-numeric text-sm font-extrabold tabular-nums text-charcoal">
                {answeredCount}{" "}
                <span className="text-xs font-bold text-pencil-gray">
                  / {participantCount}人
                </span>
              </p>
            </div>
            <Link
              href="/host/questions"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border-2 border-line-soft px-2.5 text-[11px] font-extrabold text-spark-blue-ink transition-colors hover:bg-[#f2fbff]"
            >
              <PencilIcon className="size-3.5" />
              お題管理
            </Link>
            <PhaseBadge phase={phase} />
            <div className="hidden items-center gap-2 rounded-xl border-2 border-line-soft px-2.5 py-1.5 lg:flex">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full"
                style={{ backgroundColor: myTeam.color }}
              />
              <div>
                <p className="text-[10px] font-bold text-pencil-gray">
                  進行・選手
                </p>
                <p className="text-xs font-extrabold text-charcoal">
                  {data.hostName}（{myTeam.name}）
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1440px] gap-4 px-5 py-4 lg:px-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <section aria-labelledby="host-question-heading" className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-storybook-green px-2 py-1 text-[11px] font-extrabold text-eager-green-ink">
                    <ClockIcon className="size-3.5" />
                    お題
                  </span>
                  <span className="text-caption font-bold text-pencil-gray">
                    第{questionNumber}問 / 全{data.totalQuestions}問
                  </span>
                </div>
                <h2
                  id="host-question-heading"
                  className="mt-2.5 text-balance font-rounded text-[30px] font-extrabold leading-tight tracking-[-0.01em] text-charcoal"
                >
                  {questionText}
                </h2>
              </div>

              <div
                className={`min-w-[150px] rounded-xl border-2 px-4 py-2.5 text-right ${timerTone}`}
              >
                <p className="flex items-center justify-end gap-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-pencil-gray">
                  {phase === "final_check" ? (
                    <LockIcon className="size-3" />
                  ) : phase === "reveal" ? (
                    <UsersIcon className="size-3" />
                  ) : phase === "scored" ? (
                    <CheckIcon className="size-3" />
                  ) : (
                    <ClockIcon className="size-3" />
                  )}
                  {timerLabel}
                </p>
                <p className="mt-0.5 font-numeric text-[30px] font-extrabold leading-tight tabular-nums text-charcoal">
                  {timerValue}
                </p>
                <p className="text-[10px] font-bold text-pencil-gray">
                  {timerSub}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#fafafa] px-4 py-2.5">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <p className="shrink-0 text-sm font-extrabold text-charcoal">
                  回答 {answeredCount}{" "}
                  <span className="text-xs font-bold text-pencil-gray">
                    / {participantCount}人
                  </span>
                </p>
                <div
                  role="progressbar"
                  aria-label="回答済み人数"
                  aria-valuemin={0}
                  aria-valuemax={participantCount}
                  aria-valuenow={answeredCount}
                  aria-valuetext={`${answeredCount} / ${participantCount}人`}
                  className="h-2.5 min-w-24 flex-1 overflow-hidden rounded-full bg-line-soft"
                >
                  <div
                    className="h-full rounded-full bg-eager-green transition-[width] duration-500"
                    style={{ width: `${answeredPercent}%` }}
                  />
                </div>
                <span className="shrink-0 font-numeric text-xs font-extrabold text-pencil-gray">
                  {answeredPercent}%
                </span>
              </div>

              <p className="text-caption font-bold text-pencil-gray">
                {questionNote}
              </p>
            </div>
          </section>

          {phase === "reveal" ? (
            <AnswerGroups teams={teams} />
          ) : phase === "scored" ? (
            <ScoreSummary teams={teams} />
          ) : (
            <TeamStatus teams={teams} hostTeamId={data.hostTeamId} />
          )}
        </div>

        <aside className="space-y-4">
          <section
            aria-labelledby="next-action-heading"
            className="card p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h2
                id="next-action-heading"
                className="text-lg font-extrabold text-charcoal"
              >
                次の操作
              </h2>
              <PhaseBadge phase={phase} />
            </div>

            {isStopped ? (
              <div className="mt-4 rounded-xl border-2 border-[#ffd0d0] bg-[#fff5f5] p-4">
                <p className="flex items-center gap-2 text-base font-extrabold text-alert-red-ink">
                  <StopIcon className="size-5" />
                  ゲームを中断しました
                </p>
                <p className="mt-1 text-caption leading-5 text-pencil-gray">
                  タイマーと回答受付は停止しています。再開すると続きから再開します。
                </p>
                <button
                  type="button"
                  onClick={resumeGame}
                  className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-eager-green text-sm font-extrabold text-night-ink transition-transform active:translate-y-px"
                >
                  <PlayIcon className="size-4" />
                  ゲームを再開する
                </button>
              </div>
            ) : (
              <>
                {phase === "final_check" ? (
                  <div className="mt-4 rounded-xl bg-[#fff8ee] px-4 py-3 text-center">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#9a5b00]">
                      公開まで
                    </p>
                    <p className="font-numeric text-4xl font-extrabold tabular-nums text-charcoal">
                      {formatTime(remainingSeconds)}
                    </p>
                  </div>
                ) : null}

                <p className="mt-4 text-sm leading-6 text-pencil-gray">
                  {phase === "answering"
                    ? "回答を締め切ると、30秒の最終確認に移ります。参加者は公開まで自分の回答を修正できます。"
                    : phase === "final_check"
                      ? "参加者は自分の回答だけを確認しています。公開すると修正できなくなります。"
                      : phase === "reveal"
                        ? "回答グループを確認して、問題なければ得点を確定してください。"
                        : "得点を確定しました。会場スクリーンに結果を表示しています。"}
                </p>

                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-eager-green text-sm font-extrabold text-night-ink transition-transform active:translate-y-px"
                >
                  {phase === "answering" ? (
                    <LockIcon className="size-4" />
                  ) : phase === "final_check" ? (
                    <PlayIcon className="size-4" />
                  ) : phase === "reveal" ? (
                    <CheckIcon className="size-4" />
                  ) : (
                    <ArrowRightIcon className="size-4" />
                  )}
                  {primaryLabel}
                </button>

                {phase === "final_check" ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => adjustFinalCheck(15)}
                      className="min-h-10 rounded-xl border-2 border-faded-gray bg-paper-white text-xs font-extrabold text-charcoal transition-colors hover:bg-[#f7f7f7]"
                    >
                      +15秒 延長
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustFinalCheck(-15)}
                      className="min-h-10 rounded-xl border-2 border-faded-gray bg-paper-white text-xs font-extrabold text-charcoal transition-colors hover:bg-[#f7f7f7]"
                    >
                      −15秒 短縮
                    </button>
                  </div>
                ) : null}

                {phase === "answering" ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmAction("skip")}
                      className="min-h-10 rounded-xl border-2 border-[#ffd9a8] bg-paper-white text-xs font-extrabold text-[#9a5b00] transition-colors hover:bg-[#fff8ee]"
                    >
                      お題をスキップ
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmAction("abort")}
                      className="min-h-10 rounded-xl border-2 border-[#ffd0d0] bg-paper-white text-xs font-extrabold text-alert-red-ink transition-colors hover:bg-[#fff5f5]"
                    >
                      中断
                    </button>
                  </div>
                ) : null}

                {confirmAction ? (
                  <div
                    role="alertdialog"
                    aria-labelledby="confirm-heading"
                    className={`mt-3 rounded-xl border-2 p-3 ${
                      confirmAction === "abort"
                        ? "border-[#ffd0d0] bg-[#fff5f5]"
                        : "border-[#ffd9a8] bg-[#fff8ee]"
                    }`}
                  >
                    <p
                      id="confirm-heading"
                      className="text-sm font-extrabold text-charcoal"
                    >
                      {confirmAction === "abort"
                        ? "ゲームを中断しますか？"
                        : "お題をスキップしますか？"}
                    </p>
                    <p className="mt-1 text-[11px] leading-4 text-pencil-gray">
                      {confirmAction === "abort"
                        ? "タイマーと回答受付が止まります。再開できます。"
                        : "このお題の回答は使わず、次のお題に進みます。"}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={
                          confirmAction === "abort" ? confirmAbort : confirmSkip
                        }
                        className="min-h-10 rounded-lg bg-alert-red text-xs font-extrabold text-white transition-transform active:translate-y-px"
                      >
                        {confirmAction === "abort" ? "中断する" : "スキップする"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmAction(null)}
                        className="min-h-10 rounded-lg border-2 border-faded-gray bg-paper-white text-xs font-extrabold text-charcoal"
                      >
                        やめる
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>

          <section aria-labelledby="my-answer-heading" className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2
                id="my-answer-heading"
                className="text-lg font-extrabold text-charcoal"
              >
                自分の回答
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f2f2f2] px-2.5 py-1 text-[11px] font-extrabold text-charcoal">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ backgroundColor: myTeam.color }}
                />
                {myTeam.name}
              </span>
            </div>

            {submittedAnswer && !isEditing ? (
              <div className="mt-4 rounded-xl border-2 border-[#b8e986] bg-[#f7ffe9] p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-extrabold text-eager-green-ink">
                  <CheckIcon className="size-3.5" />
                  送信済み
                </p>
                <p className="mt-1 break-words text-xl font-extrabold text-charcoal">
                  「{submittedAnswer}」
                </p>
                {canEditAnswer ? (
                  <button
                    type="button"
                    onClick={handleEdit}
                    className="mt-2 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg border-2 border-faded-gray bg-paper-white text-xs font-extrabold text-spark-blue-ink transition-colors hover:bg-[#f7f7f7]"
                  >
                    <PencilIcon className="size-3.5" />
                    回答を修正する
                  </button>
                ) : (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-pencil-gray">
                    <LockIcon className="size-3.5" />
                    公開済みのため修正できません
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-4">
                <div className="flex items-baseline justify-between gap-3">
                  <label
                    htmlFor="host-answer"
                    className="text-xs font-extrabold text-charcoal"
                  >
                    {phase === "final_check"
                      ? "最終確認・修正"
                      : "回答を入力"}
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

                <input
                  ref={inputRef}
                  id="host-answer"
                  name="host-answer"
                  type="text"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="答えを入力"
                  maxLength={data.maxAnswerLength}
                  autoComplete="off"
                  disabled={!canEditAnswer}
                  className="mt-2 h-11 w-full rounded-xl border-2 border-faded-gray bg-paper-white px-3 text-sm font-bold text-charcoal placeholder:font-medium placeholder:text-pencil-gray focus:border-spark-blue focus:outline-none disabled:bg-[#f7f7f7]"
                />

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-eager-green text-sm font-extrabold text-night-ink transition-transform active:translate-y-px disabled:bg-[#e5e5e5] disabled:text-faded-gray disabled:active:translate-y-0"
                >
                  <ArrowRightIcon className="size-4" />
                  {phase === "final_check" ? "修正を保存する" : "回答する"}
                </button>

                <p className="mt-2 text-[11px] leading-4 text-pencil-gray">
                  {phase === "final_check"
                    ? "公開までは何度でも修正できます。"
                    : "締切までは何度でも修正できます。"}
                </p>
              </form>
            )}
          </section>

          <p className="flex items-center justify-center gap-1.5 rounded-xl bg-paper-white px-3 py-2.5 text-[11px] font-medium text-pencil-gray">
            <LockIcon className="size-3.5" />
            回答は公開まで他の人に見えません
          </p>
        </aside>
      </main>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </div>
    </div>
  );
}
