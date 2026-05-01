# Google Release Radar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static Google release monitoring site deployable to GitHub Pages.

**Architecture:** Use Vite for a static browser app. Use `scripts/fetch-data.mjs` to collect official sources at build time and emit a JSON artifact consumed by `src/main.js`.

**Tech Stack:** Node 20, Vite, plain JavaScript, CSS, GitHub Actions Pages deployment.

---

### Task 1: Data Pipeline

**Files:**
- Create: `scripts/fetch-data.mjs`
- Create output: `public/data/google-releases.json`

- [x] Fetch Chrome stable releases from Chromium Dash for Windows, macOS, Linux, Android, iOS, and ChromeOS.
- [x] Fetch Chrome VersionHistory for the same platforms and record whether it corroborates the Chromium Dash latest version.
- [x] Fetch ChromeOS serving builds and derive representative board rows.
- [x] Fetch Pixel OTA and Factory Images pages and store stable page fingerprints.
- [x] Fetch Android Security Bulletin overview and parse recent SPL rows.
- [x] Fetch Android SDK repository XML and parse key package revisions.
- [x] Fetch Chrome Releases and Android Developers Atom feeds.
- [x] Write a single JSON payload with generated timestamp, summaries, records, source URLs, and source health.

### Task 2: Static UI

**Files:**
- Create: `index.html`
- Create: `src/main.js`
- Create: `src/styles.css`

- [x] Load `data/google-releases.json` at runtime.
- [x] Render first-viewport summary metrics and freshness status.
- [x] Render Chrome, ChromeOS, Android, SDK, source health, and RSS sections.
- [x] Add responsive layout for desktop and mobile.
- [x] Add an explicit empty/error state when data has not been generated.

### Task 3: Deployment

**Files:**
- Create: `.github/workflows/deploy.yml`
- Create: `README.md`

- [x] Add npm scripts for data fetch, dev, build, and preview.
- [x] Add a GitHub Actions workflow for push, manual dispatch, and six-hour schedule.
- [x] Document local development, data sources, and Pages setup.
