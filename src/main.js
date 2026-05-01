import "./styles.css";

const dataUrl = `${import.meta.env.BASE_URL}data/google-releases.json`;

const icons = {
  pulse:
    '<svg viewBox="0 0 24 24"><path d="M3 12h4l2-7 4 14 2-7h6"/></svg>',
  box:
    '<svg viewBox="0 0 24 24"><path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>',
  shield:
    '<svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.5 2.9 8.7 7 10 4.1-1.3 7-5.5 7-10V6l-7-3Z"/></svg>',
  link:
    '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1"/></svg>',
  clock:
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  git:
    '<svg viewBox="0 0 24 24"><path d="M15 6 9 18"/><path d="M9 6l6 12"/></svg>'
};

const fmt = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short"
});

function formatDate(value) {
  if (!value) return "未知";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : fmt.format(date);
}

function age(value) {
  if (!value) return "未知";
  const ms = Date.now() - new Date(value).getTime();
  if (Number.isNaN(ms)) return "未知";
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} 小时前`;
  return `${Math.round(hours / 24)} 天前`;
}

function healthClass(ok) {
  return ok ? "ok" : "warn";
}

function sourceLink(url, label = "source") {
  return `<a href="${url}" target="_blank" rel="noreferrer">${label}</a>`;
}

function metricCard(label, value, detail, icon) {
  return `
    <article class="metric">
      <div class="metric-icon">${icons[icon]}</div>
      <div>
        <span>${label}</span>
        <strong>${value}</strong>
        <p>${detail}</p>
      </div>
    </article>
  `;
}

function chromeRows(rows) {
  return rows
    .map(
      (row) => `
        <tr>
          <td><strong>${row.platform}</strong></td>
          <td><span class="chip stable">${row.channel}</span></td>
          <td class="mono">${row.version}</td>
          <td>${row.milestone ? `M${row.milestone}` : "未知"}</td>
          <td>${row.corroboratedByVersionHistory ? "已交叉校验" : "Dash 优先"}</td>
          <td>${sourceLink(row.sourceUrl, "Chromium Dash")}</td>
        </tr>
      `
    )
    .join("");
}

function chromeOsRows(rows) {
  return rows
    .map(
      (row) => `
        <tr>
          <td><strong>${row.board}</strong><small>${row.brand}</small></td>
          <td>${row.formFactor}</td>
          <td class="mono">${row.osVersion}</td>
          <td class="mono">${row.chromeVersion}</td>
          <td><span class="chip ${row.aue ? "muted" : "ok"}">${row.aue ? "AUE" : "Active"}</span></td>
        </tr>
      `
    )
    .join("");
}

function sdkRows(rows) {
  return rows
    .map(
      (row) => `
        <tr>
          <td><strong>${row.displayName}</strong><small>${row.path}</small></td>
          <td class="mono">${row.revision}</td>
          <td><span class="chip ${row.channel === "Stable" ? "stable" : "beta"}">${row.channel}</span></td>
          <td>${sourceLink(row.sourceUrl, "repository2-1.xml")}</td>
        </tr>
      `
    )
    .join("");
}

function securityRows(rows) {
  return rows
    .map(
      (row) => `
        <tr>
          <td><strong>${row.bulletin}</strong></td>
          <td>${row.publishedDate}</td>
          <td>${row.patchLevels.map((level) => `<span class="chip ok">${level}</span>`).join(" ")}</td>
          <td>${sourceLink(row.sourceUrl, "AOSP")}</td>
        </tr>
      `
    )
    .join("");
}

function pageFingerprints(items) {
  return items
    .map(
      (item) => `
        <article class="fingerprint">
          <div>
            <strong>${item.name}</strong>
            <span>${item.lastUpdated ? `Last updated ${item.lastUpdated}` : "监听页面指纹"}</span>
          </div>
          <code>${item.sha256 ?? item.error ?? "unavailable"}</code>
          ${sourceLink(item.url, "open")}
        </article>
      `
    )
    .join("");
}

function feedRows(rows) {
  return rows
    .map(
      (row) => `
        <li>
          <a href="${row.url}" target="_blank" rel="noreferrer">${row.title}</a>
          <span>${formatDate(row.updated)}</span>
        </li>
      `
    )
    .join("");
}

function healthRows(rows) {
  return rows
    .map(
      (row) => `
        <li>
          <span class="dot ${healthClass(row.ok)}"></span>
          <div>
            <strong>${row.name}</strong>
            <small>${row.kind.toUpperCase()} · ${row.message}</small>
          </div>
          ${sourceLink(row.url, "↗")}
        </li>
      `
    )
    .join("");
}

function render(data) {
  document.querySelector("#app").innerHTML = `
    <header class="topbar">
      <a class="brand" href="#">
        <span>${icons.pulse}</span>
        Google Release Radar
      </a>
      <nav>
        <a href="#chrome">Chrome</a>
        <a href="#chromeos">ChromeOS</a>
        <a href="#android">Android</a>
        <a href="#sdk">SDK</a>
      </nav>
      <a class="deploy" href="./data/google-releases.json">${icons.git} data json</a>
    </header>

    <main>
      <section class="intro">
        <div>
          <h1>Google 生态更新源雷达</h1>
          <p>聚合 Chrome、ChromeOS、Pixel/Android 页面、安全公告、SDK 仓库和官方 RSS。静态站点由 GitHub Actions 定时抓取数据并重新部署。</p>
        </div>
        <aside>
          <span>Last generated</span>
          <strong>${formatDate(data.generatedAt)}</strong>
          <p>${age(data.generatedAt)} · ${data.summary.healthySources}/${data.summary.totalSources} sources healthy</p>
        </aside>
      </section>

      <section class="metrics">
        ${metricCard("Chrome Stable", data.summary.latestChrome, "Chromium Dash + VersionHistory 双源", "box")}
        ${metricCard("ChromeOS boards", data.summary.chromeOsBoards, "Serving builds matrix", "pulse")}
        ${metricCard("Android SPL", data.summary.latestAndroidPatch, "Android Security Bulletin", "shield")}
      </section>

      <section class="layout">
        <div class="content">
          <section class="panel" id="chrome">
            <div class="panel-head">
              <div>
                <h2>Chrome Stable</h2>
                <p>Chromium Dash 返回版本、里程碑、分支位置；VersionHistory 用于交叉校验最新版本。</p>
              </div>
            </div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>平台</th><th>通道</th><th>版本</th><th>里程碑</th><th>校验</th><th>源</th></tr></thead>
                <tbody>${chromeRows(data.chrome.rows)}</tbody>
              </table>
            </div>
          </section>

          <section class="panel" id="chromeos">
            <div class="panel-head">
              <div>
                <h2>ChromeOS Serving Builds</h2>
                <p>展示仍在服务的代表性 board，保留 AUE 状态和 Stable/Beta 版本对比。</p>
              </div>
              <span class="count">${data.chromeOs.totalBoards} boards</span>
            </div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Board / 设备</th><th>形态</th><th>OS</th><th>Chrome</th><th>状态</th></tr></thead>
                <tbody>${chromeOsRows(data.chromeOs.rows)}</tbody>
              </table>
            </div>
          </section>

          <section class="panel" id="android">
            <div class="panel-head">
              <div>
                <h2>Pixel / Android</h2>
                <p>Pixel 固件页记录页面指纹，安全公告解析补丁级别。这样能稳定监控页面变化，又不依赖脆弱 DOM。</p>
              </div>
            </div>
            <div class="fingerprints">${pageFingerprints(data.android.pageFingerprints)}</div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>公告</th><th>发布日期</th><th>补丁级别</th><th>源</th></tr></thead>
                <tbody>${securityRows(data.android.securityBulletins)}</tbody>
              </table>
            </div>
          </section>

          <section class="panel" id="sdk">
            <div class="panel-head">
              <div>
                <h2>Android SDK Repository</h2>
                <p>直接解析 Android Studio 使用的官方仓库 XML，覆盖 platform-tools、build-tools、emulator 和最新 platform。</p>
              </div>
            </div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>包</th><th>版本</th><th>通道</th><th>源</th></tr></thead>
                <tbody>${sdkRows(data.sdk.rows)}</tbody>
              </table>
            </div>
          </section>
        </div>

        <aside class="rail">
          <section class="rail-card">
            <h2>Source Health</h2>
            <ul class="health-list">${healthRows(data.health)}</ul>
          </section>
          <section class="rail-card">
            <h2>Release Feeds</h2>
            <ul class="feed-list">${feedRows(data.rss.entries)}</ul>
          </section>
        </aside>
      </section>
    </main>
  `;
}

async function boot() {
  try {
    const response = await fetch(dataUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    render(await response.json());
  } catch (error) {
    document.querySelector("#app").innerHTML = `
      <main class="error-state">
        <h1>数据尚未生成</h1>
        <p>运行 <code>npm run fetch:data</code> 生成 <code>public/data/google-releases.json</code>。</p>
        <pre>${error.message}</pre>
      </main>
    `;
  }
}

boot();
