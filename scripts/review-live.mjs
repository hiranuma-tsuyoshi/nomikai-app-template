import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
const hostKey = process.env.HOST_KEY ?? "4821";
const outputDir = ".review";

function assert(condition, message) {
  if (!condition) throw new Error(`Failed: ${message}`);
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

async function waitForText(page, text, timeout = 15000) {
  await page.getByText(text, { exact: false }).first().waitFor({
    state: "visible",
    timeout,
  });
}

async function clickButton(page, name, timeout = 15000) {
  const button = page.getByRole("button", { name, exact: true }).first();
  await button.waitFor({ state: "visible", timeout });
  await button.click();
}

await mkdir(outputDir, { recursive: true });

const original = await call("/api/host/questions", { host: true });
assert(original.status === 200, "元のお題を取得できない");

let browser;
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
        { id: "e2e-q1", text: "E2Eテストのお題", timeLimitSeconds: 60 },
        { id: "e2e-q2", text: "E2Eテストの2問目", timeLimitSeconds: 30 },
      ],
    },
  });
  assert(result.status === 200, "お題を保存できない");

  const rawPlayers = [];
  async function join(name, teamId, answer) {
    const joined = await call("/api/join", {
      method: "POST",
      body: { code: "4821", name, teamId },
    });
    assert(joined.status === 201, `${name} が参加できない`);
    rawPlayers.push({ name, answer, cookie: joined.cookie });
  }

  await join("A2", "team-a", "カレー");
  await join("A3", "team-a", "カレーライス");
  await join("A4", "team-a", "カレーライス");
  await join("B1", "team-b", "寿司");
  await join("B2", "team-b", "寿司");
  await join("B3", "team-b", "寿司");
  await join("B4", "team-b", "蕎麦");

  browser = await chromium.launch({ channel: "chrome" });
  const hostContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const playerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const stageContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

  const player = await playerContext.newPage();
  await player.goto(`${baseURL}/play`, { waitUntil: "domcontentloaded" });
  await waitForText(player, "以心伝心ゲーム");
  await player.locator("#player-name").fill("A1");
  await player.locator('input[name="team"][value="team-a"]').check();
  await clickButton(player, "参加する");
  await waitForText(player, "参加登録ができました");
  await player.screenshot({ path: `${outputDir}/live-player-waiting.png` });

  const host = await hostContext.newPage();
  await host.goto(`${baseURL}/host?key=${encodeURIComponent(hostKey)}`, {
    waitUntil: "domcontentloaded",
  });
  await waitForText(host, "ゲームを開始");
  await host.screenshot({ path: `${outputDir}/live-host-pregame.png` });

  const stateBefore = await call("/api/host/state", { host: true });
  assert(stateBefore.status === 200, "司会者状態を取得できない");
  const screenToken = stateBefore.body.view.room.screenToken;

  await clickButton(host, "ゲームを開始");
  await waitForText(host, "回答受付中");
  await waitForText(player, "E2Eテストのお題");

  for (const entry of rawPlayers) {
    const answered = await call("/api/answers", {
      method: "POST",
      body: { text: entry.answer },
      cookie: entry.cookie,
    });
    assert(answered.status === 200, `${entry.name} の回答に失敗`);
  }

  await player.locator('input[placeholder="答えを入力"]').fill("カレーライス");
  await clickButton(player, "回答する");
  await waitForText(player, "回答を修正する");

  await waitForText(host, "8 / 8人");
  await host.screenshot({ path: `${outputDir}/live-host-answering.png` });

  await clickButton(host, "回答を締め切る");
  await waitForText(host, "最終確認中");
  await waitForText(player, "最終確認");
  await clickButton(player, "この内容で確定");
  await waitForText(player, "この回答で確定しました");
  await player.screenshot({ path: `${outputDir}/live-player-final-check.png` });

  await clickButton(host, "今すぐ公開する");
  await waitForText(host, "回答公開中");
  await waitForText(player, "回答公開");

  const stage = await stageContext.newPage();
  await stage.goto(`${baseURL}/stage?token=${encodeURIComponent(screenToken)}`, {
    waitUntil: "domcontentloaded",
  });
  await waitForText(stage, "回答公開");
  await waitForText(stage, "カレー");
  await stage.screenshot({ path: `${outputDir}/live-stage-reveal.png` });

  await clickButton(host, "グループ統合へ");
  await waitForText(host, "グループ統合");
  const groupButtons = host.locator("button[aria-pressed]");
  await groupButtons.nth(0).click();
  await groupButtons.nth(1).click();
  await host.locator("#merge-label").fill("カレー");
  await host.locator("#merge-reason").fill("同じ料理として");
  await clickButton(host, "統合する");
  await waitForText(host, "統合済み");
  await waitForText(host, "同じ料理として");
  await host.screenshot({ path: `${outputDir}/live-host-grouping.png` });

  await clickButton(host, "得点を確定する");
  await waitForText(host, "得点確定");
  await waitForText(host, "10pt");
  await waitForText(host, "8pt");
  await waitForText(player, "結果");
  await host.screenshot({ path: `${outputDir}/live-host-scored.png` });
  await stage.waitForTimeout(1200);
  await stage.screenshot({ path: `${outputDir}/live-stage-scored.png` });

  await clickButton(host, "次のお題へ");
  await waitForText(host, "E2Eテストの2問目");

  result = await call("/api/host/advance", {
    method: "POST",
    host: true,
    body: { action: "finish", expectedPhase: "ANSWERING" },
  });
  assert(result.status === 200, "ゲームを終了できない");
  await host.reload({ waitUntil: "domcontentloaded" });
  await waitForText(host, "最終結果");
  await waitForText(stage, "最終結果");
  await stage.screenshot({ path: `${outputDir}/live-stage-final.png` });
  await player.waitForTimeout(1500);
  await waitForText(player, "最終結果");
  await player.screenshot({ path: `${outputDir}/live-player-final.png` });

  console.log("OK: UI通し（参加→開始→回答→最終確認→公開→統合→得点→最終結果）");
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
