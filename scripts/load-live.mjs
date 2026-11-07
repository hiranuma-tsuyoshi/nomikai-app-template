/**
 * 30人同時接続の負荷確認。
 * 30ブラウザコンテキストで参加 → 一斉回答 → 締切/公開の反映を測る。
 * 起動中の環境に対して: node scripts/load-live.mjs
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
const hostKey = process.env.HOST_KEY ?? "4821";
const playerCount = Number(process.env.PLAYER_COUNT ?? 30);
const roomCode = process.env.ROOM_CODE ?? "4821";
const rawTeamCount = Number(process.env.TEAM_COUNT ?? 5);
const teamCount =
  Number.isInteger(rawTeamCount) && rawTeamCount >= 2 ? rawTeamCount : 5;
const outputDir = ".review";

function assert(condition, message) {
  if (!condition) throw new Error(`Failed: ${message}`);
}

function percentile(values, ratio) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

async function call(path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.host) headers["x-host-key"] = hostKey;
  if (options.cookie) headers.cookie = options.cookie;

  const started = performance.now();
  const response = await fetch(`${baseURL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const body = await response.json().catch(() => ({}));
  return {
    status: response.status,
    body,
    ms: performance.now() - started,
  };
}

async function waitForText(page, text, timeout = 20000) {
  await page.getByText(text, { exact: false }).first().waitFor({
    state: "visible",
    timeout,
  });
}

const RETRYABLE_NETWORK_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "EPIPE"]);

async function postAnswer(context, data, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await context.request.post(`${baseURL}/api/answers`, {
        data,
        timeout: 30000,
      });
    } catch (error) {
      lastError = error;
      const code = error?.code ?? "";
      if (attempt === attempts || !RETRYABLE_NETWORK_CODES.has(code)) {
        throw error;
      }
      // 接続リセットは一時的なネットワーク要因。回答は同じ内容なので再送してよい。
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    }
  }
  throw lastError;
}

await mkdir(outputDir, { recursive: true });
const original = await call("/api/host/questions", { host: true });
assert(original.status === 200, "元のお題を取得できない");

let browser;
const contexts = [];
try {
  await call("/api/host/advance", {
    method: "POST",
    host: true,
    body: { action: "reset-all" },
  });

  let result = await call("/api/host/questions", {
    method: "PUT",
    host: true,
    body: {
      questions: [
        { id: "load-q1", text: "30人負荷テストのお題", timeLimitSeconds: 300 },
      ],
    },
  });
  assert(result.status === 200, "お題を保存できない");

  browser = await chromium.launch({ channel: "chrome" });
  const teams = Array.from(
    { length: teamCount },
    (_, index) => `team-${String.fromCharCode(97 + index)}`,
  );
  const joinTimes = [];

  for (let index = 0; index < playerCount; index += 1) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    contexts.push(context);
    const joinStarted = performance.now();
    const joined = await context.request.post(`${baseURL}/api/join`, {
      data: {
        code: roomCode,
        name: `負荷${String(index + 1).padStart(2, "0")}`,
        teamId: teams[index % teams.length],
      },
    });
    const body = await joined.json();
    assert(joined.status() === 201, `参加 ${index + 1} が失敗: ${JSON.stringify(body)}`);
    joinTimes.push(performance.now() - joinStarted);

    const page = await context.newPage();
    await page.goto(`${baseURL}/play`, { waitUntil: "domcontentloaded" });
    await waitForText(page, "参加登録ができました");
    if (index === 0) {
      await page.screenshot({ path: `${outputDir}/load-player-waiting.png` });
    }
  }

  const state = await call("/api/host/state", { host: true });
  assert(state.body.view.counts.totalParticipants === playerCount, "参加者数が一致しない");

  const hostContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const host = await hostContext.newPage();
  await host.goto(`${baseURL}/host?key=${encodeURIComponent(hostKey)}`, {
    waitUntil: "domcontentloaded",
  });
  await waitForText(host, "ゲームを開始");

  const start = await call("/api/host/advance", {
    method: "POST",
    host: true,
    body: { action: "start", expectedPhase: "WAITING" },
  });
  assert(start.status === 200, `開始に失敗: ${JSON.stringify(start.body)}`);

  const answerResults = await Promise.all(
    contexts.map(async (context, index) => {
      const answerStarted = performance.now();
      const answered = await postAnswer(context, {
        text: index % 2 === 0 ? "カレー" : "カレーライス",
      });
      const elapsed = performance.now() - answerStarted;
      if (answered.status() !== 200) {
        const body = await answered.text().catch(() => "");
        return {
          index: index + 1,
          ok: false,
          status: answered.status(),
          body: body.slice(0, 300),
          elapsed,
        };
      }
      return { index: index + 1, ok: true, status: 200, body: "", elapsed };
    }),
  );

  const answerFailures = answerResults.filter((result) => !result.ok);
  if (answerFailures.length > 0) {
    const details = answerFailures
      .slice(0, 5)
      .map(
        (result) =>
          `#${result.index} status=${result.status} body=${result.body}`,
      )
      .join(" | ");
    throw new Error(
      `回答失敗 ${answerFailures.length}/${playerCount}: ${details}`,
    );
  }

  const answerTimes = answerResults.map((result) => result.elapsed);

  await new Promise((resolve) => setTimeout(resolve, 2500));
  const answered = await call("/api/host/state", { host: true });
  assert(
    answered.body.view.counts.totalAnswered === playerCount,
    `回答数が${playerCount}になっていない: ${answered.body.view.counts.totalAnswered}`,
  );

  const close = await call("/api/host/advance", {
    method: "POST",
    host: true,
    body: { action: "close", expectedPhase: "ANSWERING" },
  });
  assert(close.status === 200, "締切に失敗");

  const finalCheckStarted = performance.now();
  await Promise.all(
    contexts.map((context) =>
      waitForText(context.pages()[0], "最終確認", 20000),
    ),
  );
  const finalCheckMs = performance.now() - finalCheckStarted;

  const reveal = await call("/api/host/advance", {
    method: "POST",
    host: true,
    body: { action: "reveal", expectedPhase: "FINAL_CHECK" },
  });
  assert(reveal.status === 200, "公開に失敗");

  const revealStarted = performance.now();
  await Promise.all(
    contexts.map((context) =>
      waitForText(context.pages()[0], "回答公開", 20000),
    ),
  );
  const revealMs = performance.now() - revealStarted;

  await waitForText(host, `回答 ${playerCount} / ${playerCount}人`);
  await host.screenshot({ path: `${outputDir}/load-host-reveal.png` });

  console.log(`OK: ${playerCount}人同時接続`);
  console.log(`  参加者反映: ${state.body.view.counts.totalParticipants}人`);
  console.log(`  回答反映: ${answered.body.view.counts.totalAnswered}人`);
  console.log(
    `  締切反映: ${Math.round(finalCheckMs)}ms / 公開反映: ${Math.round(revealMs)}ms`,
  );
  console.log(
    `  参加API p50: ${Math.round(percentile(joinTimes, 0.5))}ms / 回答API p50: ${Math.round(percentile(answerTimes, 0.5))}ms / max: ${Math.round(Math.max(...answerTimes))}ms`,
  );
  console.log(
    `  チーム配分: ${teamCount}チーム / 最小${Math.floor(playerCount / teamCount)}人（4人未満のチーム${Math.floor(playerCount / teamCount) < 4 ? "あり" : "なし"}）`,
  );
} finally {
  await call("/api/host/advance", {
    method: "POST",
    host: true,
    body: { action: "reset-all" },
  }).catch(() => undefined);
  await call("/api/host/questions", {
    method: "PUT",
    host: true,
    body: { questions: original.body.questions },
  }).catch(() => undefined);
  await browser?.close();
}
