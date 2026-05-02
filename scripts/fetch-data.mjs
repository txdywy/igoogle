import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

const OUT = new URL("../public/data/google-releases.json", import.meta.url);
const timeoutMs = 25_000;

const sources = {
  chromiumDash:
    "https://chromiumdash.appspot.com/fetch_releases?channel=Stable&num=8&platform=",
  chromeVersionHistory:
    "https://versionhistory.googleapis.com/v1/chrome/platforms/{platform}/channels/stable/versions",
  chromeOsServing: "https://chromiumdash.appspot.com/cros/fetch_serving_builds",
  androidOta: "https://developers.google.com/android/ota",
  androidFactoryImages: "https://developers.google.com/android/images",
  androidSecurity:
    "https://source.android.com/docs/security/bulletin/asb-overview?hl=en",
  androidSdkRepository: "https://dl.google.com/android/repository/repository2-1.xml",
  chromeRss: "https://chromereleases.googleblog.com/feeds/posts/default",
  androidDevelopersRss:
    "https://android-developers.googleblog.com/feeds/posts/default"
};

const chromePlatforms = [
  ["win", "Windows", "Windows"],
  ["mac", "Mac", "macOS"],
  ["linux", "Linux", "Linux"],
  ["android", "Android", "Android"],
  ["ios", "iOS", "iOS"]
];

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "google-release-radar/0.1 (+https://github.com/)"
      }
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
    }
    return { ok: true, url, text, status: res.status };
  } catch (error) {
    return { ok: false, url, error: error.message };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url) {
  const result = await fetchText(url);
  if (!result.ok) return result;
  try {
    return { ...result, json: JSON.parse(result.text) };
  } catch (error) {
    return { ok: false, url, error: `Invalid JSON: ${error.message}` };
  }
}

function statusFrom(result, name, kind) {
  return {
    name,
    kind,
    url: result.url,
    ok: result.ok,
    status: result.status ?? null,
    message: result.ok ? "OK" : result.error,
    checkedAt: new Date().toISOString()
  };
}

async function collectChrome() {
  const results = await Promise.all(
    chromePlatforms.map(async ([apiPlatform, dashPlatform, label]) => {
      const dashUrl = `${sources.chromiumDash}${encodeURIComponent(dashPlatform)}`;
      const vhUrl = sources.chromeVersionHistory.replace("{platform}", apiPlatform);
      const [dash, history] = await Promise.all([fetchJson(dashUrl), fetchJson(vhUrl)]);
      const latest = dash.ok ? dash.json?.[0] : null;
      const latestHistory = history.ok ? history.json?.versions?.[0] : null;
      return {
        health: [
          statusFrom(dash, `Chromium Dash ${label}`, "json"),
          statusFrom(history, `VersionHistory ${label}`, "json")
        ],
        row: {
          platform: label,
          channel: "Stable",
          version: latest?.version ?? latestHistory?.version ?? "unknown",
          previousVersion: latest?.previous_version ?? null,
          milestone: latest?.milestone ?? null,
          branchPosition: latest?.chromium_main_branch_position ?? null,
          publishedAt: latest?.time ? new Date(latest.time).toISOString() : null,
          corroboratedByVersionHistory:
            Boolean(latest?.version && latestHistory?.version) &&
            latest.version === latestHistory.version,
          sourceUrl: dashUrl
        }
      };
    })
  );
  return {
    rows: results.map((r) => r.row),
    health: results.flatMap((r) => r.health)
  };
}

export function pickChromeOsRows(builds) {
  return Object.entries(builds ?? {})
    .filter(([, item]) => item.servingStable?.version)
    .map(([board, item]) => ({
      board,
      brand: item.brandNames?.[0] ?? board,
      formFactor:
        Object.values(item.brandNameToFormattedDeviceMap ?? {})[0]?.formFactor ??
        "ChromeOS device",
      aue: Boolean(item.isAue),
      milestone: item.fsiMilestoneNumber ?? null,
      chromeVersion: item.servingStable?.chromeVersion ?? null,
      osVersion: item.servingStable?.version ?? null,
      betaVersion: item.servingBeta?.version ?? null
    }))
    .sort((a, b) => {
      if (a.aue !== b.aue) return Number(a.aue) - Number(b.aue);
      return (b.chromeVersion ?? "").localeCompare(a.chromeVersion ?? "");
    })
    .slice(0, 18);
}

async function collectChromeOs() {
  const result = await fetchJson(sources.chromeOsServing);
  return {
    rows: result.ok ? pickChromeOsRows(result.json?.builds) : [],
    totalBoards: result.ok ? Object.keys(result.json?.builds ?? {}).length : 0,
    health: [statusFrom(result, "ChromeOS serving builds", "json")]
  };
}

function extractMeta(html) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const updated =
    html.match(/Last updated\s+([0-9-]+)\s+UTC/i)?.[1] ??
    html.match(/Last updated\s+([^<.]+)\.?/i)?.[1]?.trim() ??
    null;
  return {
    title: title.replace(/\s+/g, " ").trim(),
    lastUpdated: updated,
    sha256: createHash("sha256").update(html).digest("hex").slice(0, 16),
    bytes: html.length
  };
}

function stripHtmlText(value) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function extractSecurityBulletins(html) {
  const rows = [];
  const rowPattern = /<tr>([\s\S]*?)<\/tr>/g;
  for (const match of html.matchAll(rowPattern)) {
    const cells = [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(
      (cell) => cell[1]
    );
    if (cells.length < 4) continue;
    const bulletin = stripHtmlText(cells[0]);
    const publishedDate = stripHtmlText(cells[2]);
    const patchLevels = [
      ...cells[3].matchAll(/\b20\d{2}-\d{2}-\d{2}\b/g)
    ].map((level) => level[0]);
    if (!/^[A-Z][a-z]+ 20\d{2}$/.test(bulletin) || patchLevels.length === 0) {
      continue;
    }
    rows.push({
      bulletin,
      publishedDate,
      patchLevels,
      sourceUrl: sources.androidSecurity
    });
    if (rows.length >= 8) break;
  }
  return rows;
}

async function collectAndroidPages() {
  const [ota, images, security] = await Promise.all([
    fetchText(sources.androidOta),
    fetchText(sources.androidFactoryImages),
    fetchText(sources.androidSecurity)
  ]);
  return {
    pageFingerprints: [
      {
        name: "Pixel OTA images",
        url: sources.androidOta,
        ...(ota.ok ? extractMeta(ota.text) : { error: ota.error })
      },
      {
        name: "Pixel factory images",
        url: sources.androidFactoryImages,
        ...(images.ok ? extractMeta(images.text) : { error: images.error })
      }
    ],
    securityBulletins: security.ok ? extractSecurityBulletins(security.text) : [],
    health: [
      statusFrom(ota, "Pixel OTA page", "html"),
      statusFrom(images, "Pixel factory images page", "html"),
      statusFrom(security, "Android Security Bulletin", "html")
    ]
  };
}

function tagAttributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)=(["'])(.*?)\2/g)].map((match) => [match[1], match[3]])
  );
}

function entryLink(block, sourceUrl) {
  const links = [...block.matchAll(/<link\b[^>]*>/g)].map((match) => tagAttributes(match[0]));
  const alternate = links.find(
    (link) => link.rel === "alternate" && (!link.type || link.type === "text/html") && link.href
  );
  return alternate?.href ?? links.find((link) => link.href)?.href ?? sourceUrl;
}

function sdkPackagePriority(row) {
  if (row.path === "platform-tools") return 0;
  if (row.path === "cmdline-tools;latest") return 1;
  if (row.path === "emulator") return 2;
  if (row.path.startsWith("platforms;")) return 3;
  if (row.path.startsWith("build-tools;")) return 4;
  return 9;
}

function sdkPackageNumber(row) {
  return Number(row.path.match(/(?:android-|build-tools;)(\d+)/)?.[1] ?? -1);
}

function revision(block) {
  const parts = ["major", "minor", "micro", "preview"]
    .map((key) => block.match(new RegExp(`<${key}>([^<]+)</${key}>`))?.[1])
    .filter(Boolean);
  return parts.join(".") || "unknown";
}

export function extractSdkPackages(xml) {
  const targets = [
    /^platform-tools$/,
    /^cmdline-tools;latest$/,
    /^build-tools;\d/,
    /^platforms;android-\d+$/,
    /^emulator$/
  ];
  const rows = [];
  const packagePattern =
    /<remotePackage path="([^"]+)">([\s\S]*?)<\/remotePackage>/g;
  for (const match of xml.matchAll(packagePattern)) {
    const path = match[1];
    if (!targets.some((target) => target.test(path))) continue;
    const block = match[2];
    rows.push({
      path,
      displayName:
        block.match(/<display-name>([^<]+)<\/display-name>/)?.[1] ?? path,
      revision: revision(block),
      channel:
        block.match(/<channelRef ref="channel-(\d+)"/)?.[1] === "0"
          ? "Stable"
          : "Preview",
      sourceUrl: sources.androidSdkRepository
    });
  }
  return rows
    .sort((a, b) => {
      const priorityA = sdkPackagePriority(a);
      const priorityB = sdkPackagePriority(b);
      if (priorityA !== priorityB) return priorityA - priorityB;
      if (a.path.startsWith("platforms;") || a.path.startsWith("build-tools;")) {
        return sdkPackageNumber(b) - sdkPackageNumber(a);
      }
      return b.revision.localeCompare(a.revision, undefined, { numeric: true });
    })
    .slice(0, 16);
}

async function collectSdk() {
  const result = await fetchText(sources.androidSdkRepository);
  return {
    rows: result.ok ? extractSdkPackages(result.text) : [],
    health: [statusFrom(result, "Android SDK repository XML", "xml")]
  };
}

export function extractFeedEntries(xml, sourceUrl) {
  const entries = [];
  for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const block = match[1];
    entries.push({
      title:
        block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]?.trim() ??
        "Untitled",
      updated:
        block.match(/<updated>([^<]+)<\/updated>/)?.[1] ??
        block.match(/<published>([^<]+)<\/published>/)?.[1] ??
        null,
      url: entryLink(block, sourceUrl),
      sourceUrl
    });
    if (entries.length >= 8) break;
  }
  return entries;
}

async function collectRss() {
  const [chrome, android] = await Promise.all([
    fetchText(sources.chromeRss),
    fetchText(sources.androidDevelopersRss)
  ]);
  return {
    entries: [
      ...(chrome.ok ? extractFeedEntries(chrome.text, sources.chromeRss) : []),
      ...(android.ok
        ? extractFeedEntries(android.text, sources.androidDevelopersRss)
        : [])
    ]
      .sort((a, b) => new Date(b.updated ?? 0) - new Date(a.updated ?? 0))
      .slice(0, 12),
    health: [
      statusFrom(chrome, "Chrome Releases RSS", "atom"),
      statusFrom(android, "Android Developers RSS", "atom")
    ]
  };
}

async function main() {
  const [chrome, chromeOs, android, sdk, rss] = await Promise.all([
    collectChrome(),
    collectChromeOs(),
    collectAndroidPages(),
    collectSdk(),
    collectRss()
  ]);

  const health = [
    ...chrome.health,
    ...chromeOs.health,
    ...android.health,
    ...sdk.health,
    ...rss.health
  ];

  const payload = {
    generatedAt: new Date().toISOString(),
    summary: {
      healthySources: health.filter((item) => item.ok).length,
      totalSources: health.length,
      chromeStablePlatforms: chrome.rows.length,
      chromeOsBoards: chromeOs.totalBoards,
      latestChrome:
        chrome.rows.find((row) => row.platform === "Windows")?.version ??
        chrome.rows[0]?.version ??
        "unknown",
      latestAndroidPatch:
        android.securityBulletins[0]?.patchLevels?.at(-1) ?? "unknown"
    },
    sources,
    chrome,
    chromeOs,
    android,
    sdk,
    rss,
    health
  };

  await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${OUT.pathname}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
