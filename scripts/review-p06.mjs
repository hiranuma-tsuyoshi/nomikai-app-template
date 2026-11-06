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

async function newPage(viewport, path = "/play?preview=1") {
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

async function getLayout(page) {
  return page.evaluate(() => {
    const main = document.querySelector("main");
    return {
      pageScroll:
        document.documentElement.scrollHeight > window.innerHeight + 1,
      pageScrollWidth:
        document.documentElement.scrollWidth > window.innerWidth + 1,
      mainFits: main ? main.scrollHeight <= main.clientHeight + 1 : false,
      shortButtons: [...document.querySelectorAll("main button, footer button")]
        .filter((button) => {
          const style = window.getComputedStyle(button);
          return style.display !== "none" && style.visibility !== "hidden";
        })
        .map((button) => ({
          label: button.textContent?.replace(/\s+/g, " ").trim() ?? "",
          height: Math.round(button.getBoundingClientRect().height),
        }))
        .filter((button) => button.height < 44),
    };
  });
}

function checkLayout(label, layout) {
  check(`${label}: page does not scroll vertically`, !layout.pageScroll);
  check(`${label}: page does not scroll horizontally`, !layout.pageScrollWidth);
  check(`${label}: main content fits without scrolling`, layout.mainFits);
  check(
    `${label}: visible buttons meet the 44px touch target`,
    layout.shortButtons.length === 0,
  );
}

async function testDefaultFlow() {
  const page = await newPage(
    { width: 390, height: 844 },
    "/play?preview=1&state=final_check",
  );

  check(
    "default: heading is shown",
    await page.getByRole("heading", { name: "回答を公開する前に" }).isVisible(),
  );
  check(
    "default: question is shown",
    await page.getByText("朝ごはんといえば？").isVisible(),
  );
  check(
    "default: own answer is shown",
    await page.getByText("「カレー」").isVisible(),
  );
  check(
    "default: countdown is shown",
    (await page.getByRole("timer").getAttribute("aria-label"))?.startsWith(
      "公開まで 00:",
    ) ?? false,
  );
  check(
    "default: question progress is shown",
    await page.getByText("第3問 / 全8問").isVisible(),
  );
  check(
    "default: final check badge is shown",
    await page
      .getByRole("main")
      .getByText("最終確認", { exact: true })
      .isVisible(),
  );
  check(
    "default: edit button is shown",
    await page.getByRole("button", { name: "回答を修正する" }).isVisible(),
  );
  check(
    "default: confirm button is shown",
    await page.getByRole("button", { name: "この内容で確定" }).isVisible(),
  );
  check(
    "default: privacy note is shown",
    await page
      .getByText("他のチームの回答は公開まで見えません")
      .isVisible(),
  );
  check(
    "default: other teams are not shown",
    (await page.getByText("チームB").count()) === 0 &&
      (await page.getByText("チームC").count()) === 0,
  );
  checkLayout("default 390x844", await getLayout(page));
  await screenshot(page, "p06-review-default-390");

  const timer = page.getByRole("timer");
  const firstLabel = await timer.getAttribute("aria-label");
  await page.waitForTimeout(1500);
  const secondLabel = await timer.getAttribute("aria-label");
  check("default: countdown ticks down", firstLabel !== secondLabel);

  await page.getByRole("button", { name: "この内容で確定" }).click();
  check(
    "confirm: confirmation banner is shown",
    await page
      .getByText("この回答で確定しました", { exact: true })
      .isVisible(),
  );
  check(
    "confirm: footer shows confirmed state",
    await page.getByText("この回答で確定済み").isVisible(),
  );
  check(
    "confirm: edit remains available",
    await page.getByRole("button", { name: "回答を修正する" }).isVisible(),
  );
  check(
    "confirm: timer keeps running",
    await page.getByRole("timer").isVisible(),
  );
  await screenshot(page, "p06-review-confirmed-390");

  await page.getByRole("button", { name: "回答を修正する" }).click();
  check(
    "edit: input has the current answer",
    (await page.locator("#final-check-answer").inputValue()) === "カレー",
  );
  check(
    "edit: save is enabled with the current answer",
    await page.getByRole("button", { name: "修正を保存する" }).isEnabled(),
  );
  await page.locator("#final-check-answer").fill("寿司");
  await page.getByRole("button", { name: "修正を保存する" }).click();
  check(
    "edit: new answer is shown",
    await page.getByText("「寿司」").isVisible(),
  );
  check(
    "edit: confirmation is reset after saving",
    (await page
      .getByText("この回答で確定しました", { exact: true })
      .count()) === 0,
  );
  check(
    "edit: confirm button returns",
    await page.getByRole("button", { name: "この内容で確定" }).isVisible(),
  );

  await page.getByRole("button", { name: "回答を修正する" }).click();
  await page.locator("#final-check-answer").fill("おにぎり");
  await page.getByRole("button", { name: "修正をやめる" }).click();
  check(
    "edit: cancel keeps the saved answer",
    await page.getByText("「寿司」").isVisible(),
  );

  await page.getByRole("button", { name: "この内容で確定" }).click();
  check(
    "edit: can confirm again after saving",
    await page.getByText("この回答で確定済み").isVisible(),
  );

  await page.close();
}

async function testStatesAndLayouts() {
  const states = [
    "final_check",
    "final_check_confirmed",
    "final_check_editing",
    "final_check_unanswered",
    "final_check_low_time",
    "final_check_timeup",
  ];

  for (const state of states) {
    for (const [width, height] of [
      [390, 844],
      [320, 568],
    ]) {
      const page = await newPage(
        { width, height },
        `/play?preview=1&state=${state}`,
      );
      await page.addStyleTag({
        content: "div.shrink-0.bg-night-ink { display: none !important; }",
      });
      const layout = await getLayout(page);
      checkLayout(`${state} ${width}x${height}`, layout);

      if (width === 390) {
        await screenshot(page, `p06-review-${state}-390`);
      } else {
        await screenshot(page, `p06-review-${state}-320`);
      }
      await page.close();
    }
  }
}

async function testConfirmedAndEditing() {
  const confirmedPage = await newPage(
    { width: 390, height: 844 },
    "/play?preview=1&state=final_check_confirmed",
  );
  check(
    "confirmed: banner is shown",
    await confirmedPage
      .getByText("この回答で確定しました", { exact: true })
      .isVisible(),
  );
  check(
    "confirmed: footer shows confirmed",
    await confirmedPage.getByText("この回答で確定済み").isVisible(),
  );
  check(
    "confirmed: answer is shown",
    await confirmedPage.getByText("「カレー」").isVisible(),
  );
  await confirmedPage.close();

  const editingPage = await newPage(
    { width: 390, height: 844 },
    "/play?preview=1&state=final_check_editing",
  );
  check(
    "editing: input is prefilled",
    (await editingPage.locator("#final-check-answer").inputValue()) === "カレー",
  );
  check(
    "editing: character counter is shown",
    await editingPage.getByText("3 / 20文字").isVisible(),
  );
  check(
    "editing: save button is shown",
    await editingPage.getByRole("button", { name: "修正を保存する" }).isVisible(),
  );
  check(
    "editing: cancel button is shown",
    await editingPage.getByRole("button", { name: "修正をやめる" }).isVisible(),
  );
  check(
    "editing: confirm button is hidden",
    (await editingPage.getByRole("button", { name: "この内容で確定" }).count()) ===
      0,
  );
  await editingPage.close();
}

async function testUnanswered() {
  const page = await newPage(
    { width: 390, height: 844 },
    "/play?preview=1&state=final_check_unanswered",
  );

  check(
    "unanswered: no-answer label is shown",
    await page.getByRole("main").getByText("回答なし").isVisible(),
  );
  check(
    "unanswered: footer shows no answer",
    await page.getByText("回答がありません").isVisible(),
  );
  check(
    "unanswered: explanation is shown",
    await page
      .getByText("今回は回答が間に合いませんでした。公開までお待ちください。")
      .isVisible(),
  );
  check(
    "unanswered: edit button is hidden",
    (await page.getByRole("button", { name: "回答を修正する" }).count()) === 0,
  );
  check(
    "unanswered: confirm button is hidden",
    (await page.getByRole("button", { name: "この内容で確定" }).count()) === 0,
  );
  await page.close();
}

async function testTimeup() {
  const page = await newPage(
    { width: 390, height: 844 },
    "/play?preview=1&state=final_check_timeup",
  );

  check(
    "timeup: published message is shown twice",
    (await page.getByText("回答を公開しました", { exact: true }).count()) === 2,
  );
  check(
    "timeup: published badges are shown",
    (await page.getByText("公開", { exact: true }).count()) === 2,
  );
  check(
    "timeup: answer is locked",
    await page.getByText("公開済みのため修正できません").isVisible(),
  );
  check(
    "timeup: edit button is hidden",
    (await page.getByRole("button", { name: "回答を修正する" }).count()) === 0,
  );
  check(
    "timeup: timer is hidden",
    (await page.getByRole("timer").count()) === 0,
  );
  await page.close();
}

async function testAutoPublish() {
  const page = await newPage(
    { width: 390, height: 844 },
    "/play?preview=1&state=final_check_low_time",
  );

  const label = await page.getByRole("timer").getAttribute("aria-label");
  check(
    "low_time: starts with five seconds or fewer",
    /公開まで 00:0[0-5]$/.test(label ?? ""),
  );

  await page
    .getByText("回答を公開しました", { exact: true })
    .first()
    .waitFor({ timeout: 9000 });
  check(
    "low_time: timer automatically publishes",
    (await page.getByText("回答を公開しました", { exact: true }).count()) === 2,
  );
  check(
    "low_time: confirm is no longer available",
    (await page.getByRole("button", { name: "この内容で確定" }).count()) === 0,
  );
  await page.close();
}

async function testPreviewNavigation() {
  const page = await newPage(
    { width: 390, height: 844 },
    "/play?preview=1&state=final_check",
  );

  check(
    "preview: participant label is shown",
    await page.getByText("参加者 Preview").isVisible(),
  );
  check(
    "preview: current state is marked",
    (await page
      .getByRole("link", { name: "最終確認" })
      .getAttribute("aria-current")) === "true",
  );

  await page.getByRole("link", { name: "確定済み" }).click();
  await page.waitForURL("**/play?preview=1&state=final_check_confirmed");
  check(
    "preview: confirmed link switches state",
    await page.getByText("この回答で確定済み").isVisible(),
  );

  await page.getByRole("link", { name: "時間切れ" }).click();
  await page.waitForURL("**/play?preview=1&state=final_check_timeup");
  check(
    "preview: timeup link switches state",
    await page.getByText("公開済みのため修正できません").isVisible(),
  );

  await page.getByRole("link", { name: "通常" }).click();
  await page.waitForURL("**/play?preview=1&state=default");
  check(
    "preview: P-04 state still works",
    await page.getByRole("button", { name: "回答する" }).isVisible(),
  );

  await page.getByRole("link", { name: "閉じる" }).click();
  await page.waitForURL((url) => url.pathname === "/play" && !url.search);
  check(
    "preview: closing removes the preview bar",
    (await page.getByText("参加者 Preview").count()) === 0,
  );
  await page.getByRole("heading", { name: "以心伝心ゲーム" }).waitFor({
    state: "visible",
    timeout: 10000,
  });
  check(
    "production: live join screen is shown",
    (await page.getByRole("heading", { name: "以心伝心ゲーム" }).isVisible()) &&
      (await page.getByRole("button", { name: "参加する" }).isVisible()),
  );

  await page.close();
}

try {
  await testDefaultFlow();
  await testStatesAndLayouts();
  await testConfirmedAndEditing();
  await testUnanswered();
  await testTimeup();
  await testAutoPublish();
  await testPreviewNavigation();
} finally {
  await browser.close();
}

for (const result of results) {
  console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}`);
}

console.log(`\n${results.length} checks passed`);
