// ============================================================
//  VisionExus Ad-Click Bot — Playwright automation
//  Workflow:
//   1. Visit https://visionexus.netlify.app
//   2. Scroll down gradually (3-4 scroll steps)
//   3. Click any ad / sponsored element that appears
//   4. If no ad found → scroll to bottom → exit cleanly
//   5. Repeat until the runner cancels / max iterations hit
// ============================================================

const { chromium } = require("playwright");

// ── Config ───────────────────────────────────────────────────
const TARGET_URL       = "https://visionexus.netlify.app";
const MAX_ITERATIONS   = parseInt(process.env.MAX_ITERATIONS || "999999");
const LOOP_DELAY_MS    = parseInt(process.env.LOOP_DELAY_MS  || "8000");   // wait between loops
const HEADLESS         = process.env.HEADLESS !== "false";                // default to true
const SCROLL_STEPS     = 4;      // how many scroll increments per visit
const SCROLL_PAUSE_MS  = 1800;   // pause between each scroll step
const PAGE_TIMEOUT_MS  = 30000;  // navigation timeout

// Ad selectors — broad net to catch Google AdSense, banner ads, iframes, etc.
const AD_SELECTORS = [
  "ins.adsbygoogle",
  "[id*='google_ads']",
  "[class*='adsbygoogle']",
  "iframe[src*='doubleclick']",
  "iframe[src*='googlesyndication']",
  "iframe[src*='adservice']",
  "[data-ad-slot]",
  "[data-ad-client]",
  "[id*='ad-']",
  "[class*='ad-container']",
  "[class*='ads-']",
  "[class*='advertisement']",
  "[id*='ads_']",
  "div[aria-label*='advertisement' i]",
  "div[aria-label*='sponsored' i]",
  "[class*='sponsored']",
  "[id*='sponsored']",
  "a[href*='googleadservices']",
  "a[href*='googlesyndication']",
];

// ── Helpers ──────────────────────────────────────────────────

/** Scroll the page in smooth increments */
async function scrollPage(page) {
  const totalHeight = await page.evaluate(() => document.body.scrollHeight);
  const viewHeight  = await page.evaluate(() => window.innerHeight);
  const step        = Math.floor((totalHeight - viewHeight) / SCROLL_STEPS);

  console.log(`   📏 Page height: ${totalHeight}px  |  Scrolling in ${SCROLL_STEPS} steps of ~${step}px`);

  for (let i = 1; i <= SCROLL_STEPS; i++) {
    const y = Math.min(step * i, totalHeight);
    await page.evaluate((scrollY) => window.scrollTo({ top: scrollY, behavior: "smooth" }), y);
    console.log(`   ↓ Scroll step ${i}/${SCROLL_STEPS} → y=${y}`);
    await page.waitForTimeout(SCROLL_PAUSE_MS);
  }
}

/** Try to find and click an ad; returns true if clicked */
async function tryClickAd(page) {
  for (const selector of AD_SELECTORS) {
    try {
      const elements = await page.$$(selector);
      for (const el of elements) {
        const box     = await el.boundingBox();
        const visible = await el.isVisible();

        if (!box || !visible || box.width < 10 || box.height < 10) continue;

        console.log(`   🎯 Ad found! Selector: "${selector}"  size: ${Math.round(box.width)}×${Math.round(box.height)}`);

        // Scroll the ad into view then click
        await el.scrollIntoViewIfNeeded();
        await page.waitForTimeout(600);
        await el.click({ timeout: 5000 }).catch(() => {
          // Fallback: JS click (works for iframes / pointer-events:none)
          return page.evaluate((e) => e.click(), el);
        });

        console.log("   ✅ Ad clicked!");
        return true;
      }
    } catch (_) {
      // Selector not present — keep going
    }
  }
  return false;
}

/** Sleep helper */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Main loop ────────────────────────────────────────────────

(async () => {
  console.log("🤖 VisionExus Bot starting…");
  console.log(`   Target  : ${TARGET_URL}`);
  console.log(`   Max iter: ${MAX_ITERATIONS}`);
  console.log(`   Loop gap: ${LOOP_DELAY_MS}ms\n`);

  const browser = await chromium.launch({
    headless: HEADLESS,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  let iteration = 0;

  // Graceful shutdown on SIGINT / SIGTERM
  const shutdown = async () => {
    console.log("\n🛑 Stop signal received — closing browser…");
    await browser.close();
    process.exit(0);
  };
  process.on("SIGINT",  shutdown);
  process.on("SIGTERM", shutdown);

  while (iteration < MAX_ITERATIONS) {
    iteration++;
    console.log(`\n━━━ Iteration #${iteration} ━━━━━━━━━━━━━━━━━━━━━━━━`);

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/124.0.0.0 Safari/537.36",
      viewport: { width: 1366, height: 768 },
    });

    const page = await context.newPage();

    try {
      // 1️⃣  Visit site
      console.log(`   🌐 Navigating to ${TARGET_URL}`);
      await page.goto(TARGET_URL, {
        waitUntil: "domcontentloaded",
        timeout: PAGE_TIMEOUT_MS,
      });
      console.log("   ✔ Page loaded");

      // Small pause so ads can start loading
      await page.waitForTimeout(2500);

      // 2️⃣  Scroll down gradually
      await scrollPage(page);

      // Extra wait after full scroll for lazy-loaded ads
      await page.waitForTimeout(2000);

      // 3️⃣  Try to click an ad
      const clicked = await tryClickAd(page);

      if (!clicked) {
        console.log("   ℹ️  No ads detected — scrolling to bottom and exiting loop iteration");
        await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
        await page.waitForTimeout(1000);
      }

    } catch (err) {
      console.error(`   ❌ Error on iteration #${iteration}: ${err.message}`);
    } finally {
      await context.close();
    }

    // 4️⃣  Wait before next loop
    console.log(`   ⏳ Waiting ${LOOP_DELAY_MS / 1000}s before next iteration…`);
    await sleep(LOOP_DELAY_MS);
  }

  console.log("\n✅ Max iterations reached — bot finished.");
  await browser.close();
})();
