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

async function newPage(viewport, path = "/host?preview=1&state=grouping") {
  const page = await browser.newPage({ viewport });
  await page.goto(`${baseURL}${path}`, { waitUntil: "networkidle" });
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  await page.waitForTimeout(350);
  return page;
}

async function screenshot(page, name) {
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${outputDir}/${name}.png` });
}

function statusPanel(page) {
  return page.locator('section[aria-labelledby="grouping-status-heading"]');
}

function teamTab(page, name) {
  return page.getByRole("tab", { name: new RegExp(name) });
}

function groupButton(page, groupId) {
  return page.locator(`#team-answer-panel [data-group-id="${groupId}"]`);
}

async function getLayout(page) {
  return page.evaluate(() => {
    const scroller = document.querySelector(".overflow-y-auto");
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    const panel = document.querySelector(
      'section[aria-labelledby="grouping-answers-heading"]',
    );
    const groupNames = panel
      ? [...panel.querySelectorAll("button span.truncate")]
      : [];

    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      scrollerWidth: scroller?.scrollWidth ?? 0,
      scrollerClientWidth: scroller?.clientWidth ?? 0,
      scrollerHeight: scroller?.scrollHeight ?? 0,
      scrollerClientHeight: scroller?.clientHeight ?? 0,
      tabsOverflow: tabs.some(
        (tab) => tab.scrollWidth > tab.clientWidth + 1,
      ),
      groupTextOverflow: groupNames.some(
        (element) => element.scrollWidth > element.clientWidth + 1,
      ),
    };
  });
}

function checkLayout(label, layout, { allowVerticalScroll = false } = {}) {
  check(
    `${label}: no horizontal page overflow`,
    layout.documentWidth <= layout.viewportWidth + 1,
  );
  check(
    `${label}: scroller does not overflow horizontally`,
    layout.scrollerWidth <= layout.scrollerClientWidth + 1,
  );
  check(`${label}: team tabs do not overflow`, layout.tabsOverflow === false);
  check(
    `${label}: answer names are not clipped`,
    layout.groupTextOverflow === false,
  );
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

  check("default: title is shown", headerText.includes("進行管理"));
  check("default: room code is shown", headerText.includes("4821"));
  check(
    "default: question progress is shown",
    headerText.includes("第3問 / 全8問"),
  );
  check(
    "default: grouping phase is shown",
    headerText.includes("グループ統合"),
  );
  check("default: answered count is 29 / 30", headerText.includes("29 / 30人"));
  check(
    "default: question text is shown",
    await page
      .getByRole("heading", { name: "朝ごはんといえば？" })
      .isVisible(),
  );
  check(
    "default: team-only rule is shown",
    await page.getByText("同じチームの回答だけ").isVisible(),
  );
  check(
    "default: five team tabs are shown",
    (await page.getByRole("tab").count()) === 5,
  );
  check(
    "default: tabs use one column per team",
    (await page
      .getByRole("tablist", { name: "チーム" })
      .evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(" ").length,
      )) === 5,
  );
  check(
    "default: team A is selected",
    (await teamTab(page, "チームA").getAttribute("aria-selected")) === "true",
  );
  check(
    "default: team A panel is shown",
    await page
      .getByRole("heading", { name: "チームAの回答" })
      .isVisible(),
  );
  check(
    "default: three groups are shown",
    (await page.locator("#team-answer-panel > ul > li").count()) === 3,
  );
  const panelText = await page.locator("#team-answer-panel").innerText();
  check(
    "default: team A groups and counts are shown",
    panelText.includes("カレー") &&
      panelText.includes("×4") &&
      panelText.includes("ごはん") &&
      panelText.includes("×1") &&
      panelText.includes("パン"),
  );
  check(
    "default: merge helper is shown",
    await page
      .getByText("回答を2つ以上選ぶと、ここで統合できます。")
      .isVisible(),
  );
  const statusText = await statusPanel(page).innerText();
  check(
    "default: status starts with three groups and no merges",
    statusText.includes("回答グループ") &&
      statusText.includes("統合済み") &&
      statusText.includes("選択中") &&
      statusText.includes("全体 0件"),
  );
  check(
    "default: all five teams are listed in the status",
    (await statusPanel(page).locator("ul > li").count()) === 5,
  );
  check(
    "default: confirm heading is shown",
    await page
      .getByRole("heading", { name: "得点を確定する" })
      .isVisible(),
  );
  check(
    "default: confirm button is shown",
    (await page
      .getByRole("button", { name: "得点を確定する" })
      .count()) === 1,
  );
  checkLayout("default 1440x900", await getLayout(page));
  await screenshot(page, "h06-review-default-1440");
  await page.close();
}

async function testTeamTabs() {
  const page = await newPage({ width: 1366, height: 768 });

  await teamTab(page, "チームB").click();
  check(
    "tabs: team B becomes selected",
    (await teamTab(page, "チームB").getAttribute("aria-selected")) === "true" &&
      (await teamTab(page, "チームA").getAttribute("aria-selected")) ===
        "false",
  );
  const teamBText = await page.locator("#team-answer-panel").innerText();
  check(
    "tabs: team B answers are shown",
    teamBText.includes("カレー") &&
      teamBText.includes("カレーライス") &&
      teamBText.includes("味噌汁") &&
      teamBText.includes("×4"),
  );
  check(
    "tabs: team B panel heading is shown",
    await page
      .getByRole("heading", { name: "チームBの回答" })
      .isVisible(),
  );

  await teamTab(page, "チームE").click();
  const teamESection = page.locator(
    'section[aria-labelledby="grouping-answers-heading"]',
  );
  check(
    "tabs: team E shows five answers and two groups",
    (await page.locator("#team-answer-panel > ul > li").count()) === 2 &&
      (await teamESection.innerText()).includes("5人"),
  );

  await teamTab(page, "チームE").focus();
  await page.keyboard.press("ArrowRight");
  check(
    "tabs: ArrowRight wraps to team A",
    (await teamTab(page, "チームA").getAttribute("aria-selected")) === "true",
  );
  await page.keyboard.press("ArrowLeft");
  check(
    "tabs: ArrowLeft wraps back to team E",
    (await teamTab(page, "チームE").getAttribute("aria-selected")) === "true",
  );

  checkLayout("tabs 1366x768", await getLayout(page));
  await screenshot(page, "h06-review-tabs-1366");
  await page.close();
}

async function testMergeFlow() {
  const page = await newPage({ width: 1440, height: 900 });
  await teamTab(page, "チームB").click();

  const curry = groupButton(page, "team-b-curry");
  const curryRice = groupButton(page, "team-b-curry-rice");

  await curry.click();
  check(
    "select: first group is pressed",
    (await curry.getAttribute("aria-pressed")) === "true",
  );
  check(
    "select: one group asks for another",
    await page
      .getByText("「カレー」を選択中。あと1つ選んでください。")
      .isVisible(),
  );
  check(
    "select: merge form is hidden with one group",
    (await page.getByLabel("統合後の回答名").count()) === 0,
  );

  await curryRice.click();
  check(
    "select: both groups are pressed",
    (await curry.getAttribute("aria-pressed")) === "true" &&
      (await curryRice.getAttribute("aria-pressed")) === "true",
  );
  check(
    "select: selected groups are summarized",
    await page
      .getByText("選択中: カレー ×4 / カレーライス ×1")
      .isVisible(),
  );
  check(
    "select: status shows two selected",
    (await statusPanel(page).innerText()).includes("2"),
  );
  check(
    "merge: name field is shown",
    await page.getByLabel("統合後の回答名").isVisible(),
  );
  check(
    "merge: reason field is shown",
    await page.getByLabel("統合理由").isVisible(),
  );
  check(
    "merge: submit is disabled while empty",
    !(await page.getByRole("button", { name: "統合する" }).isEnabled()),
  );

  await page.getByLabel("統合後の回答名").fill("カレー");
  check(
    "merge: submit stays disabled without a reason",
    !(await page.getByRole("button", { name: "統合する" }).isEnabled()),
  );
  await page.getByLabel("統合理由").fill("同じ料理として");
  check(
    "merge: submit is enabled with name and reason",
    await page.getByRole("button", { name: "統合する" }).isEnabled(),
  );
  await screenshot(page, "h06-review-form-1440");

  await page.getByRole("button", { name: "統合する" }).click();
  const mergedPanelText = await page.locator("#team-answer-panel").innerText();
  check(
    "merge: groups are combined",
    (await page.locator("#team-answer-panel > ul > li").count()) === 2,
  );
  check(
    "merge: merged count is five",
    mergedPanelText.includes("×5") &&
      mergedPanelText.includes("カレー") &&
      mergedPanelText.includes("味噌汁"),
  );
  check(
    "merge: merged badge is shown",
    mergedPanelText.includes("統合済み"),
  );
  check(
    "merge: reason is shown",
    mergedPanelText.includes("理由: 同じ料理として"),
  );
  check(
    "merge: original groups are shown",
    mergedPanelText.includes("統合元: カレー ×4 / カレーライス ×1"),
  );
  check(
    "merge: undo is available",
    (await page
      .getByRole("button", { name: "「カレー」の統合を取り消す" })
      .count()) === 1,
  );
  check(
    "merge: team tab shows one merge",
    (await teamTab(page, "チームB").innerText()).includes("1統合"),
  );
  check(
    "merge: status shows one merge",
    (await statusPanel(page).innerText()).includes("全体 1件"),
  );
  check(
    "merge: team list shows one merge",
    (await statusPanel(page).innerText()).includes("1件統合"),
  );
  check(
    "merge: announcement is live",
    (await page.locator('[aria-live="polite"]').innerText()).includes(
      "「カレー」に統合しました。理由: 同じ料理として",
    ),
  );
  check(
    "merge: merge form is cleared",
    (await page.getByLabel("統合後の回答名").count()) === 0 &&
      (await page
        .getByText("回答を2つ以上選ぶと、ここで統合できます。")
        .isVisible()),
  );
  checkLayout("merged 1440x900", await getLayout(page));
  await screenshot(page, "h06-review-merged-1440");

  await page
    .getByRole("button", { name: "「カレー」の統合を取り消す" })
    .click();
  const restoredText = await page.locator("#team-answer-panel").innerText();
  check(
    "undo: all groups are restored",
    (await page.locator("#team-answer-panel > ul > li").count()) === 3 &&
      restoredText.includes("カレーライス"),
  );
  check(
    "undo: merged state is removed",
    !restoredText.includes("統合済み") && !restoredText.includes("理由:"),
  );
  check(
    "undo: team tab merge badge is removed",
    !(await teamTab(page, "チームB").innerText()).includes("統合"),
  );
  check(
    "undo: status returns to zero",
    (await statusPanel(page).innerText()).includes("全体 0件"),
  );
  check(
    "undo: announcement is live",
    (await page.locator('[aria-live="polite"]').innerText()).includes(
      "「カレー」の統合を取り消しました",
    ),
  );

  await page.close();
}

async function testTeamIsolation() {
  const page = await newPage({ width: 1366, height: 768 });

  await groupButton(page, "team-a-rice").click();
  await groupButton(page, "team-a-bread").click();
  check(
    "isolation: two groups are selected",
    (await page.getByRole("button", { name: "選択を解除" }).count()) === 1,
  );
  await teamTab(page, "チームB").click();
  check(
    "isolation: team B has no selection",
    (await page.getByRole("button", { name: "選択を解除" }).count()) === 0,
  );
  await teamTab(page, "チームA").click();
  check(
    "isolation: returning to team A keeps the selection cleared",
    (await page.getByRole("button", { name: "選択を解除" }).count()) === 0,
  );

  await groupButton(page, "team-a-rice").click();
  await groupButton(page, "team-a-bread").click();
  await page.getByLabel("統合後の回答名").fill("ごはん・パン");
  await page.getByLabel("統合理由").fill("主食として");
  await page.getByRole("button", { name: "統合する" }).click();
  check(
    "isolation: team A merge is applied",
    (await page.locator("#team-answer-panel").innerText()).includes(
      "統合元: ごはん ×1 / パン ×1",
    ),
  );
  check(
    "isolation: team A tab shows one merge",
    (await teamTab(page, "チームA").innerText()).includes("1統合"),
  );

  await teamTab(page, "チームB").click();
  check(
    "isolation: team B remains unmerged",
    !(await page.locator("#team-answer-panel").innerText()).includes(
      "統合済み",
    ) && !(await teamTab(page, "チームB").innerText()).includes("統合"),
  );
  await teamTab(page, "チームA").click();
  check(
    "isolation: team A merge persists",
    (await page.locator("#team-answer-panel").innerText()).includes(
      "理由: 主食として",
    ),
  );

  await screenshot(page, "h06-review-isolation-1366");
  await page.close();
}

async function testConfirm() {
  const page = await newPage({ width: 1440, height: 900 });

  await page.getByRole("button", { name: "得点を確定する" }).click();
  check(
    "confirm: dialog is shown",
    await page.getByRole("alertdialog").isVisible(),
  );
  check(
    "confirm: dialog explains the lock",
    await page
      .getByText("確定後は統合の追加・取消ができません。")
      .isVisible(),
  );
  await page.getByRole("button", { name: "やめる" }).click();
  check(
    "confirm: cancel keeps the button",
    (await page.getByRole("alertdialog").count()) === 0 &&
      (await page
        .getByRole("button", { name: "得点を確定する" })
        .count()) === 1,
  );

  await page.getByRole("button", { name: "得点を確定する" }).click();
  await page.getByRole("button", { name: "確定する", exact: true }).click();
  check(
    "confirm: success message is shown",
    await page.getByText("得点を確定しました").first().isVisible(),
  );
  check(
    "confirm: lock message is shown",
    await page
      .getByText("得点を確定しました。統合の変更はできません。")
      .isVisible(),
  );
  check(
    "confirm: confirm button is removed",
    (await page
      .getByRole("button", { name: "得点を確定する" })
      .count()) === 0,
  );
  check(
    "confirm: group selection is disabled",
    await page.locator("#team-answer-panel button").first().isDisabled(),
  );
  check(
    "confirm: preview link points to S-04",
    (await page
      .getByRole("link", { name: "S-04 得点発表を確認する" })
      .getAttribute("href")) === "/stage?preview=1&state=scored",
  );
  check(
    "confirm: announcement is live",
    (await page.locator('[aria-live="polite"]').innerText()).includes(
      "第3問の得点を確定しました",
    ),
  );
  checkLayout("confirmed 1440x900", await getLayout(page));
  await screenshot(page, "h06-review-confirmed-1440");

  await page.close();
}

async function testPreviewNavigation() {
  const page = await newPage(
    { width: 1366, height: 768 },
    "/host?preview=1&state=reveal",
  );

  check(
    "preview: H-05 / H-06 navigation is shown",
    (await page
      .getByRole("navigation", { name: "H-05 / H-06 プレビュー状態" })
      .count()) === 1,
  );
  check(
    "preview: current reveal state is marked",
    (await page
      .getByRole("link", { name: "回答公開" })
      .getAttribute("aria-current")) === "true",
  );

  await page.getByRole("link", { name: "グループ統合" }).click();
  await page.waitForURL("**/host?preview=1&state=grouping");
  check(
    "preview: グループ統合 switches to H-06",
    await page
      .getByRole("heading", { name: "チームAの回答" })
      .isVisible(),
  );

  await page.getByRole("link", { name: "得点確定" }).click();
  await page.waitForURL("**/host?preview=1&state=scored");
  check(
    "preview: 得点確定 switches back to H-05",
    await page.getByRole("heading", { name: "第3問の得点" }).isVisible(),
  );

  await page.getByRole("link", { name: "閉じる" }).click();
  await page.waitForURL((url) => url.pathname === "/host" && !url.search);
  check(
    "preview: closing removes the preview bar",
    (await page.getByText("H-05 / H-06 Preview").count()) === 0,
  );
  await page.getByRole("heading", { name: "司会者ログイン" }).waitFor({
    state: "visible",
    timeout: 10000,
  });
  check(
    "production: host login is shown without preview",
    (await page.getByRole("heading", { name: "司会者ログイン" }).isVisible()),
  );

  await page.close();
}

async function testLayouts() {
  const cases = [
    [1440, 900],
    [1366, 768],
    [1280, 800],
  ];

  for (const [width, height] of cases) {
    const page = await newPage(
      { width, height },
      "/host?preview=1&state=grouping",
    );
    checkLayout(`grouping ${width}x${height}`, await getLayout(page));
    await screenshot(page, `h06-review-layout-${width}`);
    await page.close();
  }

  const formPage = await newPage({ width: 1366, height: 768 });
  await teamTab(formPage, "チームB").click();
  await groupButton(formPage, "team-b-curry").click();
  await groupButton(formPage, "team-b-curry-rice").click();
  await formPage.getByLabel("統合後の回答名").fill("カレー");
  await formPage.getByLabel("統合理由").fill("同じ料理として");
  checkLayout("form 1366x768", await getLayout(formPage), {
    allowVerticalScroll: true,
  });
  await screenshot(formPage, "h06-review-form-1366");
  await formPage.close();
}

try {
  await testDefault();
  await testTeamTabs();
  await testMergeFlow();
  await testTeamIsolation();
  await testConfirm();
  await testPreviewNavigation();
  await testLayouts();
} finally {
  await browser.close();
}

for (const result of results) {
  console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}`);
}

console.log(`\n${results.length} checks passed`);
