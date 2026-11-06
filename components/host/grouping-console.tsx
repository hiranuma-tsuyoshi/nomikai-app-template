"use client";

import Link from "next/link";
import {
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import type {
  GroupingAnswerGroup,
  GroupingConsoleData,
  GroupingTeam,
} from "@/lib/demo/h06";
import { countCharacters } from "@/lib/format";
import {
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  LockIcon,
  PencilIcon,
  UsersIcon,
} from "../game/icons";

type GroupingConsoleProps = {
  data: GroupingConsoleData;
  previewMode?: boolean;
};

function cloneGroup(group: GroupingAnswerGroup): GroupingAnswerGroup {
  return {
    ...group,
    children: group.children?.map(cloneGroup),
  };
}

function cloneTeams(teams: GroupingTeam[]): GroupingTeam[] {
  return teams.map((team) => ({
    ...team,
    groups: team.groups.map(cloneGroup),
  }));
}

function getMergedCount(team: GroupingTeam) {
  return team.groups.filter((group) => (group.children?.length ?? 0) > 0).length;
}

export function GroupingConsole({
  data,
  previewMode = false,
}: GroupingConsoleProps) {
  const [teams, setTeams] = useState<GroupingTeam[]>(() => cloneTeams(data.teams));
  const [activeTeamId, setActiveTeamId] = useState(data.teams[0].id);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mergedName, setMergedName] = useState("");
  const [reason, setReason] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const nextMergeId = useRef(1);

  const activeTeam =
    teams.find((team) => team.id === activeTeamId) ?? teams[0];
  const selectedGroups = activeTeam.groups.filter((group) =>
    selectedIds.includes(group.id),
  );
  const mergedCount = getMergedCount(activeTeam);
  const totalMergedCount = teams.reduce(
    (sum, team) => sum + getMergedCount(team),
    0,
  );
  const answeredCount = teams.reduce((sum, team) => sum + team.answered, 0);
  const participantCount = teams.reduce(
    (sum, team) => sum + team.memberCount,
    0,
  );
  const myTeam = teams.find((team) => team.id === data.hostTeamId) ?? teams[0];
  const mergedNameLength = countCharacters(mergedName.trim());
  const reasonLength = countCharacters(reason.trim());
  const canMerge =
    !isConfirmed &&
    selectedGroups.length >= 2 &&
    mergedNameLength > 0 &&
    mergedNameLength <= data.maxMergedNameLength &&
    reasonLength > 0 &&
    reasonLength <= data.maxReasonLength;

  function selectTeam(teamId: string) {
    if (teamId === activeTeamId) return;

    const team = teams.find((entry) => entry.id === teamId);
    setActiveTeamId(teamId);
    setSelectedIds([]);
    setMergedName("");
    setReason("");
    setIsConfirming(false);
    if (team) setLiveMessage(`${team.name}の回答を表示しました`);
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (
      event.key !== "ArrowRight" &&
      event.key !== "ArrowLeft" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    event.preventDefault();
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % teams.length;
    else if (event.key === "ArrowLeft")
      nextIndex = (index - 1 + teams.length) % teams.length;
    else if (event.key === "Home") nextIndex = 0;
    else nextIndex = teams.length - 1;

    const nextTeam = teams[nextIndex];
    selectTeam(nextTeam.id);
    tabRefs.current[nextTeam.id]?.focus();
  }

  function toggleGroup(groupId: string) {
    if (isConfirmed) return;

    setSelectedIds((previous) =>
      previous.includes(groupId)
        ? previous.filter((id) => id !== groupId)
        : [...previous, groupId],
    );
  }

  function clearSelection() {
    setSelectedIds([]);
    setMergedName("");
    setReason("");
  }

  function handleMerge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canMerge) return;

    const firstIndex = activeTeam.groups.findIndex((group) =>
      selectedIds.includes(group.id),
    );
    const mergedGroup: GroupingAnswerGroup = {
      id: `merge-${activeTeam.id}-${nextMergeId.current}`,
      text: mergedName.trim(),
      count: selectedGroups.reduce((sum, group) => sum + group.count, 0),
      reason: reason.trim(),
      children: selectedGroups.map(cloneGroup),
    };
    nextMergeId.current += 1;

    setTeams((previousTeams) =>
      previousTeams.map((team) => {
        if (team.id !== activeTeam.id) return team;

        const remaining = team.groups.filter(
          (group) => !selectedIds.includes(group.id),
        );
        const nextGroups = [...remaining];
        nextGroups.splice(
          firstIndex < 0 ? nextGroups.length : firstIndex,
          0,
          mergedGroup,
        );

        return { ...team, groups: nextGroups };
      }),
    );
    setSelectedIds([]);
    setMergedName("");
    setReason("");
    setLiveMessage(
      `「${mergedGroup.text}」に統合しました。理由: ${mergedGroup.reason}`,
    );
  }

  function handleUndo(groupId: string) {
    if (isConfirmed) return;

    const group = activeTeam.groups.find((entry) => entry.id === groupId);
    if (!group?.children?.length) return;
    const children = group.children.map(cloneGroup);

    setTeams((previousTeams) =>
      previousTeams.map((team) => {
        if (team.id !== activeTeam.id) return team;

        const index = team.groups.findIndex((entry) => entry.id === groupId);
        if (index < 0) return team;

        const nextGroups = [...team.groups];
        nextGroups.splice(index, 1, ...children);
        return { ...team, groups: nextGroups };
      }),
    );
    setSelectedIds([]);
    setMergedName("");
    setReason("");
    setLiveMessage(`「${group.text}」の統合を取り消しました`);
  }

  function handleConfirm() {
    setIsConfirmed(true);
    setIsConfirming(false);
    setSelectedIds([]);
    setMergedName("");
    setReason("");
    setLiveMessage(`第${data.questionNumber}問の得点を確定しました`);
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
                <h1 className="text-lg font-extrabold text-charcoal">進行管理</h1>
                <span className="rounded bg-[#f2f2f2] px-1.5 py-0.5 font-numeric text-[11px] font-extrabold text-pencil-gray">
                  第{data.questionNumber}問 / 全{data.totalQuestions}問
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
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f3ecff] px-3 py-1 text-xs font-extrabold text-[#6b3bb5]">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-grape-purple"
              />
              グループ統合
            </span>
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

      <main className="mx-auto grid w-full max-w-[1440px] gap-4 px-5 py-4 lg:px-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <section aria-labelledby="grouping-question-heading" className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-storybook-green px-2 py-1 text-[11px] font-extrabold text-eager-green-ink">
                    <ClockIcon className="size-3.5" />
                    お題
                  </span>
                  <span className="text-caption font-bold text-pencil-gray">
                    第{data.questionNumber}問 / 全{data.totalQuestions}問
                  </span>
                </div>
                <h2
                  id="grouping-question-heading"
                  className="mt-2.5 text-balance font-rounded text-[30px] font-extrabold leading-tight tracking-[-0.01em] text-charcoal"
                >
                  {data.questionText}
                </h2>
              </div>

              <p className="rounded-xl bg-[#fafafa] px-4 py-2.5 text-xs font-bold leading-5 text-pencil-gray">
                統合できるのは
                <br />
                <span className="text-sm font-extrabold text-charcoal">
                  同じチームの回答だけ
                </span>
              </p>
            </div>
          </section>

          <div
            role="tablist"
            aria-label="チーム"
            style={{
              gridTemplateColumns: `repeat(${teams.length}, minmax(0, 1fr))`,
            }}
            className="grid gap-1 rounded-xl border-2 border-line-soft bg-paper-white p-1"
          >
            {teams.map((team, index) => {
              const isActive = team.id === activeTeam.id;
              const teamMergedCount = getMergedCount(team);

              return (
                <button
                  key={team.id}
                  ref={(node) => {
                    tabRefs.current[team.id] = node;
                  }}
                  type="button"
                  role="tab"
                  id={`team-tab-${team.id}`}
                  aria-selected={isActive}
                  aria-controls="team-answer-panel"
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => selectTeam(team.id)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                  className={`flex min-h-[52px] flex-col items-start justify-center gap-0.5 rounded-lg border-2 px-2.5 text-left transition-colors ${
                    isActive
                      ? "border-eager-green bg-storybook-green"
                      : "border-transparent hover:bg-[#f7f7f7]"
                  }`}
                >
                  <span className="flex w-full min-w-0 items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: team.color }}
                    />
                    <span className="truncate text-xs font-extrabold text-charcoal">
                      {team.name}
                    </span>
                  </span>
                  <span className="flex w-full items-center justify-between gap-1">
                    <span className="font-numeric text-[11px] font-bold text-pencil-gray">
                      {team.answered}人
                    </span>
                    {teamMergedCount > 0 ? (
                      <span className="rounded bg-[#f3ecff] px-1 py-0.5 text-[9px] font-extrabold text-[#6b3bb5]">
                        {teamMergedCount}統合
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>

          <section aria-labelledby="grouping-answers-heading" className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2
                  id="grouping-answers-heading"
                  className="text-lg font-extrabold text-charcoal"
                >
                  {activeTeam.name}の回答
                </h2>
                <p className="mt-0.5 text-caption text-pencil-gray">
                  回答を2つ以上選ぶと統合できます。
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-[#f2f2f2] px-2.5 py-1 font-numeric text-xs font-extrabold text-pencil-gray">
                  {activeTeam.answered}人
                </span>
                <span className="rounded-lg bg-[#f2f2f2] px-2.5 py-1 font-numeric text-xs font-extrabold text-pencil-gray">
                  {activeTeam.groups.length}グループ
                </span>
              </div>
            </div>

            <div
              id="team-answer-panel"
              role="tabpanel"
              aria-labelledby={`team-tab-${activeTeam.id}`}
              tabIndex={0}
            >
              <ul className="mt-3 grid gap-2 md:grid-cols-2">
                {activeTeam.groups.map((group) => {
                  const isSelected = selectedIds.includes(group.id);
                  const isMerged = (group.children?.length ?? 0) > 0;

                  return (
                    <li key={group.id}>
                      <div
                        className={`overflow-hidden rounded-xl border-2 ${
                          isSelected
                            ? "border-spark-blue bg-[#f2fbff]"
                            : isMerged
                              ? "border-[#d9c7ff] bg-[#fbf7ff]"
                              : "border-line-soft bg-paper-white"
                        }`}
                      >
                        <div className="flex items-stretch">
                          <button
                            type="button"
                            data-group-id={group.id}
                            aria-pressed={isSelected}
                            onClick={() => toggleGroup(group.id)}
                            disabled={isConfirmed}
                            className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left transition-colors hover:bg-white/60 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                          >
                            <span
                              aria-hidden="true"
                              className={`grid size-5 shrink-0 place-items-center rounded border-2 ${
                                isSelected
                                  ? "border-spark-blue bg-spark-blue text-white"
                                  : "border-faded-gray bg-paper-white text-transparent"
                              }`}
                            >
                              <CheckIcon className="size-3.5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex min-w-0 items-center gap-1.5">
                                <span className="truncate text-base font-extrabold text-charcoal">
                                  {group.text}
                                </span>
                                {isMerged ? (
                                  <span className="shrink-0 rounded bg-[#f3ecff] px-1.5 py-0.5 text-[9px] font-extrabold text-[#6b3bb5]">
                                    統合済み
                                  </span>
                                ) : null}
                              </span>
                              {isSelected ? (
                                <span className="mt-0.5 block text-[11px] font-bold text-spark-blue-ink">
                                  選択中
                                </span>
                              ) : null}
                            </span>
                            <span className="shrink-0 rounded-lg bg-[#f2f2f2] px-2 py-1 font-numeric text-sm font-extrabold text-charcoal">
                              ×{group.count}
                            </span>
                          </button>

                          {isMerged ? (
                            <button
                              type="button"
                              onClick={() => handleUndo(group.id)}
                              disabled={isConfirmed}
                              aria-label={`「${group.text}」の統合を取り消す`}
                              className="shrink-0 border-l-2 border-[#e8ddff] px-3 text-[11px] font-extrabold text-[#6b3bb5] transition-colors hover:bg-[#f3ecff] disabled:cursor-not-allowed disabled:text-faded-gray disabled:hover:bg-transparent"
                            >
                              取消
                            </button>
                          ) : null}
                        </div>

                        {isMerged ? (
                          <div className="border-t-2 border-[#e8ddff] bg-[#f8f2ff] px-3 py-2">
                            <p className="text-[11px] font-bold leading-4 text-charcoal">
                              理由: {group.reason}
                            </p>
                            <p className="mt-0.5 text-[10px] font-medium leading-4 text-pencil-gray">
                              統合元:{" "}
                              {group.children
                                ?.map((child) => `${child.text} ×${child.count}`)
                                .join(" / ")}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-3 rounded-xl border-2 border-line-soft bg-[#fafafa] p-3">
                {isConfirmed ? (
                  <p className="flex items-center gap-2 text-xs font-bold text-eager-green-ink">
                    <LockIcon className="size-4" />
                    得点を確定しました。統合の変更はできません。
                  </p>
                ) : selectedGroups.length === 0 ? (
                  <p className="flex items-center gap-2 text-xs font-bold text-pencil-gray">
                    <UsersIcon className="size-4" />
                    回答を2つ以上選ぶと、ここで統合できます。
                  </p>
                ) : selectedGroups.length === 1 ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold text-charcoal">
                      「{selectedGroups[0].text}」を選択中。あと1つ選んでください。
                    </p>
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="text-[11px] font-extrabold text-spark-blue-ink underline"
                    >
                      選択を解除
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleMerge}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold text-charcoal">
                        選択中:{" "}
                        {selectedGroups
                          .map((group) => `${group.text} ×${group.count}`)
                          .join(" / ")}
                      </p>
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="text-[11px] font-extrabold text-spark-blue-ink underline"
                      >
                        選択を解除
                      </button>
                    </div>

                    <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                      <div>
                        <div className="flex items-baseline justify-between gap-2">
                          <label
                            htmlFor="merged-name"
                            className="text-[11px] font-extrabold text-charcoal"
                          >
                            統合後の回答名
                          </label>
                          <span className="font-numeric text-[10px] font-bold tabular-nums text-pencil-gray">
                            {countCharacters(mergedName)} /{" "}
                            {data.maxMergedNameLength}文字
                          </span>
                        </div>
                        <input
                          id="merged-name"
                          name="merged-name"
                          type="text"
                          value={mergedName}
                          onChange={(event) => setMergedName(event.target.value)}
                          placeholder="例: カレー"
                          maxLength={data.maxMergedNameLength}
                          autoComplete="off"
                          className="mt-1 h-10 w-full rounded-lg border-2 border-faded-gray bg-paper-white px-3 text-sm font-bold text-charcoal placeholder:font-medium placeholder:text-pencil-gray focus:border-spark-blue focus:outline-none"
                        />
                      </div>

                      <div>
                        <div className="flex items-baseline justify-between gap-2">
                          <label
                            htmlFor="merge-reason"
                            className="text-[11px] font-extrabold text-charcoal"
                          >
                            統合理由
                          </label>
                          <span className="font-numeric text-[10px] font-bold tabular-nums text-pencil-gray">
                            {countCharacters(reason)} / {data.maxReasonLength}文字
                          </span>
                        </div>
                        <input
                          id="merge-reason"
                          name="merge-reason"
                          type="text"
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          placeholder="例: 同じ料理として"
                          maxLength={data.maxReasonLength}
                          autoComplete="off"
                          className="mt-1 h-10 w-full rounded-lg border-2 border-faded-gray bg-paper-white px-3 text-sm font-bold text-charcoal placeholder:font-medium placeholder:text-pencil-gray focus:border-spark-blue focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[10px] leading-4 text-pencil-gray">
                        理由は全チームの画面に表示されます。
                      </p>
                      <button
                        type="submit"
                        disabled={!canMerge}
                        className="min-h-10 rounded-lg bg-eager-green px-4 text-xs font-extrabold text-night-ink transition-transform active:translate-y-px disabled:bg-[#e5e5e5] disabled:text-faded-gray disabled:active:translate-y-0"
                      >
                        統合する
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section aria-labelledby="grouping-status-heading" className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2
                id="grouping-status-heading"
                className="text-lg font-extrabold text-charcoal"
              >
                統合の状況
              </h2>
              <span className="rounded bg-[#f3ecff] px-2 py-1 font-numeric text-[10px] font-extrabold text-[#6b3bb5]">
                全体 {totalMergedCount}件
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-[#fafafa] px-2 py-2 text-center">
                <dt className="text-[10px] font-bold text-pencil-gray">
                  回答グループ
                </dt>
                <dd className="font-numeric text-lg font-extrabold tabular-nums text-charcoal">
                  {activeTeam.groups.length}
                </dd>
              </div>
              <div className="rounded-lg bg-[#fafafa] px-2 py-2 text-center">
                <dt className="text-[10px] font-bold text-pencil-gray">
                  統合済み
                </dt>
                <dd className="font-numeric text-lg font-extrabold tabular-nums text-charcoal">
                  {mergedCount}
                </dd>
              </div>
              <div className="rounded-lg bg-[#fafafa] px-2 py-2 text-center">
                <dt className="text-[10px] font-bold text-pencil-gray">
                  選択中
                </dt>
                <dd className="font-numeric text-lg font-extrabold tabular-nums text-charcoal">
                  {selectedGroups.length}
                </dd>
              </div>
            </dl>

            <ul className="mt-4 space-y-1.5">
              {teams.map((team) => {
                const teamMergedCount = getMergedCount(team);
                const isActive = team.id === activeTeam.id;

                return (
                  <li key={team.id}>
                    <button
                      type="button"
                      onClick={() => selectTeam(team.id)}
                      aria-current={isActive ? "true" : undefined}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg border-2 px-2.5 py-1.5 text-left transition-colors ${
                        isActive
                          ? "border-eager-green bg-storybook-green"
                          : "border-line-soft bg-paper-white hover:bg-[#f7f7f7]"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: team.color }}
                        />
                        <span className="truncate text-xs font-extrabold text-charcoal">
                          {team.name}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 text-[10px] font-extrabold ${
                          teamMergedCount > 0
                            ? "text-[#6b3bb5]"
                            : "text-pencil-gray"
                        }`}
                      >
                        {teamMergedCount > 0
                          ? `${teamMergedCount}件統合`
                          : "統合なし"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <p className="mt-3 text-[11px] leading-4 text-pencil-gray">
              統合できるのはチーム内だけです。入力した理由は全チームの画面に表示されます。
            </p>
          </section>

          <section
            aria-labelledby="grouping-confirm-heading"
            className="card p-5"
          >
            <h2
              id="grouping-confirm-heading"
              className="text-lg font-extrabold text-charcoal"
            >
              得点を確定する
            </h2>

            {isConfirmed ? (
              <div className="mt-3 rounded-xl border-2 border-[#b8e986] bg-[#f7ffe9] p-3">
                <p className="flex items-center gap-1.5 text-xs font-extrabold text-eager-green-ink">
                  <CheckIcon className="size-4" />
                  得点を確定しました
                </p>
                <p className="mt-1 text-[11px] leading-4 text-pencil-gray">
                  会場スクリーンに第{data.questionNumber}問の得点を表示しています。
                </p>
                {previewMode ? (
                  <Link
                    href="/stage?preview=1&state=scored"
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-extrabold text-spark-blue-ink underline"
                  >
                    S-04 得点発表を確認する
                    <ArrowRightIcon className="size-3" />
                  </Link>
                ) : null}
              </div>
            ) : (
              <>
                <p className="mt-1 text-sm leading-6 text-pencil-gray">
                  統合内容をもとに第{data.questionNumber}問の得点を計算します。確定後は統合を取り消せません。
                </p>
                <button
                  type="button"
                  onClick={() => setIsConfirming(true)}
                  className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-eager-green text-sm font-extrabold text-night-ink transition-transform active:translate-y-px"
                >
                  <CheckIcon className="size-4" />
                  得点を確定する
                </button>

                {isConfirming ? (
                  <div
                    role="alertdialog"
                    aria-labelledby="grouping-confirm-dialog-heading"
                    className="mt-3 rounded-xl border-2 border-[#ffd9a8] bg-[#fff8ee] p-3"
                  >
                    <p
                      id="grouping-confirm-dialog-heading"
                      className="text-sm font-extrabold text-charcoal"
                    >
                      この内容で確定しますか？
                    </p>
                    <p className="mt-1 text-[11px] leading-4 text-pencil-gray">
                      確定後は統合の追加・取消ができません。
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleConfirm}
                        className="min-h-10 rounded-lg bg-eager-green text-xs font-extrabold text-night-ink transition-transform active:translate-y-px"
                      >
                        確定する
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsConfirming(false)}
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
        </aside>
      </main>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </div>
    </div>
  );
}
