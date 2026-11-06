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

async function newPage(viewport, path = "/stage?preview=1") {
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
      const clone = card.cloneNode(true);
      clone.querySelectorAll(".sr-only").forEach((element) => element.remove());
      return {
        name,
        clipped: card.scrollHeight > card.clientHeight + 1,
        width: Math.round(card.getBoundingClientRect().width),
        height: Math.round(card.getBoundingClientRect().height),
        className: card.className,
        text: clone.textContent?.replace(/\s+/g, " ").trim() ?? "",
      };
    });

    const ranking = [...document.querySelectorAll("ol li")].map((item) => ({
      text: item.textContent?.replace(/\s+/g, " ").trim() ?? "",
      overflow: item.scrollWidth > item.clientWidth + 1,
    }));

    return {
      cards,
      ranking,
      pageScroll:
        document.documentElement.scrollHeight > window.innerHeight + 1,
      pageScrollWidth:
        document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
}

function checkViewportIntegrity(label, layout) {
  check(`${label}: page does not scroll vertically`, !layout.pageScroll);
  check(`${label}: page does not scroll horizontally`, !layout.pageScrollWidth);
  check(
    `${label}: every card fits its content`,
    layout.cards.length > 0 && layout.cards.every((card) => !card.clipped),
  );
  check(
    `${label}: ranking labels are not truncated`,
    layout.ranking.length > 0 && layout.ranking.every((item) => !item.overflow),
  );
}

async function testScored() {
  const page = await newPage({ width: 1920, height: 1080 });
  const layout = await getLayout(page);

  check("scored: five team cards are shown", layout.cards.length === 5);
  check("scored: five ranking entries are shown", layout.ranking.length === 5);
  check(
    "scored: question number is shown",
    await page.getByRole("heading", { name: /第3問/ }).isVisible(),
  );
  check(
    "scored: question text is shown",
    await page.getByText("「朝ごはんといえば？」").isVisible(),
  );
  check(
    "scored: progress shows 3 of 8",
    await page.getByText("3 / 8").isVisible(),
  );

  const cardText = layout.cards.map((card) => card.text).join("\n");
  const expectedCards = [
    ["チームA", "回答 6 / 6人一致率83%獲得+8pt5 / 6人一致"],
    ["チームB", "回答 6 / 6人全員一致一致率100%獲得+10pt6 / 6人一致"],
    ["チームC", "回答 6 / 6人一致率50%獲得+5pt3 / 6人一致"],
    ["チームD", "回答 6 / 6人一致率67%獲得+7pt4 / 6人一致"],
    ["チームE", "回答 5 / 6人一致率60%獲得+6pt3 / 5人一致"],
  ];
  for (const [team, expected] of expectedCards) {
    check(
      `scored: ${team} values are correct`,
      cardText.includes(`${team}${expected}`),
    );
  }

  check(
    "scored: perfect team card is yellow",
    layout.cards.find((card) => card.name === "チームB")?.className.includes("bg-stage-yellow") ?? false,
  );
  check(
    "scored: perfect badge is shown",
    await page.getByText("全員一致").isVisible(),
  );
  check(
    "scored: ranking order is B, A, D, E, C",
    layout.ranking.map((item) => item.text).join("|") ===
      "1チームB23pt|2チームA21pt|3チームD18pt|4チームE15pt|5チームC12pt",
  );
  checkViewportIntegrity("scored 1920x1080", layout);
  await screenshot(page, "s04-review-scored-1920");
  await page.close();

  for (const [width, height] of [
    [1366, 768],
    [1280, 720],
  ]) {
    const viewportPage = await newPage({ width, height });
    const viewportLayout = await getLayout(viewportPage);
    checkViewportIntegrity(`scored ${width}x${height}`, viewportLayout);
    check(
      `scored ${width}x${height}: five cards are shown`,
      viewportLayout.cards.length === 5,
    );
    await screenshot(viewportPage, `s04-review-scored-${width}`);
    await viewportPage.close();
  }
}

async function testExcluded() {
  const page = await newPage(
    { width: 1280, height: 720 },
    "/stage?preview=1&state=excluded",
  );
  const layout = await getLayout(page);

  check("excluded: five cards are shown", layout.cards.length === 5);
  check(
    "excluded: one 採点対象外 badge is shown",
    (await page.locator("article").getByText("採点対象外", { exact: true }).count()) === 1,
  );
  check(
    "excluded: team C shows the not-scored reason",
    await page.getByText("回答者4人未満のため得点なし").isVisible(),
  );
  check(
    "excluded: team C has no points",
    layout.cards.find((card) => card.name === "チームC")?.text.includes("獲得—") ??
      false,
  );
  check(
    "excluded: other teams keep their scores",
    layout.cards.find((card) => card.name === "チームA")?.text.includes("+8pt") ??
      false,
  );
  checkViewportIntegrity("excluded 1280x720", layout);
  await screenshot(page, "s04-review-excluded-1280");
  await page.close();
}

async function testTwoTeams() {
  const page = await newPage(
    { width: 1366, height: 768 },
    "/stage?preview=1&state=two_teams",
  );
  const layout = await getLayout(page);

  check("two_teams: two cards are shown", layout.cards.length === 2);
  check("two_teams: two ranking entries are shown", layout.ranking.length === 2);
  check(
    "two_teams: ranking order is B then A",
    layout.ranking.map((item) => item.text).join("|") ===
      "1チームB23pt|2チームA21pt",
  );
  checkViewportIntegrity("two_teams 1366x768", layout);
  await screenshot(page, "s04-review-two-teams-1366");
  await page.close();
}

async function testPreviewNavigation() {
  const page = await newPage(
    { width: 1366, height: 768 },
    "/stage?preview=1&state=scored",
  );

  check(
    "preview: current state is marked",
    (await page.getByRole("link", { name: "通常" }).getAttribute("aria-current")) ===
      "true",
  );

  await page.getByRole("link", { name: "採点対象外" }).click();
  await page.waitForURL("**/stage?preview=1&state=excluded");
  check(
    "preview: 採点対象外 link switches state",
    await page.getByText("回答者4人未満のため得点なし").isVisible(),
  );

  await page.getByRole("link", { name: "2チーム", exact: true }).click();
  await page.waitForURL("**/stage?preview=1&state=two_teams");
  check(
    "preview: 2チーム link switches state",
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
  check(
    "production: preview bar is not shown",
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
  await page.goto(`${baseURL}/stage?preview=1&state=scored`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);

  check(
    "reduced motion: final score is shown immediately",
    await page
      .locator("article")
      .filter({ hasText: "チームB" })
      .getByText("10", { exact: true })
      .first()
      .isVisible(),
  );
  check(
    "reduced motion: final rate is shown immediately",
    await page
      .locator("article")
      .filter({ hasText: "チームB" })
      .getByText("100%", { exact: true })
      .first()
      .isVisible(),
  );

  await context.close();
}

try {
  await testScored();
  await testExcluded();
  await testTwoTeams();
  await testPreviewNavigation();
  await testReducedMotion();
} finally {
  await browser.close();
}

for (const result of results) {
  console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}`);
}

console.log(`\n${results.length} checks passed`);
