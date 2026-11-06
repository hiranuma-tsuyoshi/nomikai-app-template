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

async function newPage(viewport, path = "/host/questions?preview=1") {
  const page = await browser.newPage({ viewport });
  await page.goto(`${baseURL}${path}`, { waitUntil: "networkidle" });
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  if (path.startsWith("/host/questions") && path.includes("preview=1")) {
    await page.waitForSelector('[data-hydrated="true"]');
  }
  await page.waitForTimeout(150);
  return page;
}

async function screenshot(page, name) {
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${outputDir}/${name}.png` });
}

function list(page) {
  return page.locator('ol[aria-label="お題一覧"] > li');
}

function row(page, text) {
  return list(page).filter({ hasText: text });
}

function addButton(page) {
  return page.getByRole("button", { name: "お題を追加", exact: true });
}

function saveButton(page) {
  return page.getByRole("button", { name: "保存する" });
}

function editor(page) {
  return page.locator('section[aria-labelledby="question-editor-heading"]');
}

function deleteDialog(page) {
  return page.getByRole("alertdialog");
}

async function getLayout(page) {
  return page.evaluate(() => {
    const scroller = document.querySelector(".overflow-y-auto");
    const rows = [...document.querySelectorAll('ol[aria-label="お題一覧"] > li')];
    const texts = [
      ...document.querySelectorAll(
        'ol[aria-label="お題一覧"] > li p.break-words',
      ),
    ];
    const header = document.querySelector("header");

    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      scrollerWidth: scroller?.scrollWidth ?? 0,
      scrollerClientWidth: scroller?.clientWidth ?? 0,
      scrollerHeight: scroller?.scrollHeight ?? 0,
      scrollerClientHeight: scroller?.clientHeight ?? 0,
      rowOverflow: rows.some(
        (entry) => entry.scrollWidth > entry.clientWidth + 1,
      ),
      textOverflow: texts.some(
        (entry) => entry.scrollWidth > entry.clientWidth + 1,
      ),
      headerOverflow: header
        ? header.scrollWidth > header.clientWidth + 1
        : false,
    };
  });
}

function checkLayout(label, layout, { allowVerticalScroll = true } = {}) {
  check(
    `${label}: no horizontal page overflow`,
    layout.documentWidth <= layout.viewportWidth + 1,
  );
  check(
    `${label}: scroller does not overflow horizontally`,
    layout.scrollerWidth <= layout.scrollerClientWidth + 1,
  );
  check(`${label}: rows do not overflow horizontally`, !layout.rowOverflow);
  check(`${label}: question text is not clipped`, !layout.textOverflow);
  check(`${label}: header does not overflow`, !layout.headerOverflow);
  if (!allowVerticalScroll) {
    check(
      `${label}: fits in one screen`,
      layout.scrollerHeight <= layout.scrollerClientHeight + 1,
    );
  }
}

async function testDefault() {
  const page = await newPage({ width: 1440, height: 900 });
  const headerText = await page.locator("header").innerText();

  check("default: title is shown", headerText.includes("お題管理"));
  check("default: room code is shown", headerText.includes("4821"));
  check("default: question count is shown", headerText.includes("全8問"));
  check("default: total time is shown", headerText.includes("9分"));
  check(
    "default: list heading is shown",
    await page.getByRole("heading", { name: "お題一覧" }).isVisible(),
  );
  check(
    "default: list helper is shown",
    await page
      .getByText("上から順に出題されます。編集・削除・並べ替えができます。")
      .isVisible(),
  );
  check("default: add button is shown", await addButton(page).isVisible());
  check("default: eight questions are shown", (await list(page).count()) === 8);
  check(
    "default: first question is shown",
    (await list(page).first().innerText()).includes("休日の過ごし方といえば？"),
  );
  check(
    "default: third question is shown",
    (await list(page).nth(2).innerText()).includes("朝ごはんといえば？"),
  );
  check(
    "default: fourth question is shown",
    (await list(page).nth(3).innerText()).includes(
      "飲み会で最初に頼むものといえば？",
    ),
  );
  check(
    "default: last question is shown",
    (await list(page).last().innerText()).includes(
      "この飲み会を一言で表すと？",
    ),
  );
  check(
    "default: 60 second limit is shown",
    (await list(page).first().innerText()).includes("制限時間 60秒"),
  );
  check(
    "default: 90 second limit is shown",
    (await list(page).nth(5).innerText()).includes("制限時間 90秒"),
  );
  check(
    "default: order numbers are 1 to 8",
    JSON.stringify(
      await page
        .locator('ol[aria-label="お題一覧"] > li > div > span:first-child')
        .allInnerTexts(),
    ) === JSON.stringify(["1", "2", "3", "4", "5", "6", "7", "8"]),
  );
  check(
    "default: first row cannot move up",
    await page
      .getByRole("button", {
        name: "「休日の過ごし方といえば？」を上へ移動",
      })
      .isDisabled(),
  );
  check(
    "default: first row can move down",
    await page
      .getByRole("button", {
        name: "「休日の過ごし方といえば？」を下へ移動",
      })
      .isEnabled(),
  );
  check(
    "default: last row can move up",
    await page
      .getByRole("button", {
        name: "「この飲み会を一言で表すと？」を上へ移動",
      })
      .isEnabled(),
  );
  check(
    "default: last row cannot move down",
    await page
      .getByRole("button", {
        name: "「この飲み会を一言で表すと？」を下へ移動",
      })
      .isDisabled(),
  );
  check(
    "default: rules heading is shown",
    await page.getByRole("heading", { name: "お題の設定" }).isVisible(),
  );
  check(
    "default: text length rule is shown",
    await page.getByText("お題は1〜100文字").isVisible(),
  );
  check(
    "default: time limit rule is shown",
    await page.getByText("制限時間は10〜600秒").isVisible(),
  );
  check(
    "default: order rule is shown",
    await page.getByText("一覧の上から順に出題").isVisible(),
  );
  check(
    "default: preview save note is shown",
    await page.getByText("プレビューでは変更は保存されません。").isVisible(),
  );
  check(
    "default: preview navigation is shown",
    await page
      .getByRole("navigation", { name: "H-07 プレビュー状態" })
      .isVisible(),
  );
  check(
    "default: preview state is active",
    (await page
      .getByRole("link", { name: "通常" })
      .getAttribute("aria-current")) === "true",
  );

  const layout = await getLayout(page);
  checkLayout("default 1440x900", layout, { allowVerticalScroll: false });
  await screenshot(page, "h07-review-default-1440");

  await page.close();
}

async function testAdd() {
  const page = await newPage({ width: 1440, height: 900 });
  await addButton(page).click();

  check(
    "add: editor heading is shown",
    await page.getByRole("heading", { name: "お題を追加" }).isVisible(),
  );
  check(
    "add: text field receives focus",
    (await page.evaluate(() => document.activeElement?.id)) === "question-text",
  );
  check(
    "add: text counter starts at zero",
    (await page.locator("[data-question-text-counter]").innerText()) ===
      "0 / 100文字",
  );
  check(
    "add: default time limit is 60",
    (await page.locator("#question-time-limit").inputValue()) === "60",
  );
  check("add: save is disabled while empty", await saveButton(page).isDisabled());

  await page.locator("#question-text").fill("新しいお題です");
  check(
    "add: counter updates",
    (await page.locator("[data-question-text-counter]").innerText()) ===
      "7 / 100文字",
  );
  check("add: save is enabled after input", await saveButton(page).isEnabled());

  await page.locator("#question-time-limit").fill("75");
  await saveButton(page).click();

  check("add: editor closes", (await editor(page).count()) === 0);
  check("add: list grows to nine", (await list(page).count()) === 9);
  check(
    "add: new question is appended",
    (await list(page).last().innerText()).includes("新しいお題です"),
  );
  check(
    "add: new time limit is shown",
    (await list(page).last().innerText()).includes("制限時間 75秒"),
  );
  check(
    "add: new order number is nine",
    (await list(page).last().locator("> div > span").first().innerText()) === "9",
  );
  check(
    "add: header count updates",
    (await page.locator("header").innerText()).includes("全9問"),
  );
  check(
    "add: total time updates",
    (await page.locator("header").innerText()).includes("10分15秒"),
  );
  check(
    "add: live message announces the addition",
    (await page.locator('[aria-live="polite"]').innerText()).includes(
      "お題を追加しました",
    ),
  );

  await screenshot(page, "h07-review-added-1440");
  await page.close();
}

async function testValidation() {
  const page = await newPage({ width: 1440, height: 900 });
  await addButton(page).click();

  await page.locator("#question-text").fill("あ".repeat(101));
  check(
    "validation: 101 characters are counted",
    (await page.locator("[data-question-text-counter]").innerText()) ===
      "101 / 100文字",
  );
  check(
    "validation: over-limit error is shown",
    await page.getByText("お題は100文字以内で入力してください").isVisible(),
  );
  check(
    "validation: over-limit field is invalid",
    (await page.locator("#question-text").getAttribute("aria-invalid")) ===
      "true",
  );
  check(
    "validation: over-limit save is disabled",
    await saveButton(page).isDisabled(),
  );

  await page.locator("#question-text").fill("あ".repeat(100));
  check(
    "validation: 100 characters hide the error",
    (await page.locator("#question-text-error").count()) === 0,
  );
  check(
    "validation: 100 characters enable save",
    await saveButton(page).isEnabled(),
  );

  await page.locator("#question-text").fill("");
  await page.locator("#question-text").blur();
  check(
    "validation: empty text shows an error",
    await page.getByText("お題を入力してください").isVisible(),
  );
  await page.locator("#question-text").fill("   ");
  check(
    "validation: whitespace-only text is invalid",
    await page.getByText("お題を入力してください").isVisible(),
  );

  await page.locator("#question-text").fill("有効なお題");
  await page.locator("#question-time-limit").fill("9");
  check(
    "validation: 9 seconds is rejected",
    await page
      .getByText("制限時間は10〜600秒の整数で入力してください")
      .isVisible(),
  );
  check(
    "validation: 9 seconds disables save",
    await saveButton(page).isDisabled(),
  );

  await page.locator("#question-time-limit").fill("601");
  check(
    "validation: 601 seconds disables save",
    await saveButton(page).isDisabled(),
  );

  await page.locator("#question-time-limit").fill("60.5");
  check(
    "validation: decimal seconds disable save",
    await saveButton(page).isDisabled(),
  );

  await page.locator("#question-time-limit").fill("10");
  check(
    "validation: 10 seconds enables save",
    await saveButton(page).isEnabled(),
  );

  await page.locator("#question-time-limit").fill("600");
  check(
    "validation: 600 seconds enables save",
    await saveButton(page).isEnabled(),
  );

  await page.getByRole("button", { name: "キャンセル" }).click();
  check(
    "validation: cancel closes the editor",
    (await editor(page).count()) === 0,
  );
  await page.close();
}

async function testEdit() {
  const page = await newPage({ width: 1440, height: 900 });
  const target = row(page, "朝ごはんといえば？");
  await target.getByRole("button", { name: "編集", exact: true }).click();

  check(
    "edit: heading names the question number",
    await page.getByRole("heading", { name: "第3問を編集" }).isVisible(),
  );
  check(
    "edit: text is prefilled",
    (await page.locator("#question-text").inputValue()) ===
      "朝ごはんといえば？",
  );
  check(
    "edit: time limit is prefilled",
    (await page.locator("#question-time-limit").inputValue()) === "60",
  );
  check(
    "edit: active row is highlighted",
    (await target.getAttribute("data-editing")) === "true",
  );

  await page.locator("#question-text").fill("朝ごはんといえば？（編集）");
  await page.locator("#question-time-limit").fill("120");
  await saveButton(page).click();

  check("edit: editor closes", (await editor(page).count()) === 0);
  check("edit: list count is unchanged", (await list(page).count()) === 8);
  check(
    "edit: text is updated",
    (await list(page).nth(2).innerText()).includes("朝ごはんといえば？（編集）"),
  );
  check(
    "edit: time limit is updated",
    (await list(page).nth(2).innerText()).includes("制限時間 120秒"),
  );
  check(
    "edit: live message announces the update",
    (await page.locator('[aria-live="polite"]').innerText()).includes(
      "第3問のお題を更新しました",
    ),
  );

  await row(page, "朝ごはんといえば？（編集）")
    .getByRole("button", { name: "編集", exact: true })
    .click();
  await page.locator("#question-text").fill("キャンセルされるお題");
  await page.getByRole("button", { name: "キャンセル" }).click();
  check(
    "edit: cancel keeps the saved text",
    (await list(page).nth(2).innerText()).includes("朝ごはんといえば？（編集）"),
  );
  check(
    "edit: cancel keeps the saved time",
    (await list(page).nth(2).innerText()).includes("制限時間 120秒"),
  );

  await page.close();
}

async function testReorder() {
  const page = await newPage({ width: 1440, height: 900 });
  const first = await list(page).first().innerText();

  await page
    .getByRole("button", { name: "「休日の過ごし方といえば？」を下へ移動" })
    .click();

  check(
    "reorder: first question moves down",
    (await list(page).first().innerText()).includes("好きな季節といえば？"),
  );
  check(
    "reorder: second question becomes the moved one",
    (await list(page).nth(1).innerText()).includes("休日の過ごし方といえば？"),
  );
  check(
    "reorder: order numbers are renumbered",
    (await list(page).nth(1).locator("> div > span").first().innerText()) ===
      "2",
  );
  check(
    "reorder: link to new position is announced",
    (await page.locator('[aria-live="polite"]').innerText()).includes(
      "第2問です",
    ),
  );
  check(
    "reorder: new first row cannot move up",
    await page
      .getByRole("button", { name: "「好きな季節といえば？」を上へ移動" })
      .isDisabled(),
  );

  await page
    .getByRole("button", { name: "「休日の過ごし方といえば？」を上へ移動" })
    .click();
  check(
    "reorder: first question returns to the top",
    (await list(page).first().innerText()) === first,
  );

  await page
    .getByRole("button", { name: "「この飲み会を一言で表すと？」を上へ移動" })
    .click();
  check(
    "reorder: last question moves up",
    (await list(page).nth(6).innerText()).includes("この飲み会を一言で表すと？"),
  );
  check(
    "reorder: moved last question is now eighth",
    (await list(page).last().innerText()).includes(
      "最近ハマっていることといえば？",
    ),
  );
  check(
    "reorder: last row can move down again",
    await page
      .getByRole("button", { name: "「この飲み会を一言で表すと？」を下へ移動" })
      .isEnabled(),
  );

  await page.close();
}

async function testDelete() {
  const page = await newPage({ width: 1440, height: 900 });
  const target = row(page, "飲み会で最初に頼むものといえば？");
  await target.getByRole("button", { name: "削除", exact: true }).click();

  check("delete: dialog is shown", await deleteDialog(page).isVisible());
  check(
    "delete: heading is shown",
    await page
      .getByRole("heading", { name: "お題を削除しますか？" })
      .isVisible(),
  );
  check(
    "delete: target question is named",
    (await deleteDialog(page).innerText()).includes(
      "飲み会で最初に頼むものといえば？",
    ),
  );
  check(
    "delete: cancel receives focus",
    (await page.evaluate(() => document.activeElement?.textContent?.trim())) ===
      "キャンセル",
  );
  check(
    "delete: cancel is explained as permanent",
    (await deleteDialog(page).innerText()).includes("この操作は取り消せません"),
  );

  await screenshot(page, "h07-review-delete-1440");

  await page.getByRole("button", { name: "キャンセル" }).click();
  check(
    "delete: cancel closes the dialog",
    (await deleteDialog(page).count()) === 0,
  );
  check("delete: cancel keeps the question", (await list(page).count()) === 8);
  check(
    "delete: canceled question remains",
    (await list(page).nth(3).innerText()).includes(
      "飲み会で最初に頼むものといえば？",
    ),
  );

  await row(page, "飲み会で最初に頼むものといえば？")
    .getByRole("button", { name: "削除", exact: true })
    .click();
  await page.keyboard.press("Escape");
  check(
    "delete: escape closes the dialog",
    (await deleteDialog(page).count()) === 0,
  );
  check("delete: escape keeps the question", (await list(page).count()) === 8);

  await row(page, "飲み会で最初に頼むものといえば？")
    .getByRole("button", { name: "削除", exact: true })
    .click();
  await page.getByRole("button", { name: "削除する" }).click();

  check("delete: dialog closes", (await deleteDialog(page).count()) === 0);
  check("delete: list shrinks to seven", (await list(page).count()) === 7);
  check(
    "delete: question is removed",
    (await row(page, "飲み会で最初に頼むものといえば？").count()) === 0,
  );
  check(
    "delete: following questions shift up",
    (await list(page).nth(3).innerText()).includes(
      "仕事の後に欲しいものといえば？",
    ),
  );
  check(
    "delete: order numbers are 1 to 7",
    JSON.stringify(
      await page
        .locator('ol[aria-label="お題一覧"] > li > div > span:first-child')
        .allInnerTexts(),
    ) === JSON.stringify(["1", "2", "3", "4", "5", "6", "7"]),
  );
  check(
    "delete: live message announces the deletion",
    (await page.locator('[aria-live="polite"]').innerText()).includes(
      "削除しました。全7問です",
    ),
  );

  await page.close();
}

async function testEmpty() {
  const page = await newPage(
    { width: 1440, height: 900 },
    "/host/questions?preview=1&state=empty",
  );

  check(
    "empty: state is active",
    (await page
      .getByRole("link", { name: "お題なし" })
      .getAttribute("aria-current")) === "true",
  );
  check("empty: list has no rows", (await list(page).count()) === 0);
  check(
    "empty: empty heading is shown",
    await page.getByText("お題がありません").isVisible(),
  );
  check(
    "empty: empty explanation is shown",
    await page
      .getByText("ゲームを始めるには、お題を1問以上追加してください。")
      .isVisible(),
  );
  check(
    "empty: header count is zero",
    (await page.locator("header").innerText()).includes("全0問"),
  );
  check(
    "empty: add from empty state is shown",
    await page.getByRole("button", { name: "最初のお題を追加" }).isVisible(),
  );
  check(
    "empty: stats show zero",
    (await page.getByRole("heading", { name: "お題の設定" }).isVisible()) &&
      (await page.locator("main").innerText()).includes("0秒"),
  );

  await screenshot(page, "h07-review-empty-1440");

  await page.getByRole("button", { name: "最初のお題を追加" }).click();
  await page.locator("#question-text").fill("最初のお題");
  check(
    "empty: default time is 60",
    (await page.locator("#question-time-limit").inputValue()) === "60",
  );
  await saveButton(page).click();

  check("empty: first question is added", (await list(page).count()) === 1);
  check(
    "empty: added question is shown",
    (await list(page).first().innerText()).includes("最初のお題"),
  );
  check(
    "empty: header count becomes one",
    (await page.locator("header").innerText()).includes("全1問"),
  );

  await page.close();
}

async function testPreviewStates() {
  const editingPage = await newPage(
    { width: 1440, height: 900 },
    "/host/questions?preview=1&state=editing",
  );

  check(
    "preview editing: state is active",
    (await editingPage
      .getByRole("link", { name: "編集中" })
      .getAttribute("aria-current")) === "true",
  );
  check(
    "preview editing: editor opens for question three",
    await editingPage
      .getByRole("heading", { name: "第3問を編集" })
      .isVisible(),
  );
  check(
    "preview editing: text is prefilled",
    (await editingPage.locator("#question-text").inputValue()) ===
      "朝ごはんといえば？",
  );
  check(
    "preview editing: row is highlighted",
    (await row(editingPage, "朝ごはんといえば？").getAttribute(
      "data-editing",
    )) === "true",
  );
  await screenshot(editingPage, "h07-review-editing-1440");
  await editingPage.close();

  const deletePage = await newPage(
    { width: 1440, height: 900 },
    "/host/questions?preview=1&state=delete",
  );

  check(
    "preview delete: state is active",
    (await deletePage
      .getByRole("link", { name: "削除確認" })
      .getAttribute("aria-current")) === "true",
  );
  check(
    "preview delete: dialog is shown",
    await deleteDialog(deletePage).isVisible(),
  );
  check(
    "preview delete: second question is targeted",
    (await deleteDialog(deletePage).innerText()).includes(
      "好きな季節といえば？",
    ),
  );
  await screenshot(deletePage, "h07-review-delete-preview-1440");
  await deletePage.close();

  const navigationPage = await newPage(
    { width: 1440, height: 900 },
    "/host/questions?preview=1",
  );
  await navigationPage.getByRole("link", { name: "お題なし" }).click();
  await navigationPage.waitForFunction(() =>
    window.location.search.includes("state=empty"),
  );
  await navigationPage.waitForTimeout(150);
  check(
    "preview navigation: empty link switches state",
    (await list(navigationPage).count()) === 0,
  );
  check(
    "preview navigation: empty state is marked",
    (await navigationPage
      .getByRole("link", { name: "お題なし" })
      .getAttribute("aria-current")) === "true",
  );

  await navigationPage.getByRole("link", { name: "閉じる" }).click();
  await navigationPage.waitForFunction(
    () => !window.location.search.includes("preview=1"),
  );
  await navigationPage.waitForTimeout(150);
  check(
    "preview navigation: close leaves preview mode",
    !navigationPage.url().includes("preview=1"),
  );
  check(
    "preview navigation: production screen is shown",
    await navigationPage.getByRole("heading", { name: "司会者ログイン" }).isVisible(),
  );
  await navigationPage.close();
}

async function testPersistence() {
  const hostKey = process.env.HOST_KEY ?? "4821";
  const page = await newPage({ width: 1440, height: 900 }, "/host/questions");

  check(
    "auth: host login is shown without a key",
    await page.getByRole("heading", { name: "司会者ログイン" }).isVisible(),
  );

  await page.getByLabel("司会者キー").fill("wrong-key");
  await page.getByRole("button", { name: "ログイン" }).click();
  const authError = page.getByText("司会者キーが違います");
  await authError.waitFor();
  check("auth: wrong key is rejected", await authError.isVisible());

  await page.getByLabel("司会者キー").fill(hostKey);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForSelector('[data-hydrated="true"]');
  check("auth: correct key opens the editor", (await list(page).count()) === 8);

  const original = await page.evaluate(async () => {
    const response = await fetch("/api/host/questions", { cache: "no-store" });
    const data = await response.json();
    return data.questions;
  });

  try {
    await addButton(page).click();
    await page.locator("#question-text").fill("保存テストのお題");
    await page.locator("#question-time-limit").fill("42");
    await saveButton(page).click();
    await row(page, "保存テストのお題").waitFor({ state: "visible" });
    check("storage: added question is shown", (await list(page).count()) === 9);

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-hydrated="true"]');
    check(
      "storage: added question survives reload",
      (await list(page).count()) === 9,
    );
    check(
      "storage: added text survives reload",
      (await list(page).last().innerText()).includes("保存テストのお題"),
    );
    check(
      "storage: added time survives reload",
      (await list(page).last().innerText()).includes("制限時間 42秒"),
    );

    await row(page, "保存テストのお題")
      .getByRole("button", { name: "編集", exact: true })
      .click();
    await page.locator("#question-text").fill("保存テスト更新");
    await saveButton(page).click();
    await row(page, "保存テスト更新").waitFor({ state: "visible" });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-hydrated="true"]');
    check(
      "storage: edited text survives reload",
      (await list(page).last().innerText()).includes("保存テスト更新"),
    );

    await row(page, "保存テスト更新")
      .getByRole("button", { name: "削除", exact: true })
      .click();
    await page.getByRole("button", { name: "削除する" }).click();
    await page.waitForFunction(
      () => document.querySelectorAll('ol[aria-label="お題一覧"] > li').length === 8,
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-hydrated="true"]');
    check(
      "storage: deleted question stays deleted",
      (await list(page).count()) === 8,
    );
    check(
      "storage: deleted text is gone",
      (await page.getByText("保存テスト更新").count()) === 0,
    );
  } finally {
    await page.evaluate(async (questions) => {
      await fetch("/api/host/questions", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questions }),
      });
    }, original);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-hydrated="true"]');
  }

  check(
    "storage: original questions are restored",
    (await list(page).count()) === original.length,
  );
  await page.close();
}

async function testLayouts() {
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1280, height: 800 },
  ]) {
    const page = await newPage(viewport);
    const label = `${viewport.width}x${viewport.height}`;
    checkLayout(`${label} default`, await getLayout(page));
    check(
      `${label} default: add button is visible`,
      await addButton(page).isVisible(),
    );
    await screenshot(page, `h07-review-default-${viewport.width}`);
    await page.close();
  }

  const editingPage = await newPage(
    { width: 1366, height: 768 },
    "/host/questions?preview=1&state=editing",
  );
  checkLayout("1366x768 editing", await getLayout(editingPage));
  check(
    "1366x768 editing: text field is visible",
    await editingPage.locator("#question-text").isVisible(),
  );
  check(
    "1366x768 editing: time field is visible",
    await editingPage.locator("#question-time-limit").isVisible(),
  );
  check(
    "1366x768 editing: save button is visible",
    await saveButton(editingPage).isVisible(),
  );
  await screenshot(editingPage, "h07-review-editing-1366");
  await editingPage.close();

  const longPage = await newPage({ width: 1280, height: 800 });
  await addButton(longPage).click();
  await longPage.locator("#question-text").fill("壱".repeat(100));
  await saveButton(longPage).click();
  check(
    "long question: 100 characters are saved",
    (await list(longPage).last().innerText()).includes("壱".repeat(100)),
  );
  checkLayout("1280x800 long question", await getLayout(longPage));
  await screenshot(longPage, "h07-review-long-1280");
  await longPage.close();
}

async function testConsoleLinks() {
  const hostKey = process.env.HOST_KEY ?? "4821";
  const hostPage = await newPage(
    { width: 1440, height: 900 },
    `/host?key=${encodeURIComponent(hostKey)}`,
  );
  const hostLink = hostPage.getByRole("link", { name: "お題管理" });
  await hostLink.waitFor({ state: "visible" });
  check(
    "host console: question management link is shown",
    await hostLink.isVisible(),
  );
  check(
    "host console: link points to question management",
    (await hostLink.getAttribute("href")) === "/host/questions",
  );
  await hostPage.close();

  const groupingPage = await newPage(
    { width: 1440, height: 900 },
    "/host?preview=1&state=grouping",
  );
  const groupingLink = groupingPage.getByRole("link", { name: "お題管理" });
  check(
    "grouping console: question management link is shown",
    await groupingLink.isVisible(),
  );
  check(
    "grouping console: link points to question management",
    (await groupingLink.getAttribute("href")) === "/host/questions",
  );
  await groupingPage.close();
}

await testDefault();
await testAdd();
await testValidation();
await testEdit();
await testReorder();
await testDelete();
await testEmpty();
await testPreviewStates();
await testPersistence();
await testLayouts();
await testConsoleLinks();

await browser.close();

for (const result of results) {
  console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}`);
}

console.log(`\n${results.length} checks passed. Screenshots: ${outputDir}/`);
