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

async function newPage(viewport) {
  const page = await browser.newPage({ viewport });
  await page.goto(`${baseURL}/play?preview=1`, { waitUntil: "networkidle" });
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  return page;
}

async function screenshot(page, name, options = {}) {
  await page.waitForTimeout(500);
  await page.screenshot({
    path: `${outputDir}/${name}.png`,
    fullPage: options.fullPage ?? false,
  });
}

async function testFlow() {
  const page = await newPage({ width: 390, height: 844 });
  const input = page.getByLabel("あなたの回答");
  const submit = page.getByRole("button", { name: "回答する" });

  check("initial submit is disabled", !(await submit.isEnabled()));

  await input.fill("   ");
  check("whitespace-only answer is disabled", !(await submit.isEnabled()));

  await input.fill("カレー");
  check("submit is enabled after input", await submit.isEnabled());
  await screenshot(page, "p04-filled-390");

  await submit.click();
  await page.getByText("回答を受け付けました").waitFor();
  check("submitted card is visible", await page.getByText("回答を受け付けました").isVisible());
  check("submitted answer is visible", await page.getByText("「カレー」").isVisible());
  check("answer count increments", await page.getByText("19 / 30人").isVisible());
  check(
    "submitted state fits without scrolling at 390x844",
    await page.evaluate(
      () =>
        document.querySelector("main")?.clientHeight ===
        document.querySelector("main")?.scrollHeight,
    ),
  );
  await screenshot(page, "p04-submitted-390");

  await page.getByRole("button", { name: "回答を修正する" }).click();
  check("edit restores the answer", (await input.inputValue()) === "カレー");

  await input.fill("あ".repeat(20));
  check("20 characters are allowed", await submit.isEnabled());
  await input.pressSequentially("あ");
  check(
    "maxLength prevents a 21st character",
    (await input.inputValue()) === "あ".repeat(20),
  );

  await page.close();
}

async function testStates() {
  for (const state of ["typing", "closed", "error", "low_time"]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${baseURL}/play?preview=1&state=${state}`, {
      waitUntil: "networkidle",
    });
    await page.addStyleTag({
      content: "nextjs-portal { display: none !important; }",
    });
    const fits = await page.evaluate(
      () =>
        document.querySelector("main")?.clientHeight ===
        document.querySelector("main")?.scrollHeight,
    );
    check(`${state} state fits without scrolling at 390x844`, fits);
    await screenshot(page, `p04-${state}-390`);
    await page.close();
  }

  const errorPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await errorPage.goto(`${baseURL}/play?preview=1&state=error`, {
    waitUntil: "networkidle",
  });
  check("offline banner is visible", await errorPage.getByText("再接続中...").isVisible());
  await errorPage.getByRole("button", { name: "再試行" }).click();
  check(
    "retry hides the offline banner",
    !(await errorPage.getByText("再接続中...").isVisible()),
  );
  check(
    "retry enables submit",
    await errorPage.getByRole("button", { name: "回答する" }).isEnabled(),
  );
  await errorPage.close();

  const closedPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await closedPage.goto(`${baseURL}/play?preview=1&state=closed`, {
    waitUntil: "networkidle",
  });
  check("closed state uses 未回答 copy", await closedPage.getByText("未回答12人").isVisible());
  await closedPage.close();

  const lowPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await lowPage.goto(`${baseURL}/play?preview=1&state=low_time`, {
    waitUntil: "networkidle",
  });
  await lowPage
    .getByRole("heading", { name: "回答受付が終了しました" })
    .waitFor({ timeout: 12000 });
  check("timer automatically closes the screen", true);
  await lowPage.close();
}

async function testResponsive() {
  for (const [width, height] of [
    [320, 568],
    [375, 667],
    [390, 844],
    [430, 932],
  ]) {
    const page = await newPage({ width, height });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    check(`no horizontal overflow at ${width}px`, !overflow);
    await screenshot(page, `p04-default-${width}`, { fullPage: true });
    await page.close();
  }

  const desktop = await newPage({ width: 1440, height: 900 });
  await screenshot(desktop, "p04-default-desktop");
  const columnWidth = await desktop
    .locator("main")
    .evaluate((element) => element.parentElement?.getBoundingClientRect().width);
  check("desktop app column is 480px", columnWidth === 480);
  await desktop.close();
}

async function testAppShell() {
  for (const [width, height] of [
    [320, 568],
    [375, 667],
    [390, 844],
    [430, 932],
  ]) {
    const page = await newPage({ width, height });
    await page.addStyleTag({
      content: "div.shrink-0.bg-night-ink { display: none !important; }",
    });
    const layout = await page.evaluate(() => {
      const footer = document.querySelector("footer")?.getBoundingClientRect();
      const main = document.querySelector("main")?.getBoundingClientRect();
      const submit = [...document.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === "回答する",
      )?.getBoundingClientRect();

      return {
        innerHeight: window.innerHeight,
        documentHeight: document.documentElement.scrollHeight,
        footer: footer?.toJSON(),
        main: main?.toJSON(),
        mainClientHeight: document.querySelector("main")?.clientHeight,
        mainScrollHeight: document.querySelector("main")?.scrollHeight,
        privacyBottom: [...document.querySelectorAll("p")]
          .find((element) =>
            element.textContent?.includes("回答は公開まで他の人に見えません"),
          )
          ?.getBoundingClientRect().bottom,
        submit: submit?.toJSON(),
      };
    });

    check(
      `page itself does not scroll at ${width}x${height}`,
      layout.documentHeight <= layout.innerHeight + 1,
    );
    check(
      `footer is fully inside the viewport at ${width}x${height}`,
      Boolean(layout.footer) && layout.footer.bottom <= layout.innerHeight + 1,
    );
    check(
      `footer does not cover main content at ${width}x${height}`,
      Boolean(layout.main) &&
        Boolean(layout.footer) &&
        layout.footer.top >= layout.main.bottom - 1,
    );
    check(
      `submit CTA stays visible at ${width}x${height}`,
      Boolean(layout.submit) &&
        Boolean(layout.footer) &&
        layout.submit.top >= layout.footer.top &&
        layout.submit.bottom <= layout.footer.bottom,
    );
    check(
      `default screen fits without scrolling at ${width}x${height}`,
      layout.mainClientHeight === layout.mainScrollHeight,
    );
    check(
      `privacy note is fully visible at ${width}x${height}`,
      typeof layout.privacyBottom === "number" &&
        Boolean(layout.footer) &&
        layout.privacyBottom <= layout.footer.top,
    );

    await page.close();
  }

  const compact = await newPage({ width: 320, height: 568 });
  await compact.addStyleTag({
    content: "div.shrink-0.bg-night-ink { display: none !important; }",
  });
  await compact.getByLabel("あなたの回答").focus();
  await compact.waitForTimeout(300);
  const focused = await compact.evaluate(() => {
    const input = document.querySelector("#answer")?.getBoundingClientRect();
    const main = document.querySelector("main")?.getBoundingClientRect();
    const footer = document.querySelector("footer")?.getBoundingClientRect();
    return {
      input: input?.toJSON(),
      main: main?.toJSON(),
      footer: footer?.toJSON(),
    };
  });
  check(
    "focused input scrolls above the footer at 320x568",
    Boolean(focused.input) &&
      Boolean(focused.main) &&
      Boolean(focused.footer) &&
      focused.input.top >= focused.main.top - 1 &&
      focused.input.bottom <= focused.footer.top + 1,
  );
  await screenshot(compact, "p04-compact-focus-320");
  await compact.close();

  const resized = await newPage({ width: 390, height: 844 });
  await resized.addStyleTag({
    content: "div.shrink-0.bg-night-ink { display: none !important; }",
  });
  await resized.setViewportSize({ width: 390, height: 420 });
  await resized.getByLabel("あなたの回答").focus();
  await resized.waitForTimeout(300);
  const resizedLayout = await resized.evaluate(() => {
    const input = document.querySelector("#answer")?.getBoundingClientRect();
    const main = document.querySelector("main")?.getBoundingClientRect();
    const footer = document.querySelector("footer")?.getBoundingClientRect();
    return {
      innerHeight: window.innerHeight,
      input: input?.toJSON(),
      main: main?.toJSON(),
      footer: footer?.toJSON(),
    };
  });
  check(
    "footer stays visible when the keyboard shrinks the viewport",
    Boolean(resizedLayout.footer) &&
      resizedLayout.footer.bottom <= resizedLayout.innerHeight + 1,
  );
  check(
    "focused input stays above the footer when the viewport shrinks",
    Boolean(resizedLayout.input) &&
      Boolean(resizedLayout.main) &&
      Boolean(resizedLayout.footer) &&
      resizedLayout.input.top >= resizedLayout.main.top - 1 &&
      resizedLayout.input.bottom <= resizedLayout.footer.top + 1,
  );
  await screenshot(resized, "p04-keyboard-390x420");
  await resized.close();
}

async function testPreviewShell() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${baseURL}/play?preview=1`, { waitUntil: "networkidle" });
  const layout = await page.evaluate(() => {
    const footer = document.querySelector("footer")?.getBoundingClientRect();
    return {
      innerHeight: window.innerHeight,
      documentHeight: document.documentElement.scrollHeight,
      footer: footer?.toJSON(),
    };
  });
  check(
    "preview mode does not scroll the page",
    layout.documentHeight <= layout.innerHeight + 1,
  );
  check(
    "preview mode keeps the footer visible",
    Boolean(layout.footer) && layout.footer.bottom <= layout.innerHeight + 1,
  );
  check(
    "all six preview states are reachable",
    (await page.locator("a", { hasText: /通常|入力中|送信済み|締切|通信エラー|残り10秒/ }).count()) === 6,
  );
  await screenshot(page, "p04-preview-mode");
  await page.close();
}

async function testTapTargets() {
  const page = await newPage({ width: 390, height: 844 });
  await page.addStyleTag({
    content: "div.shrink-0.bg-night-ink { display: none !important; }",
  });
  await page.getByLabel("あなたの回答").fill("カレー");
  const undersized = await page.evaluate(() => {
    return [...document.querySelectorAll("button, a, input")]
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          rect.width > 0 &&
          rect.height > 0
        );
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          label:
            element.getAttribute("aria-label") ??
            element.textContent?.trim().slice(0, 24) ??
            element.tagName,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter((element) => element.width < 44 || element.height < 44);
  });
  check(
    "visible controls meet the 44px touch target",
    undersized.length === 0,
  );
  await page.close();
}

async function testLongQuestion() {
  const page = await newPage({ width: 390, height: 844 });
  await page.locator("h1").evaluate((element) => {
    element.textContent =
      "人生で一番おいしかった朝ごはんは何ですか？理由も含めて教えてください。";
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  check("long question has no horizontal overflow", !overflow);
  await screenshot(page, "p04-long-question", { fullPage: true });
  await page.close();
}

async function testKeyboardFocus() {
  const page = await newPage({ width: 390, height: 844 });
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.getByLabel("あなたの回答").focus();
  await screenshot(page, "p04-focus");
  await page.close();
}

try {
  await testFlow();
  await testStates();
  await testResponsive();
  await testAppShell();
  await testPreviewShell();
  await testTapTargets();
  await testLongQuestion();
  await testKeyboardFocus();
} finally {
  await browser.close();
}

for (const result of results) {
  console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}`);
}
console.log(`\n${results.length} checks passed. Screenshots: ${outputDir}/`);
