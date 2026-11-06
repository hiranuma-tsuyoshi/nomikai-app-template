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

async function newPage(viewport, path = "/stage?preview=1&state=reveal") {
  const page = await browser.newPage({ viewport });
  await page.goto(`${baseURL}${path}`, { waitUntil: "networkidle" });
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  await page.waitForTimeout(1900);
  return page;
}

async function screenshot(page, name) {
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${outputDir}/${name}.png` });
}

async function getLayout(page) {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll("article")].map((card) => {
      const name = card.querySelector("h2")?.textContent?.trim() ?? "";
      return {
        name,
        clipped: card.scrollHeight > card.clientHeight + 1,
        width: Math.round(card.getBoundingClientRect().width),
        height: Math.round(card.getBoundingClientRect().height),
        top: Math.round(card.getBoundingClientRect().top),
        left: Math.round(card.getBoundingClientRect().left),
        text: card.textContent?.replace(/\s+/g, " ").trim() ?? "",
      };
    });

    const progress = document.querySelector('[role="progressbar"]');
    const dots = progress ? [...progress.children] : [];
    const stage = document.querySelector(".stage");

    return {
      cards,
      pageScroll:
        document.documentElement.scrollHeight > window.innerHeight + 1,
      pageScrollWidth:
        document.documentElement.scrollWidth > window.innerWidth + 1,
      stageHeight: stage ? Math.round(stage.getBoundingClientRect().height) : 0,
      viewportHeight: window.innerHeight,
      progressNow: progress?.getAttribute("aria-valuenow") ?? null,
      dotCount: dots.length,
      doneDots: dots.filter(
        (dot) =>
          dot.className.includes("bg-stage-yellow") ||
          dot.className.includes("bg-stage-green"),
      ).length,
    };
  });
}

function rowsOf(cards) {
  const rows = [];
  for (const card of cards) {
    const row = rows.find((items) => Math.abs(items[0].top - card.top) <= 2);
    if (row) {
      row.push(card);
    } else {
      rows.push([card]);
    }
  }
  return rows;
}

function checkViewportIntegrity(label, layout, expectedCards) {
  check(`${label}: page does not scroll vertically`, !layout.pageScroll);
  check(`${label}: page does not scroll horizontally`, !layout.pageScrollWidth);
  check(
    `${label}: ${expectedCards} team cards are shown`,
    layout.cards.length === expectedCards,
  );
  check(
    `${label}: every card fits its content`,
    layout.cards.length > 0 && layout.cards.every((card) => !card.clipped),
  );
  check(
    `${label}: stage fills the viewport without shrinking`,
    layout.stageHeight === layout.viewportHeight,
  );
}

async function testRevealDefault() {
  const page = await newPage({ width: 1920, height: 1080 });
  const layout = await getLayout(page);
  const rows = rowsOf(layout.cards);
  const byName = Object.fromEntries(layout.cards.map((card) => [card.name, card]));

  check(
    "default: heading shows the question number and 回答",
    await page.getByRole("heading", { name: /第3問\s*回答/ }).isVisible(),
  );
  check(
    "default: question text is shown",
    await page.getByText("「朝ごはんといえば？」").isVisible(),
  );
  check(
    "default: 回答公開 badge is shown",
    await page.getByText("回答公開", { exact: true }).isVisible(),
  );
  check(
    "default: room code is shown",
    await page.getByText("ルーム 4821", { exact: true }).isVisible(),
  );
  check(
    "default: progress label is shown",
    await page.getByText("進行", { exact: true }).isVisible(),
  );
  check(
    "default: progress shows 3 of 8",
    await page.getByText("3 / 8", { exact: true }).isVisible(),
  );
  check("default: progress value is 3", layout.progressNow === "3");
  check("default: eight progress dots are shown", layout.dotCount === 8);
  check("default: three progress dots are filled", layout.doneDots === 3);

  checkViewportIntegrity("default 1920x1080", layout, 5);

  check(
    "default: five teams use a 3 + 2 layout",
    rows.length === 2 && rows[0].length === 3 && rows[1].length === 2,
  );
  check(
    "default: top row cards have equal widths",
    Math.max(...rows[0].map((card) => card.width)) -
      Math.min(...rows[0].map((card) => card.width)) <=
      2,
  );
  check(
    "default: bottom row cards have equal widths",
    Math.max(...rows[1].map((card) => card.width)) -
      Math.min(...rows[1].map((card) => card.width)) <=
      2,
  );
  check(
    "default: bottom row cards are wider than top row cards",
    rows[1][0].width > rows[0][0].width,
  );

  check(
    "default: team A answers and answer count are shown",
    byName["チームA"]?.text.includes("6 / 6人") &&
      byName["チームA"]?.text.includes("カレー×5") &&
      byName["チームA"]?.text.includes("ごはん×1"),
  );
  check(
    "default: team B answer and answer count are shown",
    byName["チームB"]?.text.includes("6 / 6人") &&
      byName["チームB"]?.text.includes("カレー") &&
      byName["チームB"]?.text.includes("×6"),
  );
  check(
    "default: integrated answer note is shown",
    byName["チームB"]?.text.includes("カレーライス統合"),
  );
  check(
    "default: team C answers are shown",
    byName["チームC"]?.text.includes("ごはん×3") &&
      byName["チームC"]?.text.includes("パン×2") &&
      byName["チームC"]?.text.includes("うどん×1"),
  );
  check(
    "default: team D answers are shown",
    byName["チームD"]?.text.includes("カレー×4") &&
      byName["チームD"]?.text.includes("シリアル×2"),
  );
  check(
    "default: team E answers and answer count are shown",
    byName["チームE"]?.text.includes("5 / 6人") &&
      byName["チームE"]?.text.includes("トースト×3") &&
      byName["チームE"]?.text.includes("ごはん×2"),
  );

  check(
    "default: scores are not shown",
    layout.cards.every((card) => !/\d+\s*pt/.test(card.text)),
  );
  check(
    "default: consistency rate is not shown",
    layout.cards.every((card) => !card.text.includes("一致率")),
  );
  check(
    "default: earned points are not shown",
    layout.cards.every((card) => !card.text.includes("獲得")),
  );
  check(
    "default: ranking is not shown",
    (await page.getByText("総合順位").count()) === 0,
  );

  const colors = await page.evaluate(() => {
    const articles = [...document.querySelectorAll("article")];
    const teamA = articles.find((article) =>
      article.querySelector("h2")?.textContent?.includes("チームA"),
    );
    const teamB = articles.find((article) =>
      article.querySelector("h2")?.textContent?.includes("チームB"),
    );
    const topBadge = teamA?.querySelector('span[aria-label="5人"]');
    const normalBadge = teamA?.querySelector('span[aria-label="1人"]');
    const mergedNote = teamB?.querySelector("p.text-stage-cyan");

    return {
      topBadge: topBadge ? getComputedStyle(topBadge).backgroundColor : "",
      normalBadge: normalBadge
        ? getComputedStyle(normalBadge).backgroundColor
        : "",
      mergedNote: mergedNote ? getComputedStyle(mergedNote).color : "",
    };
  });

  check(
    "default: top answer count is highlighted in yellow",
    colors.topBadge === "rgb(255, 204, 0)",
  );
  check(
    "default: other answer counts are not highlighted",
    colors.normalBadge !== "" && colors.normalBadge !== "rgb(255, 204, 0)",
  );
  check(
    "default: integrated answer note uses the cyan accent",
    colors.mergedNote === "rgb(0, 196, 255)",
  );

  await screenshot(page, "s03-review-reveal-1920");
  await page.close();

  for (const [width, height] of [
    [1366, 768],
    [1280, 720],
  ]) {
    const viewportPage = await newPage(
      { width, height },
      "/stage?preview=1&state=reveal",
    );
    const viewportLayout = await getLayout(viewportPage);
    const viewportRows = rowsOf(viewportLayout.cards);

    checkViewportIntegrity(
      `reveal ${width}x${height}`,
      viewportLayout,
      5,
    );
    check(
      `reveal ${width}x${height}: five teams use a 3 + 2 layout`,
      viewportRows.length === 2 &&
        viewportRows[0].length === 3 &&
        viewportRows[1].length === 2,
    );
    check(
      `reveal ${width}x${height}: heading is shown`,
      await viewportPage
        .getByRole("heading", { name: /第3問\s*回答/ })
        .isVisible(),
    );

    await screenshot(viewportPage, `s03-review-reveal-${width}`);
    await viewportPage.close();
  }
}

async function testTwoTeams() {
  const page = await newPage(
    { width: 1920, height: 1080 },
    "/stage?preview=1&state=reveal_two_teams",
  );
  const layout = await getLayout(page);
  const rows = rowsOf(layout.cards);
  const byName = Object.fromEntries(layout.cards.map((card) => [card.name, card]));

  checkViewportIntegrity("two teams 1920x1080", layout, 2);
  check(
    "two teams: cards are shown side by side",
    rows.length === 1 && rows[0].length === 2,
  );
  check(
    "two teams: cards have equal widths",
    Math.abs(layout.cards[0].width - layout.cards[1].width) <= 2,
  );
  check(
    "two teams: cards have equal heights",
    Math.abs(layout.cards[0].height - layout.cards[1].height) <= 2,
  );
  check(
    "two teams: team A answers are shown",
    byName["チームA"]?.text.includes("カレー×5") &&
      byName["チームA"]?.text.includes("ごはん×1"),
  );
  check(
    "two teams: team B answer and integrated note are shown",
    byName["チームB"]?.text.includes("カレー") &&
      byName["チームB"]?.text.includes("×6") &&
      byName["チームB"]?.text.includes("カレーライス統合"),
  );
  check(
    "two teams: scores are not shown",
    layout.cards.every((card) => !/\d+\s*pt/.test(card.text)),
  );

  await screenshot(page, "s03-review-two-teams-1920");
  await page.close();

  const smallPage = await newPage(
    { width: 1366, height: 768 },
    "/stage?preview=1&state=reveal_two_teams",
  );
  const smallLayout = await getLayout(smallPage);
  checkViewportIntegrity("two teams 1366x768", smallLayout, 2);
  check(
    "two teams 1366x768: cards are shown side by side",
    rowsOf(smallLayout.cards).length === 1,
  );
  await screenshot(smallPage, "s03-review-two-teams-1366");
  await smallPage.close();
}

async function testSixTeams() {
  for (const [width, height] of [
    [1920, 1080],
    [1280, 720],
  ]) {
    const page = await newPage(
      { width, height },
      "/stage?preview=1&state=reveal_six_teams",
    );
    const layout = await getLayout(page);
    const rows = rowsOf(layout.cards);

    checkViewportIntegrity(`six teams ${width}x${height}`, layout, 6);
    check(
      `six teams ${width}x${height}: six teams use a 3 + 3 layout`,
      rows.length === 2 && rows[0].length === 3 && rows[1].length === 3,
    );
    check(
      `six teams ${width}x${height}: all cards have equal widths`,
      Math.max(...layout.cards.map((card) => card.width)) -
        Math.min(...layout.cards.map((card) => card.width)) <=
        2,
    );

    if (width === 1920) {
      const teamF = layout.cards.find((card) => card.name === "チームF");
      check(
        "six teams: team F answers are shown",
        teamF?.text.includes("6 / 6人") &&
          teamF?.text.includes("パン×4") &&
          teamF?.text.includes("ごはん×2"),
      );
      check(
        "six teams: scores are not shown",
        layout.cards.every((card) => !/\d+\s*pt/.test(card.text)),
      );
    }

    await screenshot(page, `s03-review-six-teams-${width}`);
    await page.close();
  }
}

async function testPreviewNavigation() {
  const page = await newPage(
    { width: 1366, height: 768 },
    "/stage?preview=1&state=reveal",
  );

  check(
    "preview: S-03 / S-04 / S-05 navigation is shown",
    (await page
      .getByRole("navigation", { name: "S-03 / S-04 / S-05 プレビュー状態" })
      .count()) === 1,
  );
  check(
    "preview: current reveal state is marked",
    (await page.getByRole("link", { name: "公開 5" }).getAttribute("aria-current")) ===
      "true",
  );

  await page.getByRole("link", { name: "公開 2" }).click();
  await page.waitForURL("**/stage?preview=1&state=reveal_two_teams");
  check(
    "preview: 公開 2 switches to the two-team reveal",
    (await page.locator("article").count()) === 2,
  );

  await page.getByRole("link", { name: "公開 6" }).click();
  await page.waitForURL("**/stage?preview=1&state=reveal_six_teams");
  check(
    "preview: 公開 6 switches to the six-team reveal",
    (await page.locator("article").count()) === 6,
  );

  await page.getByRole("link", { name: "通常" }).click();
  await page.waitForURL("**/stage?preview=1&state=scored");
  check(
    "preview: 通常 switches to the S-04 scoreboard",
    await page.getByText("総合順位").isVisible(),
  );

  await page.getByRole("link", { name: "2チーム", exact: true }).click();
  await page.waitForURL("**/stage?preview=1&state=two_teams");
  check(
    "preview: 2チーム switches the S-04 scoreboard to two teams",
    (await page.locator("article").count()) === 2,
  );

  await page.getByRole("link", { name: "閉じる" }).click();
  await page.waitForURL((url) => url.pathname === "/stage" && !url.search);
  check(
    "preview: 閉じる removes the preview bar",
    (await page
      .getByRole("navigation", { name: "S-03 / S-04 / S-05 プレビュー状態" })
      .count()) === 0,
  );
  await page.getByText("参加受付中").waitFor({ state: "visible", timeout: 10000 });
  check(
    "production: default stage is the live waiting screen",
    await page.getByText("参加受付中").isVisible(),
  );
  check(
    "production: preview label is not shown",
    (await page.getByText("S-03 / S-04 / S-05", { exact: true }).count()) === 0,
  );

  await page.close();
}

async function testReducedMotion() {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(`${baseURL}/stage?preview=1&state=reveal`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(300);

  const firstCard = page.locator("article").first();
  check(
    "reduced motion: card animation is disabled",
    (await firstCard.evaluate(
      (element) => getComputedStyle(element).animationName,
    )) === "none",
  );
  check(
    "reduced motion: answer content is visible immediately",
    await firstCard.getByText("カレー", { exact: true }).isVisible(),
  );

  await context.close();
}

try {
  await testRevealDefault();
  await testTwoTeams();
  await testSixTeams();
  await testPreviewNavigation();
  await testReducedMotion();
} finally {
  await browser.close();
}

for (const result of results) {
  console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}`);
}

console.log(`\n${results.length} checks passed`);
