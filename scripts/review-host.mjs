import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
const outputDir = ".review";

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const results = [];

function check(name, condition) {
  results.push({ name, ok: Boolean(condition) });
  if (!condition) {
    throw new Error(`Failed: ${name}`);
  }
}

async function newPage(viewport, path = "/host?preview=1") {
  const page = await browser.newPage({ viewport });
  await page.goto(`${baseURL}${path}`, { waitUntil: "networkidle" });
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  await page.waitForTimeout(400);
  return page;
}

async function screenshot(page, name) {
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${outputDir}/${name}.png` });
}

function teamStatusSection(page) {
  return page.locator('section[aria-labelledby="team-status-heading"]');
}

function answerGroupsSection(page) {
  return page.locator('section[aria-labelledby="answer-groups-heading"]');
}

function scoreSummarySection(page) {
  return page.locator('section[aria-labelledby="score-summary-heading"]');
}

async function checkLayout(page, label) {
  const layout = await page.evaluate(() => {
    const scroller = document.querySelector(".overflow-y-auto");
    const main = document.querySelector("main");

    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      scrollerWidth: scroller?.scrollWidth ?? 0,
      scrollerClientWidth: scroller?.clientWidth ?? 0,
      scrollerHeight: scroller?.scrollHeight ?? 0,
      scrollerClientHeight: scroller?.clientHeight ?? 0,
      mainWidth: main ? Math.round(main.getBoundingClientRect().width) : 0,
    };
  });

  check(
    `${label}: no horizontal page overflow`,
    layout.documentWidth <= layout.viewportWidth &&
      layout.scrollerWidth <= layout.scrollerClientWidth + 1,
  );
  check(
    `${label}: host console fits in one screen`,
    layout.scrollerHeight <= layout.scrollerClientHeight + 1,
  );
  check(`${label}: main column is present`, layout.mainWidth > 0);
}

async function testStaticAnswering() {
  const page = await newPage({ width: 1440, height: 900 });
  const headerText = await page.locator("header").innerText();

  check("answering: title is shown", headerText.includes("進行管理"));
  check("answering: room code is shown", headerText.includes("4821"));
  check("answering: question progress is shown", headerText.includes("第3問 / 全8問"));
  check("answering: phase badge is shown", headerText.includes("回答受付中"));
  check("answering: answer count is 22 / 30", headerText.includes("22 / 30人"));
  check(
    "answering: question text is shown",
    await page.getByRole("heading", { name: "朝ごはんといえば？" }).isVisible(),
  );
  check(
    "answering: five team cards are shown",
    (await teamStatusSection(page).locator("> ul > li").count()) === 5,
  );
  check(
    "answering: host team is marked",
    (await teamStatusSection(page).getByText("あなた").count()) === 1,
  );
  check(
    "answering: team D is marked as not scored",
    (await teamStatusSection(page).locator("li").getByText("採点対象外", { exact: true }).count()) === 1,
  );
  const teamDText = await teamStatusSection(page)
    .locator("> ul > li")
    .filter({ hasText: "チームD" })
    .innerText();
  check("answering: team D shows 3 / 6", teamDText.includes("3/ 6人"));
  check(
    "answering: own answer form is shown",
    await page.getByLabel("回答を入力").isVisible(),
  );
  check(
    "answering: submit is disabled while empty",
    !(await page.getByRole("button", { name: "回答する" }).isEnabled()),
  );
  check(
    "answering: close button is shown",
    await page.getByRole("button", { name: "回答を締め切る" }).isVisible(),
  );
  check(
    "answering: skip and abort buttons are shown",
    (await page.getByRole("button", { name: "お題をスキップ" }).isVisible()) &&
      (await page.getByRole("button", { name: "中断" }).isVisible()),
  );
  check(
    "answering: progressbar reports 22 of 30",
    (await page.getByRole("progressbar", { name: "回答済み人数" }).getAttribute("aria-valuenow")) ===
      "22",
  );
  await screenshot(page, "h05-review-answering-1440");
  await page.close();
}

async function testAnswerFlow() {
  const page = await newPage(
    { width: 1366, height: 768 },
    "/host?preview=1&state=answering",
  );

  await page.getByLabel("回答を入力").fill("寿司");
  check(
    "answer: submit is enabled after input",
    await page.getByRole("button", { name: "回答する" }).isEnabled(),
  );
  await page.getByRole("button", { name: "回答する" }).click();

  check(
    "answer: submitted state is shown",
    (await page.getByText("送信済み").count()) === 1,
  );
  check(
    "answer: submitted value is shown",
    await page.getByText("「寿司」").isVisible(),
  );
  check(
    "answer: header count increments to 23 / 30",
    (await page.locator("header").innerText()).includes("23 / 30人"),
  );
  check(
    "answer: host team becomes 6 / 6",
    (await teamStatusSection(page).locator("> ul > li").filter({ hasText: "チームA" }).innerText()).includes(
      "6/ 6人",
    ),
  );
  check(
    "answer: host team shows all answered",
    (await teamStatusSection(page).locator("> ul > li").filter({ hasText: "チームA" }).innerText()).includes(
      "全員回答",
    ),
  );
  await screenshot(page, "h05-review-submitted-1366");

  await page.getByRole("button", { name: "回答を修正する" }).click();
  check(
    "answer: edit restores the submitted value",
    (await page.locator("#host-answer").inputValue()) === "寿司",
  );
  await page.locator("#host-answer").fill("カレー");
  await page.getByRole("button", { name: "回答する" }).click();
  check(
    "answer: edited value is shown",
    await page.getByText("「カレー」").isVisible(),
  );

  await page.getByRole("button", { name: "回答を締め切る" }).click();
  check(
    "close: phase becomes final check",
    (await page.locator("header").innerText()).includes("最終確認中"),
  );
  check(
    "close: publish button is shown",
    await page.getByRole("button", { name: "今すぐ公開する" }).isVisible(),
  );
  check(
    "close: extend and shorten buttons are shown",
    (await page.getByRole("button", { name: "+15秒 延長" }).isVisible()) &&
      (await page.getByRole("button", { name: "−15秒 短縮" }).isVisible()),
  );
  check(
    "close: own answer can still be edited",
    await page.getByRole("button", { name: "回答を修正する" }).isVisible(),
  );
  await screenshot(page, "h05-review-final-check-1366");

  await page.getByRole("button", { name: "−15秒 短縮" }).click();
  await page.getByRole("button", { name: "−15秒 短縮" }).click();
  await page.waitForTimeout(300);
  check(
    "shorten: reaching zero publishes the answers",
    (await page.locator("header").innerText()).includes("回答公開中"),
  );
  check(
    "reveal: answer groups are shown",
    (await page.getByRole("heading", { name: "回答グループ" }).count()) === 1,
  );
  check(
    "reveal: five team groups are shown",
    (await answerGroupsSection(page).locator("> ul > li").count()) === 5,
  );
  check(
    "reveal: merged answer reason is shown",
    await page.getByText("「みそ汁」を統合").isVisible(),
  );
  check(
    "reveal: not-scored reason is shown",
    await page.getByText("回答者4人未満のため採点対象外").isVisible(),
  );
  check(
    "reveal: own answer is locked",
    await page.getByText("公開済みのため修正できません").isVisible(),
  );
  await screenshot(page, "h05-review-reveal-1366");

  await page.getByRole("button", { name: "得点を確定する" }).click();
  check(
    "scored: score summary is shown",
    (await page.getByRole("heading", { name: "第3問の得点" }).count()) === 1,
  );
  check(
    "scored: five score rows are shown",
    (await scoreSummarySection(page).locator("> ol > li").count()) === 5,
  );
  const firstRow = await scoreSummarySection(page)
    .locator("> ol > li")
    .first()
    .innerText();
  check("scored: leader is team B", firstRow.includes("チームB"));
  check("scored: leader total is 31pt", firstRow.includes("31"));
  check(
    "scored: team D is still excluded",
    (await scoreSummarySection(page).getByText("採点対象外", { exact: true }).count()) === 1,
  );
  await screenshot(page, "h05-review-scored-1366");

  await page.getByRole("button", { name: "次のお題へ" }).click();
  await page.waitForTimeout(250);
  const nextHeader = await page.locator("header").innerText();
  check("next: question number advances", nextHeader.includes("第4問 / 全8問"));
  check("next: answer count resets", nextHeader.includes("0 / 30人"));
  check(
    "next: next question text is shown",
    await page.getByRole("heading", { name: "飲み会で最初に頼むものといえば？" }).isVisible(),
  );

  await page.close();
}

async function testSkipAndAbort() {
  const page = await newPage(
    { width: 1366, height: 768 },
    "/host?preview=1&state=answering",
  );

  await page.getByRole("button", { name: "お題をスキップ" }).click();
  check(
    "skip: confirmation dialog is shown",
    await page.getByRole("alertdialog").isVisible(),
  );
  check(
    "skip: dialog explains the action",
    await page.getByText("このお題の回答は使わず、次のお題に進みます。").isVisible(),
  );
  await page.getByRole("button", { name: "やめる" }).click();
  check(
    "skip: cancel keeps the current question",
    (await page.getByRole("alertdialog").count()) === 0 &&
      (await page.locator("header").innerText()).includes("第3問"),
  );

  await page.getByRole("button", { name: "お題をスキップ" }).click();
  await page.getByRole("button", { name: "スキップする" }).click();
  check(
    "skip: question advances",
    (await page.locator("header").innerText()).includes("第4問 / 全8問"),
  );
  check(
    "skip: answers are cleared",
    (await page.locator("header").innerText()).includes("0 / 30人"),
  );

  await page.getByRole("button", { name: "中断" }).click();
  check(
    "abort: confirmation dialog is shown",
    await page.getByText("ゲームを中断しますか？").isVisible(),
  );
  await page.getByRole("button", { name: "中断する" }).click();
  check(
    "abort: stopped state is shown",
    await page.getByText("ゲームを中断しました").first().isVisible(),
  );
  check(
    "abort: own answer input is disabled",
    await page.locator("#host-answer").isDisabled(),
  );
  await page.getByRole("button", { name: "ゲームを再開する" }).click();
  check(
    "abort: resume restores the input",
    !(await page.locator("#host-answer").isDisabled()),
  );

  await page.close();
}

async function testPreviewNavigation() {
  const page = await newPage(
    { width: 1366, height: 768 },
    "/host?preview=1&state=answering",
  );

  check(
    "preview: current state is marked",
    (await page.getByRole("link", { name: "回答受付中" }).getAttribute("aria-current")) ===
      "true",
  );

  await page.getByRole("link", { name: "最終確認" }).click();
  await page.waitForURL("**/host?preview=1&state=final_check");
  check(
    "preview: 最終確認 link switches state",
    (await page.locator("header").innerText()).includes("最終確認中"),
  );
  check(
    "preview: final check shows the submitted answer",
    await page.getByText("「カレー」").isVisible(),
  );

  await page.getByRole("link", { name: "回答公開" }).click();
  await page.waitForURL("**/host?preview=1&state=reveal");
  check(
    "preview: 回答公開 link switches state",
    (await page.getByRole("heading", { name: "回答グループ" }).count()) === 1,
  );

  await page.getByRole("link", { name: "得点確定" }).click();
  await page.waitForURL("**/host?preview=1&state=scored");
  check(
    "preview: 得点確定 link switches state",
    (await page.getByRole("heading", { name: "第3問の得点" }).count()) === 1,
  );

  await page.getByRole("link", { name: "閉じる" }).click();
  await page.waitForURL((url) => url.pathname === "/host" && !url.search);
  check(
    "preview: closing removes the preview bar",
    (await page.getByText("H-05 Preview").count()) === 0,
  );
  await page.getByRole("heading", { name: "司会者ログイン" }).waitFor({
    state: "visible",
    timeout: 10000,
  });
  check(
    "production: host login is shown without preview",
    await page.getByRole("heading", { name: "司会者ログイン" }).isVisible(),
  );

  await page.close();
}

async function testLayouts() {
  const cases = [
    [1440, 900],
    [1366, 768],
    [1280, 800],
  ];

  for (const state of ["answering", "final_check", "reveal", "scored"]) {
    for (const [width, height] of cases) {
      const page = await newPage(
        { width, height },
        `/host?preview=1&state=${state}`,
      );
      await page.addStyleTag({
        content: "div.shrink-0.bg-night-ink { display: none !important; }",
      });
      await checkLayout(page, `${state} ${width}x${height}`);

      if (width === 1366) {
        await screenshot(page, `h05-review-${state}-1366`);
      }
      await page.close();
    }
  }
}

try {
  await testStaticAnswering();
  await testAnswerFlow();
  await testSkipAndAbort();
  await testPreviewNavigation();
  await testLayouts();
} finally {
  await browser.close();
}

for (const result of results) {
  console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}`);
}

console.log(`\n${results.length} checks passed`);
