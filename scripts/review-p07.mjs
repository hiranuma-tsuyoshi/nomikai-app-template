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

async function newPage(viewport, path = "/play?preview=1&state=result") {
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
    const header = document.querySelector("header");
    const ranking = [
      ...document.querySelectorAll(
        'section[aria-labelledby="overall-ranking-heading"] ol > li',
      ),
    ].map((row) => {
      const cells = [...row.children];
      return {
        rank: cells[0]?.textContent?.trim() ?? "",
        name:
          cells[2]?.textContent?.replace("あなたのチーム", "").trim() ?? "",
        points: cells[3]?.textContent?.trim() ?? "",
        isOwn: row.textContent?.includes("あなたのチーム") ?? false,
        background: getComputedStyle(row).backgroundColor,
      };
    });
    const answerCards = [
      ...document.querySelectorAll(
        'section[aria-labelledby="all-answers-heading"] > ul > li',
      ),
    ].map((card) => ({
      name: card.querySelector("h3")?.textContent?.trim() ?? "",
      text: card.textContent?.replace(/\s+/g, " ").trim() ?? "",
      overflowX: card.scrollWidth > card.clientWidth + 1,
    }));
    const firstChip = document.querySelector(
      'section[aria-labelledby="all-answers-heading"] > ul > li ul > li',
    );

    return {
      pageScroll:
        document.documentElement.scrollHeight > window.innerHeight + 1,
      pageScrollWidth:
        document.documentElement.scrollWidth > window.innerWidth + 1,
      mainScrollable: main ? main.scrollHeight > main.clientHeight + 1 : false,
      mainScrollHeight: main?.scrollHeight ?? 0,
      mainClientHeight: main?.clientHeight ?? 0,
      mainOverflowX: main ? main.scrollWidth > main.clientWidth + 1 : false,
      headerVisible: header
        ? header.getBoundingClientRect().top >= -1 &&
          header.getBoundingClientRect().bottom <= window.innerHeight + 1
        : false,
      ranking,
      answerCards,
      firstChipBackground: firstChip
        ? getComputedStyle(firstChip).backgroundColor
        : "",
      rankingCount: ranking.length,
      answerCardCount: answerCards.length,
    };
  });
}

function checkBaseLayout(label, layout) {
  check(`${label}: document does not scroll`, !layout.pageScroll);
  check(`${label}: page does not scroll horizontally`, !layout.pageScrollWidth);
  check(`${label}: main does not overflow horizontally`, !layout.mainOverflowX);
  check(`${label}: header is visible`, layout.headerVisible);
  check(
    `${label}: answer cards do not clip horizontally`,
    layout.answerCards.length > 0 &&
      layout.answerCards.every((card) => !card.overflowX),
  );
}

function rankingNames(layout) {
  return layout.ranking.map((row) => row.name).join(",");
}

function rankingPoints(layout) {
  return layout.ranking.map((row) => row.points).join(",");
}

async function testScored() {
  const page = await newPage({ width: 390, height: 844 });
  const layout = await getLayout(page);
  const hero = page.locator(
    'section[aria-labelledby="own-result-heading"]',
  );

  check(
    "scored: result heading is shown",
    await page.getByRole("heading", { name: "結果", exact: true }).isVisible(),
  );
  check(
    "scored: question and progress are shown",
    await page.getByText("第3問 / 全8問").isVisible(),
  );
  check(
    "scored: question text is shown",
    await page.getByText("「朝ごはんといえば？」").isVisible(),
  );
  check(
    "scored: own team and player are shown",
    await page
      .locator("header")
      .getByText("チームA", { exact: true })
      .isVisible() &&
      (await page.locator("header").getByText("/ ひらぬま").isVisible()),
  );
  check(
    "scored: own answer is shown",
    await hero.getByText("「カレー」", { exact: true }).isVisible(),
  );
  check(
    "scored: earned points are shown",
    await hero.getByText("+8pt", { exact: true }).isVisible(),
  );
  check(
    "scored: consistency rate is shown",
    await hero.getByText("83%", { exact: true }).isVisible(),
  );
  check(
    "scored: matching answer count is shown",
    await hero.getByText("5 / 6人一致", { exact: true }).isVisible(),
  );
  check(
    "scored: total points are shown",
    await hero.getByText("21pt", { exact: true }).isVisible(),
  );
  check(
    "scored: rate progressbar reports 83",
    (await page
      .getByRole("progressbar", { name: "チームの一致率" })
      .getAttribute("aria-valuenow")) === "83",
  );
  check(
    "scored: question progressbar reports 3",
    (await page
      .getByRole("progressbar", { name: "お題の進行状況" })
      .getAttribute("aria-valuenow")) === "3",
  );

  check("scored: five ranking rows are shown", layout.rankingCount === 5);
  check(
    "scored: ranking order is B, A, D, E, C",
    rankingNames(layout) === "チームB,チームA,チームD,チームE,チームC",
  );
  check(
    "scored: ranking points are correct",
    rankingPoints(layout) === "23pt,21pt,18pt,15pt,12pt",
  );
  check(
    "scored: own team row is marked",
    layout.ranking[1]?.isOwn === true &&
      layout.ranking.filter((row) => row.isOwn).length === 1,
  );
  check(
    "scored: own team row is highlighted",
    layout.ranking[1]?.background === "rgb(247, 255, 233)",
  );
  check(
    "scored: first place rank badge is yellow",
    (await page.evaluate(() => {
      const badge = document.querySelector(
        'section[aria-labelledby="overall-ranking-heading"] ol > li > span',
      );
      return badge ? getComputedStyle(badge).backgroundColor : "";
    })) === "rgb(255, 200, 0)",
  );

  check("scored: five answer cards are shown", layout.answerCardCount === 5);
  const answers = Object.fromEntries(
    layout.answerCards.map((card) => [card.name, card.text]),
  );
  check(
    "scored: team A answers are shown",
    answers["チームA"]?.includes("6 / 6人") &&
      answers["チームA"]?.includes("カレー×5") &&
      answers["チームA"]?.includes("ごはん×1"),
  );
  check(
    "scored: team B answer and integrated note are shown",
    answers["チームB"]?.includes("6 / 6人") &&
      answers["チームB"]?.includes("カレー×6") &&
      answers["チームB"]?.includes("カレーライス統合"),
  );
  check(
    "scored: team C answers are shown",
    answers["チームC"]?.includes("ごはん×3") &&
      answers["チームC"]?.includes("パン×2") &&
      answers["チームC"]?.includes("うどん×1"),
  );
  check(
    "scored: team D answers are shown",
    answers["チームD"]?.includes("カレー×4") &&
      answers["チームD"]?.includes("シリアル×2"),
  );
  check(
    "scored: team E answers are shown",
    answers["チームE"]?.includes("5 / 6人") &&
      answers["チームE"]?.includes("トースト×3") &&
      answers["チームE"]?.includes("ごはん×2"),
  );
  check(
    "scored: top answer chip is highlighted",
    layout.firstChipBackground === "rgb(255, 244, 229)",
  );
  check(
    "scored: integrated note uses the blue accent",
    (await page.evaluate(() => {
      const note = document.querySelector(
        'section[aria-labelledby="all-answers-heading"] span.text-spark-blue-ink',
      );
      return note ? getComputedStyle(note).color : "";
    })) === "rgb(11, 120, 176)",
  );

  checkBaseLayout("scored 390x844", layout);
  check(
    "scored 390x844: results scroll vertically",
    layout.mainScrollable &&
      layout.mainScrollHeight > layout.mainClientHeight,
  );
  await screenshot(page, "p07-review-scored-390-top");

  await page.locator("main").evaluate((main) => {
    main.scrollTop = main.scrollHeight;
  });
  await page.waitForTimeout(200);
  check(
    "scored: waiting note is reachable at the bottom",
    await page
      .getByText("次のお題をお待ちください", { exact: true })
      .isVisible(),
  );
  check(
    "scored: header stays visible after scrolling",
    (await page.evaluate(() => {
      const header = document.querySelector("header");
      return header ? header.getBoundingClientRect().top >= -1 : false;
    })) === true,
  );
  await screenshot(page, "p07-review-scored-390-bottom");
  await page.close();

  const smallPage = await newPage(
    { width: 320, height: 568 },
    "/play?preview=1&state=result",
  );
  const smallLayout = await getLayout(smallPage);
  checkBaseLayout("scored 320x568", smallLayout);
  check(
    "scored 320x568: five ranking rows and five answer cards are shown",
    smallLayout.rankingCount === 5 && smallLayout.answerCardCount === 5,
  );
  await smallPage.locator("main").evaluate((main) => {
    main.scrollTop = main.scrollHeight;
  });
  await smallPage.waitForTimeout(200);
  check(
    "scored 320x568: waiting note is reachable",
    await smallPage
      .getByText("次のお題をお待ちください", { exact: true })
      .isVisible(),
  );
  await screenshot(smallPage, "p07-review-scored-320-bottom");
  await smallPage.close();
}

async function testPerfect() {
  const page = await newPage(
    { width: 390, height: 844 },
    "/play?preview=1&state=result_perfect",
  );
  const layout = await getLayout(page);
  const hero = page.locator(
    'section[aria-labelledby="own-result-heading"]',
  );

  check(
    "perfect: own team B is shown",
    await page.locator("header").getByText("チームB", { exact: true }).isVisible(),
  );
  check(
    "perfect: 全員一致 badge is shown",
    await hero.getByText("全員一致", { exact: true }).isVisible(),
  );
  check(
    "perfect: 100% is shown",
    await hero.getByText("100%", { exact: true }).isVisible(),
  );
  check(
    "perfect: +10pt is shown",
    await hero.getByText("+10pt", { exact: true }).isVisible(),
  );
  check(
    "perfect: 6 / 6人一致 is shown",
    await hero.getByText("6 / 6人一致", { exact: true }).isVisible(),
  );
  check(
    "perfect: total is 23pt",
    await hero.getByText("23pt", { exact: true }).isVisible(),
  );
  check(
    "perfect: rate progressbar reports 100",
    (await page
      .getByRole("progressbar", { name: "チームの一致率" })
      .getAttribute("aria-valuenow")) === "100",
  );
  check(
    "perfect: hero uses the yellow highlight",
    (await hero.evaluate(
      (element) => getComputedStyle(element).borderColor,
    )) === "rgb(255, 200, 0)",
  );
  check(
    "perfect: own team is first",
    rankingNames(layout) === "チームB,チームA,チームD,チームE,チームC" &&
      layout.ranking[0]?.isOwn === true,
  );
  checkBaseLayout("perfect 390x844", layout);

  const smallPage = await newPage(
    { width: 320, height: 568 },
    "/play?preview=1&state=result_perfect",
  );
  checkBaseLayout("perfect 320x568", await getLayout(smallPage));
  await smallPage.close();

  await screenshot(page, "p07-review-perfect-390");
  await page.close();
}

async function testExcluded() {
  const page = await newPage(
    { width: 390, height: 844 },
    "/play?preview=1&state=result_excluded",
  );
  const layout = await getLayout(page);
  const hero = page.locator(
    'section[aria-labelledby="own-result-heading"]',
  );
  const heroText = (await hero.textContent())?.replace(/\s+/g, " ") ?? "";

  check(
    "excluded: own team C is shown",
    await page.locator("header").getByText("チームC", { exact: true }).isVisible(),
  );
  check(
    "excluded: 採点対象外 badge is shown",
    await hero.getByText("採点対象外", { exact: true }).isVisible(),
  );
  check(
    "excluded: reason is shown",
    await hero
      .getByText("回答者4人未満のため得点なし", { exact: true })
      .isVisible(),
  );
  check("excluded: no earned points are shown", !/\+\d+pt/.test(heroText));
  check("excluded: no rate is shown", !heroText.includes("%"));
  check(
    "excluded: rate progressbar is not shown",
    (await page.getByRole("progressbar", { name: "チームの一致率" }).count()) ===
      0,
  );
  check(
    "excluded: total is 12pt",
    await hero.getByText("12pt", { exact: true }).isVisible(),
  );
  check(
    "excluded: team C is last",
    layout.ranking[4]?.name === "チームC" && layout.ranking[4]?.isOwn === true,
  );
  check(
    "excluded: team C answer count is 3 / 6",
    layout.answerCards.find((card) => card.name === "チームC")?.text.includes(
      "3 / 6人",
    ) ?? false,
  );
  check(
    "excluded: team C answers are shown",
    layout.answerCards.find((card) => card.name === "チームC")?.text.includes(
      "ごはん×2",
    ) ?? false,
  );
  checkBaseLayout("excluded 390x844", layout);

  const smallPage = await newPage(
    { width: 320, height: 568 },
    "/play?preview=1&state=result_excluded",
  );
  checkBaseLayout("excluded 320x568", await getLayout(smallPage));
  await smallPage.close();

  await screenshot(page, "p07-review-excluded-390");
  await page.close();
}

async function testUnanswered() {
  const page = await newPage(
    { width: 390, height: 844 },
    "/play?preview=1&state=result_unanswered",
  );
  const layout = await getLayout(page);
  const hero = page.locator(
    'section[aria-labelledby="own-result-heading"]',
  );

  check(
    "unanswered: no-answer label is shown",
    await hero.getByText("回答なし", { exact: true }).isVisible(),
  );
  check(
    "unanswered: no-answer explanation is shown",
    await hero
      .getByText("今回は回答していません", { exact: true })
      .isVisible(),
  );
  check(
    "unanswered: team score is still shown",
    await hero.getByText("+8pt", { exact: true }).isVisible() &&
      (await hero.getByText("83%", { exact: true }).isVisible()),
  );
  check(
    "unanswered: team A is second",
    layout.ranking[1]?.name === "チームA" && layout.ranking[1]?.isOwn === true,
  );
  checkBaseLayout("unanswered 390x844", layout);

  const smallPage = await newPage(
    { width: 320, height: 568 },
    "/play?preview=1&state=result_unanswered",
  );
  checkBaseLayout("unanswered 320x568", await getLayout(smallPage));
  await smallPage.close();

  await screenshot(page, "p07-review-unanswered-390");
  await page.close();
}

async function testPreviewNavigation() {
  const page = await newPage({ width: 390, height: 844 });

  check(
    "preview: participant preview label is shown",
    await page.getByText("参加者 Preview", { exact: true }).isVisible(),
  );
  check(
    "preview: current result state is marked",
    (await page
      .getByRole("link", { name: "結果", exact: true })
      .getAttribute("aria-current")) === "true",
  );

  await page.getByRole("link", { name: "全員一致", exact: true }).click();
  await page.waitForURL("**/play?preview=1&state=result_perfect");
  check(
    "preview: 全員一致 switches to the perfect result",
    await page.getByText("+10pt", { exact: true }).isVisible(),
  );

  await page.getByRole("link", { name: "採点対象外", exact: true }).click();
  await page.waitForURL("**/play?preview=1&state=result_excluded");
  check(
    "preview: 採点対象外 switches to the excluded result",
    await page.getByText("回答者4人未満のため得点なし").isVisible(),
  );

  await page.getByRole("link", { name: "回答なし", exact: true }).click();
  await page.waitForURL("**/play?preview=1&state=result_unanswered");
  check(
    "preview: 回答なし switches to the unanswered result",
    await page.getByText("今回は回答していません").isVisible(),
  );

  await page.getByRole("link", { name: "最終確認", exact: true }).click();
  await page.waitForURL("**/play?preview=1&state=final_check");
  check(
    "preview: final check screen still works",
    await page
      .getByRole("heading", { name: "回答を公開する前に" })
      .isVisible(),
  );

  await page.getByRole("link", { name: "閉じる", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/play" && !url.search);
  check(
    "preview: closing removes the preview bar",
    (await page.getByText("参加者 Preview", { exact: true }).count()) === 0,
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
  await testScored();
  await testPerfect();
  await testExcluded();
  await testUnanswered();
  await testPreviewNavigation();
} finally {
  await browser.close();
}

for (const result of results) {
  console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}`);
}

console.log(`\n${results.length} checks passed`);
