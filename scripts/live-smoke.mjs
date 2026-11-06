/**
 * ライブAPIの通し確認。
 * 起動中の dev / 本番URLに対して:
 *   BASE_URL=http://localhost:3000 node scripts/live-smoke.mjs
 * を実行する。終了時は必ず WAITING に戻し、お題も元に戻す。
 */
const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
const hostKey = process.env.HOST_KEY ?? "4821";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function call(path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.host) headers["x-host-key"] = hostKey;
  if (options.cookie) headers.cookie = options.cookie;

  const response = await fetch(`${baseURL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const body = await response.json().catch(() => ({}));
  return {
    status: response.status,
    body,
    cookie: (response.headers.getSetCookie?.() ?? [])
      .map((value) => value.split(";")[0])
      .join("; "),
  };
}

async function host(path, options = {}) {
  return call(path, { ...options, host: true });
}

const original = await host("/api/host/questions");
assert(original.status === 200, `お題の取得に失敗: ${original.status}`);

try {
  let result = await host("/api/host/advance", {
    method: "POST",
    body: { action: "reset-all" },
  });
  assert(result.status === 200, `リセットに失敗: ${JSON.stringify(result.body)}`);

  result = await host("/api/host/questions", {
    method: "PUT",
    body: {
      questions: [
        { id: "smoke-q1", text: "テストのお題1", timeLimitSeconds: 60 },
        { id: "smoke-q2", text: "テストのお題2", timeLimitSeconds: 30 },
      ],
    },
  });
  assert(result.status === 200, `お題の保存に失敗: ${JSON.stringify(result.body)}`);

  const players = [];
  const names = [
    ["team-a", "A1", "カレー"],
    ["team-a", "A2", "カレー"],
    ["team-a", "A3", "カレーライス"],
    ["team-a", "A4", "カレーライス"],
    ["team-b", "B1", "寿司"],
    ["team-b", "B2", "寿司"],
    ["team-b", "B3", "寿司"],
    ["team-b", "B4", "蕎麦"],
  ];

  for (const [teamId, name, answer] of names) {
    const joined = await call("/api/join", {
      method: "POST",
      body: { code: "4821", name, teamId },
    });
    assert(
      joined.status === 201,
      `参加に失敗 (${name}): ${JSON.stringify(joined.body)}`,
    );
    players.push({ ...joined, name, answer });
  }

  const movedPlayer = players[3].body.view.me.id;
  result = await host("/api/host/teams", {
    method: "POST",
    body: { action: "move-player", playerId: movedPlayer, teamId: "team-b" },
  });
  assert(result.status === 200, `参加者の移動に失敗: ${JSON.stringify(result.body)}`);
  result = await host("/api/host/teams", {
    method: "POST",
    body: { action: "move-player", playerId: movedPlayer, teamId: "team-a" },
  });
  assert(result.status === 200, `参加者を戻せない: ${JSON.stringify(result.body)}`);

  result = await host("/api/host/advance", {
    method: "POST",
    body: { action: "start", expectedPhase: "WAITING" },
  });
  assert(result.status === 200, `開始に失敗: ${JSON.stringify(result.body)}`);
  assert(result.body.view.room.frozen === true, "開始後にお題が凍結されていない");

  const frozenSave = await host("/api/host/questions", {
    method: "PUT",
    body: { questions: original.body.questions },
  });
  assert(frozenSave.status === 409, "開始後にお題を変更できてしまう");

  for (const player of players) {
    const submitted = await call("/api/answers", {
      method: "POST",
      body: { text: player.answer },
      cookie: player.cookie,
    });
    assert(
      submitted.status === 200,
      `回答に失敗 (${player.name}): ${JSON.stringify(submitted.body)}`,
    );
  }

  const state = await host("/api/host/state");
  assert(state.status === 200, "司会者状態の取得に失敗");
  assert(state.body.view.counts.totalAnswered === 8, "回答数が8になっていない");
  const screenToken = state.body.view.room.screenToken;
  assert(screenToken, "スクリーントークンが取得できない");

  result = await host("/api/host/advance", {
    method: "POST",
    body: { action: "close", expectedPhase: "ANSWERING" },
  });
  assert(result.status === 200, `締切に失敗: ${JSON.stringify(result.body)}`);
  assert(result.body.view.phase === "FINAL_CHECK", "最終確認に進んでいない");

  result = await host("/api/host/advance", {
    method: "POST",
    body: { action: "reveal", expectedPhase: "FINAL_CHECK" },
  });
  assert(result.status === 200, `公開に失敗: ${JSON.stringify(result.body)}`);

  result = await host("/api/host/advance", {
    method: "POST",
    body: { action: "grouping", expectedPhase: "REVEAL" },
  });
  assert(result.status === 200, `統合フェーズに失敗: ${JSON.stringify(result.body)}`);

  const grouping = await host("/api/host/state");
  const teamA = grouping.body.view.teams.find((team) => team.id === "team-a");
  assert(teamA, "チームAが見つからない");
  assert(teamA.groups.length === 2, "自動グループが2つになっていない");

  result = await host("/api/host/groups", {
    method: "POST",
    body: {
      action: "merge",
      teamId: "team-a",
      keys: teamA.groups.map((group) => group.key),
      label: "カレー",
      reason: "同じ料理として",
    },
  });
  assert(result.status === 200, `統合に失敗: ${JSON.stringify(result.body)}`);

  const merged = result.body.view.teams.find((team) => team.id === "team-a");
  assert(merged.groups.length === 1, "統合後のグループが1つになっていない");
  assert(merged.groups[0].count === 4, "統合後の人数が4になっていない");

  result = await host("/api/host/advance", {
    method: "POST",
    body: { action: "score", expectedPhase: "GROUPING" },
  });
  assert(result.status === 200, `得点確定に失敗: ${JSON.stringify(result.body)}`);

  const board = result.body.view.scoreboard;
  const scoreA = board.teams.find((team) => team.id === "team-a");
  const scoreB = board.teams.find((team) => team.id === "team-b");
  assert(scoreA.points === 10 && scoreA.perfectCount >= 0, "チームAが10点になっていない");
  assert(scoreB.points === 8, "チームBが8点になっていない");

  result = await host("/api/host/advance", {
    method: "POST",
    body: { action: "next", expectedPhase: "SCORED" },
  });
  assert(result.status === 200, `次のお題に失敗: ${JSON.stringify(result.body)}`);

  result = await host("/api/host/advance", {
    method: "POST",
    body: { action: "finish", expectedPhase: "ANSWERING" },
  });
  assert(result.status === 200, `終了に失敗: ${JSON.stringify(result.body)}`);
  assert(result.body.view.final, "最終結果がない");

  const stage = await call(
    `/api/stage?token=${encodeURIComponent(screenToken)}`,
  );
  assert(stage.status === 200, "スクリーン状態の取得に失敗");
  assert(stage.body.view.phase === "FINISHED", "スクリーンが終了状態になっていない");

  console.log("OK: 参加8人 → 開始 → 回答 → 最終確認 → 公開 → 統合 → 得点 → 最終結果");
  console.log(`  チームA: ${scoreA.points}pt / チームB: ${scoreB.points}pt`);
} finally {
  await host("/api/host/advance", {
    method: "POST",
    body: { action: "reset-all" },
  }).catch(() => undefined);
  await host("/api/host/questions", {
    method: "PUT",
    body: { questions: original.body.questions },
  }).catch(() => undefined);
}
