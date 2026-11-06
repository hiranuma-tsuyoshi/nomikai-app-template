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

async function newPage(viewport, path = "/stage?preview=1&state=final") {
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
    const main = document.querySelector("main");
    const list = document.querySelector(
      'ol[aria-labelledby="stage-final-ranking-heading"]',
    );
    const progress = document.querySelector(
      '[role="progressbar"][aria-label="お題の進行状況"]',
    );

    const items = list
      ? [...list.children].map((item) => {
          const article = item.querySelector("article");
          if (!article) {
            return null;
          }

          const clone = article.cloneNode(true);
          clone.querySelectorAll(".sr-only").forEach((element) => {
            element.remove();
          });

          const textElements = [...article.querySelectorAll("h3, p")];

          return {
            name: article.querySelector("h3")?.textContent?.trim() ?? "",
            text: clone.textContent?.replace(/\s+/g, " ").trim() ?? "",
            rankBadge:
              article.querySelector("span")?.textContent?.trim() ?? "",
            width: Math.round(article.getBoundingClientRect().width),
            height: Math.round(article.getBoundingClientRect().height),
            backgroundColor: getComputedStyle(article).backgroundColor,
            borderColor: getComputedStyle(article).borderColor,
            textOverflow: textElements.some(
              (element) =>
                element.scrollWidth > element.clientWidth + 1 ||
                (getComputedStyle(element).overflowY !== "visible" &&
                  element.scrollHeight > element.clientHeight + 1),
            ),
            dotColor: article.querySelector("span[style]")
              ? getComputedStyle(article.querySelector("span[style]"))
                  .backgroundColor
              : "",
          };
        })
      : [];

    const progressDots = progress
      ? [...progress.children].map(
          (dot) => getComputedStyle(dot).backgroundColor,
        )
      : [];

    return {
      pageScroll:
        document.documentElement.scrollHeight > window.innerHeight + 1,
      pageScrollWidth:
        document.documentElement.scrollWidth > window.innerWidth + 1,
      mainScroll: main ? main.scrollHeight > main.clientHeight + 1 : null,
      mainScrollWidth: main ? main.scrollWidth > main.clientWidth + 1 : null,
      listScroll: list ? list.scrollHeight > list.clientHeight + 1 : null,
      listScrollWidth: list ? list.scrollWidth > list.clientWidth + 1 : null,
      items: items.filter(Boolean),
      progressValue: progress?.getAttribute("aria-valuenow") ?? "",
      progressMax: progress?.getAttribute("aria-valuemax") ?? "",
      progressDots,
    };
  });
}

function checkViewportIntegrity(label, layout) {
  check(`${label}: page does not scroll vertically`, !layout.pageScroll);
  check(`${label}: page does not scroll horizontally`, !layout.pageScrollWidth);
  check(`${label}: main does not scroll`, layout.mainScroll === false);
  check(
    `${label}: main does not overflow horizontally`,
    layout.mainScrollWidth === false,
  );
  check(`${label}: ranking does not scroll`, layout.listScroll === false);
  check(
    `${label}: ranking does not overflow horizontally`,
    layout.listScrollWidth === false,
  );
  check(
    `${label}: every score text fits`,
    layout.items.length > 0 &&
      layout.items.every((item) => !item.textOverflow),
  );
}

async function testFinalFiveTeams() {
  const page = await newPage({ width: 1920, height: 1080 });
  const layout = await getLayout(page);
  const winner = layout.items[0];
  const ranking = layout.items.slice(1);

  check(
    "final: finished badge is shown",
    await page.getByText("ゲーム終了", { exact: true }).isVisible(),
  );
  check(
    "final: room code is shown",
    await page.getByText("ルーム 4821", { exact: true }).isVisible(),
  );
  check(
    "final: final result heading is shown",
    await page.getByRole("heading", { name: "最終結果", exact: true }).isVisible(),
  );
  check(
    "final: final ranking heading is shown",
    await page.getByRole("heading", { name: "最終順位", exact: true }).isVisible(),
  );
  check(
    "final: five teams are labeled",
    await page.getByRole("main").getByText("5チーム", { exact: true }).isVisible(),
  );
  check(
    "final: progress reports all questions",
    layout.progressValue === "8" && layout.progressMax === "8",
  );
  check(
    "final: eight progress dots are filled",
    layout.progressDots.length === 8 &&
      layout.progressDots.every((color) => color === "rgb(88, 204, 2)"),
  );
  check("final: five ranking cards are shown", layout.items.length === 5);
  check(
    "final: winner badge is shown",
    await page.getByText("優勝", { exact: true }).isVisible(),
  );
  check("final: winner is team B", winner?.name === "チームB");
  check(
    "final: winner total is 72pt",
    winner?.text.includes("72pt") === true &&
      winner?.text.includes("全員一致 5回") === true &&
      winner?.text.includes("最終お題 +10pt") === true,
  );
  check(
    "final: winner card is yellow",
    winner?.backgroundColor === "rgb(255, 204, 0)" &&
      winner?.borderColor === "rgb(255, 204, 0)",
  );
  check(
    "final: winner team color is shown",
    winner?.dotColor === "rgb(28, 176, 246)",
  );
  check(
    "final: winner card is the widest row",
    (winner?.width ?? 0) > (layout.items[1]?.width ?? 0) * 3,
  );

  const expected = [
    ["2位", "チームA", "68pt", "全員一致 4回", "最終お題 +8pt"],
    ["3位", "チームD", "61pt", "全員一致 3回", "最終お題 +7pt"],
    ["4位", "チームE", "54pt", "全員一致 2回", "最終お題 +6pt"],
    ["5位", "チームC", "47pt", "全員一致 1回", "最終お題 +5pt"],
  ];

  for (const [index, [rank, name, points, perfect, lastQuestion]] of expected.entries()) {
    const entry = ranking[index];
    check(
      `final: ${rank} is ${name}`,
      entry?.rankBadge === rank && entry?.name === name,
    );
    check(
      `final: ${name} score is ${points}`,
      entry?.text.includes(points) === true &&
        entry?.text.includes(perfect) === true &&
        entry?.text.includes(lastQuestion) === true,
    );
  }

  check(
    "final: second place card uses the surface",
    ranking[0]?.backgroundColor === "rgb(45, 20, 102)",
  );
  check(
    "final: fifth place card uses the quieter surface",
    ranking[3]?.backgroundColor.includes("0.035") === true &&
      ranking[3]?.backgroundColor !== ranking[0]?.backgroundColor,
  );
  check(
    "final: runner-up team colors are shown",
    ranking.map((entry) => entry.dotColor).join(",") ===
      "rgb(88, 204, 2),rgb(255, 150, 0),rgb(255, 75, 75),rgb(206, 130, 255)",
  );

  checkViewportIntegrity("final 1920x1080", layout);
  await screenshot(page, "s05-review-final-1920");
  await page.close();

  for (const [width, height] of [
    [1366, 768],
    [1280, 720],
  ]) {
    const viewportPage = await newPage({ width, height });
    const viewportLayout = await getLayout(viewportPage);
    checkViewportIntegrity(`final ${width}x${height}`, viewportLayout);
    check(
      `final ${width}x${height}: five cards are shown`,
      viewportLayout.items.length === 5,
    );
    await screenshot(viewportPage, `s05-review-final-${width}`);
    await viewportPage.close();
  }
}

async function testTwoTeams() {
  const page = await newPage(
    { width: 1920, height: 1080 },
    "/stage?preview=1&state=final_two_teams",
  );
  const layout = await getLayout(page);

  check(
    "two teams: two cards are shown",
    layout.items.length === 2 && layout.items[0]?.name === "チームB",
  );
  check(
    "two teams: team count is labeled",
    await page.getByRole("main").getByText("2チーム", { exact: true }).isVisible(),
  );
  check(
    "two teams: second place is team A with 68pt",
    layout.items[1]?.rankBadge === "2位" &&
      layout.items[1]?.name === "チームA" &&
      layout.items[1]?.text.includes("68pt") === true,
  );
  check(
    "two teams: runner-up card spans the row",
    Math.abs(
      (layout.items[1]?.width ?? 0) - (layout.items[0]?.width ?? 0),
    ) <= 1,
  );
  checkViewportIntegrity("two teams 1920x1080", layout);
  await screenshot(page, "s05-review-two-teams-1920");
  await page.close();
}

async function testSixTeams() {
  const page = await newPage(
    { width: 1920, height: 1080 },
    "/stage?preview=1&state=final_six_teams",
  );
  const layout = await getLayout(page);

  check(
    "six teams: six cards are shown",
    layout.items.length === 6 && layout.items[0]?.name === "チームB",
  );
  check(
    "six teams: team count is labeled",
    await page.getByRole("main").getByText("6チーム", { exact: true }).isVisible(),
  );
  check(
    "six teams: sixth place is team F with 43pt",
    layout.items[5]?.rankBadge === "6位" &&
      layout.items[5]?.name === "チームF" &&
      layout.items[5]?.text.includes("43pt") === true,
  );
  check(
    "six teams: all team colors are shown",
    layout.items.map((entry) => entry.dotColor).join(",") ===
      "rgb(28, 176, 246),rgb(88, 204, 2),rgb(255, 150, 0),rgb(255, 75, 75),rgb(206, 130, 255),rgb(255, 200, 0)",
  );
  checkViewportIntegrity("six teams 1920x1080", layout);
  await screenshot(page, "s05-review-six-teams-1920");
  await page.close();

  const smallPage = await newPage(
    { width: 1366, height: 768 },
    "/stage?preview=1&state=final_six_teams",
  );
  const smallLayout = await getLayout(smallPage);
  checkViewportIntegrity("six teams 1366x768", smallLayout);
  check(
    "six teams 1366x768: six cards are shown",
    smallLayout.items.length === 6,
  );
  await screenshot(smallPage, "s05-review-six-teams-1366");
  await smallPage.close();
}

async function testPreviewNavigation() {
  const page = await newPage(
    { width: 1366, height: 768 },
    "/stage?preview=1&state=final",
  );

  check(
    "preview: S-03 / S-04 / S-05 navigation is shown",
    (await page
      .getByRole("navigation", { name: "S-03 / S-04 / S-05 プレビュー状態" })
      .count()) === 1,
  );
  check(
    "preview: current final state is marked",
    (await page
      .getByRole("link", { name: "最終結果", exact: true })
      .getAttribute("aria-current")) === "true",
  );

  await page.getByRole("link", { name: "最終 2チーム", exact: true }).click();
  await page.waitForURL("**/stage?preview=1&state=final_two_teams");
  check(
    "preview: 最終 2チーム switches to the two-team final",
    (await page.locator("article").count()) === 2,
  );

  await page.getByRole("link", { name: "最終 6チーム", exact: true }).click();
  await page.waitForURL("**/stage?preview=1&state=final_six_teams");
  check(
    "preview: 最終 6チーム switches to the six-team final",
    (await page.locator("article").count()) === 6,
  );

  await page.getByRole("link", { name: "通常", exact: true }).click();
  await page.waitForURL("**/stage?preview=1&state=scored");
  check(
    "preview: 通常 returns to the S-04 scoreboard",
    await page.getByText("総合順位").isVisible(),
  );

  await page.getByRole("link", { name: "閉じる", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/stage" && !url.search);
  check(
    "preview: closing removes the preview bar",
    (await page
      .getByRole("navigation", { name: "S-03 / S-04 / S-05 プレビュー状態" })
      .count()) === 0,
  );
  await page.getByText("参加受付中").waitFor({ state: "visible", timeout: 10000 });
  check(
    "production: default stage is the live waiting screen",
    await page.getByText("参加受付中").isVisible(),
  );

  await page.close();
}

async function testReducedMotion() {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(`${baseURL}/stage?preview=1&state=final`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(250);

  check(
    "reduced motion: winner score is shown immediately",
    (await page.locator("article").first().textContent())?.includes("72pt") ===
      true,
  );
  check(
    "reduced motion: runner-up score is shown immediately",
    (await page.locator("article").nth(1).textContent())?.includes("68pt") ===
      true,
  );

  await page.close();
  await context.close();
}

try {
  await testFinalFiveTeams();
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
