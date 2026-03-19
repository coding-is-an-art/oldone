# 🤖 VisionExus Ad-Click Bot

Automated Playwright bot that:
1. Visits `https://visionexus.netlify.app`
2. Scrolls down gradually (3–4 scroll steps)
3. Clicks any ad / sponsored element it finds
4. If no ad → scrolls to bottom → exits that loop iteration cleanly
5. Repeats indefinitely until you stop it

---

## 📁 Project Structure

```
visionexus-bot/
├── .github/
│   └── workflows/
│       └── bot.yml          ← GitHub Actions workflow
├── tests/
│   └── bot.spec.js          ← Main bot logic (Playwright)
├── package.json
└── README.md
```

---

## 🚀 Deploy to GitHub (Step-by-step)

### Step 1 — Create a GitHub repository

1. Go to https://github.com/new
2. Name it `visionexus-bot` (or anything you like)
3. Set it to **Private** (recommended)
4. Click **Create repository**

### Step 2 — Push this code

```bash
git init
git add .
git commit -m "Initial bot setup"
git remote add origin https://github.com/YOUR_USERNAME/visionexus-bot.git
git branch -M main
git push -u origin main
```

### Step 3 — Enable GitHub Actions

GitHub Actions is enabled by default. Just navigate to:
```
https://github.com/YOUR_USERNAME/visionexus-bot/actions
```
You should see the **VisionExus Ad-Click Bot** workflow listed.

---

## ▶️ How to Run

### Option A — Run manually (on demand)

1. Go to **Actions** tab in your repo
2. Click **VisionExus Ad-Click Bot** in the left sidebar
3. Click **Run workflow** button (top right)
4. Optionally adjust:
   - **Max iterations** (default: 999999 = effectively infinite)
   - **Loop delay seconds** (default: 8 seconds between loops)
5. Click **Run workflow** — the bot starts immediately

### Option B — Automatic schedule

The bot is already configured to run **every 2 hours** automatically via cron.

To change the schedule, edit `.github/workflows/bot.yml`:
```yaml
schedule:
  - cron: "0 */2 * * *"   # every 2 hours
  # - cron: "*/30 * * * *"  # every 30 minutes
  # - cron: "0 * * * *"     # every 1 hour
```

---

## 🛑 How to Stop

**Stop a running job:**
1. Go to **Actions** tab
2. Click the running workflow
3. Click **Cancel workflow** (top right)

**Disable automatic scheduling:**
1. Go to **Actions** tab
2. Click **VisionExus Ad-Click Bot**
3. Click the `...` menu → **Disable workflow**

---

## ⚙️ Configuration (environment variables)

| Variable          | Default   | Description                          |
|-------------------|-----------|--------------------------------------|
| `MAX_ITERATIONS`  | `999999`  | How many loops before auto-stopping  |
| `LOOP_DELAY_MS`   | `8000`    | Milliseconds between iterations      |

These can be set in the GitHub Actions UI when triggering manually,
or hardcoded in `bot.yml`.

---

## 🔍 How the bot finds ads

It scans for all common ad/sponsored selectors:
- Google AdSense (`ins.adsbygoogle`, `[data-ad-slot]`)
- DoubleClick / Google Ad Service iframes
- Elements with `ad`, `ads`, `advertisement`, `sponsored` in class/id/aria-label

---

## 📋 View Logs

After each run, check the logs in **Actions → your run → run-bot** job.
On failure, logs are automatically uploaded as a downloadable artifact.
