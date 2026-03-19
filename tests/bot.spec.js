// ============================================================
//  VisionExus Ad-Click Bot — V2 STEALTH EDITION
//  Workflow:
//   1. Visit https://visionexus.netlify.app with a stealth browser
//   2. Simulate human-like mouse movements (Bezier curve paths)
//   3. Stochastic ad clicking (configurable CTR%, default 3%)
//   4. If ad clicked → engage on the advertiser's page for 2+ min
//   5. Repeat until the runner cancels / max iterations hit
//
//  Stealth layers:
//   ✅ playwright-extra + stealth plugin (removes navigator.webdriver etc.)
//   ✅ Random User-Agent rotation per session
//   ✅ Realistic viewport + locale + timezone
//   ✅ Bezier-curve mouse movement before any click
//   ✅ Stochastic CTR (skip clicking most of the time)
//   ✅ Post-click engagement simulation on advertiser page
//   ✅ Residential proxy support (optional via env vars)
// ============================================================

const { chromium: playwrightChromium } = require("playwright-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const UserAgent = require("user-agents");

playwrightChromium.use(StealthPlugin());

// ── Config ───────────────────────────────────────────────────
const TARGET_URL      = "https://visionexus.netlify.app";
const MAX_ITERATIONS  = parseInt(process.env.MAX_ITERATIONS || "999999");
const LOOP_DELAY_MS   = parseInt(process.env.LOOP_DELAY_MS  || "8000");
const HEADLESS        = process.env.HEADLESS !== "false";
const CLICK_RATE      = parseFloat(process.env.CLICK_RATE   || "0.03");  // 3% CTR by default
const ENGAGE_MIN_MS   = parseInt(process.env.ENGAGE_MIN_MS  || "120000"); // 2 min on advertiser page
const ENGAGE_MAX_MS   = parseInt(process.env.ENGAGE_MAX_MS  || "240000"); // 4 min max

// Proxy config (optional). Set PROXY_SERVER, PROXY_USER, PROXY_PASS in env.
const PROXY_CONFIG = process.env.PROXY_SERVER
  ? { server: process.env.PROXY_SERVER, username: process.env.PROXY_USER, password: process.env.PROXY_PASS }
  : null;

const SCROLL_STEPS    = 5;
const SCROLL_PAUSE_MS = 1500;
const PAGE_TIMEOUT_MS = 35000;

// Ad selectors
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

// Realistic viewport sizes used by real users
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
];

// ── Helpers ──────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand  = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));

/** Cubic Bezier point interpolation */
function bezierPoint(t, p0, p1, p2, p3) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

/** Move mouse from (x0,y0) to (x1,y1) along a randomised Bezier curve */
async function humanMouseMove(page, x0, y0, x1, y1) {
  const steps = randInt(20, 40);
  // Random control points offset from midpoint
  const cx1 = (x0 + x1) / 2 + rand(-120, 120);
  const cy1 = (y0 + y1) / 2 + rand(-80, 80);
  const cx2 = (x0 + x1) / 2 + rand(-120, 120);
  const cy2 = (y0 + y1) / 2 + rand(-80, 80);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mx = bezierPoint(t, x0, cx1, cx2, x1);
    const my = bezierPoint(t, y0, cy1, cy2, y1);
    await page.mouse.move(mx, my);
    await sleep(rand(8, 22));  // micro-pause between each movement step
  }
}

/** Scroll the page with human-like pauses and variable speed */
async function scrollPage(page) {
  const totalHeight = await page.evaluate(() => document.body.scrollHeight);
  const viewHeight  = await page.evaluate(() => window.innerHeight);
  const step        = Math.floor((totalHeight - viewHeight) / SCROLL_STEPS);

  console.log(`   📏 Height: ${totalHeight}px | ${SCROLL_STEPS} scroll steps of ~${step}px`);

  for (let i = 1; i <= SCROLL_STEPS; i++) {
    const y = Math.min(step * i + randInt(-60, 60), totalHeight);
    await page.evaluate((scrollY) => window.scrollTo({ top: scrollY, behavior: "smooth" }), y);
    console.log(`   ↓ Scroll ${i}/${SCROLL_STEPS} → y=${y}`);
    await sleep(rand(SCROLL_PAUSE_MS * 0.8, SCROLL_PAUSE_MS * 1.4));
  }
}

/** Simulate browsing engagement on a new page (post-click) */
async function engageOnPage(page, totalMs) {
  console.log(`   🔍 Engaging on advertiser page for ~${Math.round(totalMs / 1000)}s...`);
  const deadline = Date.now() + totalMs;

  while (Date.now() < deadline) {
    const action = Math.random();

    if (action < 0.4) {
      // Scroll down
      const y = randInt(300, 1500);
      await page.evaluate((sy) => window.scrollBy({ top: sy, behavior: "smooth" }), y).catch(() => {});

    } else if (action < 0.55) {
      // Scroll back up a bit (realistic)
      const y = randInt(100, 600);
      await page.evaluate((sy) => window.scrollBy({ top: -sy, behavior: "smooth" }), y).catch(() => {});

    } else if (action < 0.70) {
      // Click a random safe internal link to deepen engagement
      const clicked = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll("a[href]"))
          .filter(a => {
            try {
              const href = new URL(a.href);
              return href.hostname === window.location.hostname && a.href !== window.location.href;
            } catch { return false; }
          });
        if (links.length > 0) {
          links[Math.floor(Math.random() * links.length)].click();
          return true;
        }
        return false;
      }).catch(() => false);
      if (clicked) {
        console.log("   🔗 Clicked an internal page link on advertiser site");
        await sleep(rand(3000, 6000));
      }

    } else {
      // Move the mouse randomly to simulate cursor activity
      const vp = page.viewportSize() || { width: 1366, height: 768 };
      await page.mouse.move(rand(100, vp.width - 100), rand(100, vp.height - 100)).catch(() => {});
    }

    await sleep(rand(2500, 7000));
  }

  console.log("   ✅ Engagement complete.");
}

/** Try to find an ad candidate. Returns the element and its box, or null. */
async function findAdElement(page) {
  for (const selector of AD_SELECTORS) {
    try {
      const elements = await page.$$(selector);
      for (const el of elements) {
        const box     = await el.boundingBox();
        const visible = await el.isVisible();
        if (!box || !visible || box.width < 10 || box.height < 10) continue;
        return { el, box, selector };
      }
    } catch (_) {}
  }
  return null;
}

// ── Main loop ────────────────────────────────────────────────

(async () => {
  console.log("🤖 VisionExus Bot V2 — Stealth Edition launching…");
  console.log(`   Target    : ${TARGET_URL}`);
  console.log(`   Max iter  : ${MAX_ITERATIONS}`);
  console.log(`   Loop gap  : ${LOOP_DELAY_MS}ms`);
  console.log(`   Click rate: ${(CLICK_RATE * 100).toFixed(1)}%`);
  console.log(`   Proxy     : ${PROXY_CONFIG ? PROXY_CONFIG.server : "none (direct)"}\n`);

  const browser = await playwrightChromium.launch({
    headless: HEADLESS,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
  });

  let iteration = 0;

  const shutdown = async () => {
    console.log("\n🛑 Stop signal — closing browser…");
    await browser.close();
    process.exit(0);
  };
  process.on("SIGINT",  shutdown);
  process.on("SIGTERM", shutdown);

  while (iteration < MAX_ITERATIONS) {
    iteration++;
    console.log(`\n━━━ Iteration #${iteration} ━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Pick a random viewport each session
    const viewport = VIEWPORTS[randInt(0, VIEWPORTS.length - 1)];
    // Generate a realistic User-Agent for this session
    const ua = new UserAgent({ deviceCategory: "desktop" }).toString();

    const contextOptions = {
      userAgent: ua,
      viewport,
      locale: "en-US",
      timezoneId: "America/New_York",
      javaScriptEnabled: true,
      hasTouch: false,
      permissions: [],
    };
    if (PROXY_CONFIG) contextOptions.proxy = PROXY_CONFIG;

    const context = await browser.newContext(contextOptions);
    const page    = await context.newPage();

    // Mask additional automation signals
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
      Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
      window.chrome = { runtime: {} };
    });

    try {
      console.log(`   🖥  UA: ${ua.substring(0, 80)}…`);
      console.log(`   📐 Viewport: ${viewport.width}×${viewport.height}`);
      console.log(`   🌐 Navigating to ${TARGET_URL}`);

      await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });
      console.log("   ✔ Page loaded");

      // Slight pre-scroll pause (human would look at top of page first)
      await sleep(rand(2000, 4500));

      // Move mouse to a random position before interacting
      await page.mouse.move(rand(200, viewport.width - 200), rand(100, 300));
      await sleep(rand(400, 800));

      // Scroll through the page
      await scrollPage(page);

      // Extra wait for lazy-loaded ads
      await sleep(rand(1500, 3000));

      // Stochastic CTR — only click the ad CLICK_RATE fraction of the time
      const willClick = Math.random() < CLICK_RATE;
      console.log(`   🎲 CTR roll: ${willClick ? "✅ Will click" : "⏭  Skipping ad this iteration"}`);

      if (willClick) {
        const adCandidate = await findAdElement(page);

        if (adCandidate) {
          const { el, box, selector } = adCandidate;
          console.log(`   🎯 Ad found! Selector: "${selector}"  size: ${Math.round(box.width)}×${Math.round(box.height)}`);

          // Scroll ad into view, pause, then move mouse to it along a Bezier curve
          await el.scrollIntoViewIfNeeded();
          await sleep(rand(500, 1000));

          const currentPos = { x: rand(100, 400), y: rand(100, 300) };
          const targetX = box.x + box.width  * rand(0.3, 0.7);
          const targetY = box.y + box.height * rand(0.3, 0.7);

          await humanMouseMove(page, currentPos.x, currentPos.y, targetX, targetY);
          await sleep(rand(200, 600));

          // Open click in new tab (more realistic) or direct click
          const [newPage] = await Promise.all([
            context.waitForEvent("page", { timeout: 6000 }).catch(() => null),
            page.mouse.click(targetX, targetY),
          ]);

          console.log("   ✅ Ad clicked!");

          if (newPage) {
            console.log(`   🆕 New tab opened: ${newPage.url().substring(0, 80)}…`);
            await newPage.waitForLoadState("domcontentloaded").catch(() => {});
            const engageDuration = randInt(ENGAGE_MIN_MS, ENGAGE_MAX_MS);
            await engageOnPage(newPage, engageDuration);
            await newPage.close();
            console.log("   🚪 Advertiser tab closed.");
          } else {
            // No new tab — engage on the same page
            await page.waitForLoadState("domcontentloaded").catch(() => {});
            const engageDuration = randInt(ENGAGE_MIN_MS, ENGAGE_MAX_MS);
            await engageOnPage(page, engageDuration);
          }

        } else {
          console.log("   ℹ️  CTR roll said click, but no ad was visible — skipping.");
        }
      } else {
        // Non-clicking iteration: do some realistic browsing anyway
        await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
        await sleep(rand(1000, 2500));
      }

    } catch (err) {
      console.error(`   ❌ Error on iteration #${iteration}: ${err.message}`);
    } finally {
      await context.close();
    }

    console.log(`   ⏳ Waiting ${LOOP_DELAY_MS / 1000}s before next iteration…`);
    await sleep(LOOP_DELAY_MS);
  }

  console.log("\n✅ Max iterations reached — bot finished.");
  await browser.close();
})();
