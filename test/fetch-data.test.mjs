import test from "node:test";
import assert from "node:assert/strict";

import {
  extractFeedEntries,
  extractSecurityBulletins,
  extractSdkPackages,
  pickChromeOsRows
} from "../scripts/fetch-data.mjs";

test("extractFeedEntries chooses alternate article links before feed links", () => {
  const entries = extractFeedEntries(
    `
      <feed>
        <entry>
          <title>Stable Channel Update</title>
          <link href="https://chromereleases.googleblog.com/feeds/123/comments/default" rel="replies" />
          <link type="text/html" href="https://chromereleases.googleblog.com/2026/04/stable-channel-update.html" rel="alternate" />
          <updated>2026-04-30T10:00:00Z</updated>
        </entry>
      </feed>
    `,
    "https://chromereleases.googleblog.com/feeds/posts/default"
  );

  assert.equal(entries[0].url, "https://chromereleases.googleblog.com/2026/04/stable-channel-update.html");
});

test("extractFeedEntries caps at 8 entries", () => {
  const blocks = Array.from({ length: 12 }, (_, i) =>
    `<entry><title>T${i}</title><updated>2026-01-01T00:00:00Z</updated><link href="https://example.com/${i}" /></entry>`
  ).join("");
  const entries = extractFeedEntries(`<feed>${blocks}</feed>`, "https://example.com");
  assert.equal(entries.length, 8);
});

test("extractFeedEntries falls back to published when updated is missing", () => {
  const entries = extractFeedEntries(
    `<feed><entry><title>T</title><published>2026-03-15T12:00:00Z</published><link href="https://example.com" /></entry></feed>`,
    "https://example.com"
  );
  assert.equal(entries[0].updated, "2026-03-15T12:00:00Z");
});

// --- extractSecurityBulletins ---

test("extractSecurityBulletins parses valid bulletin rows", () => {
  const html = `
    <table>
      <tr>
        <td>May 2026</td>
        <td>2026-05-01</td>
        <td>2026-05-01</td>
        <td>2026-05-05, 2026-05-01</td>
      </tr>
    </table>
  `;
  const rows = extractSecurityBulletins(html);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].bulletin, "May 2026");
  assert.deepEqual(rows[0].patchLevels, ["2026-05-05", "2026-05-01"]);
});

test("extractSecurityBulletins skips rows with fewer than 4 cells", () => {
  const html = `<table><tr><td>Only</td><td>Two</td></tr></table>`;
  assert.deepEqual(extractSecurityBulletins(html), []);
});

test("extractSecurityBulletins skips rows that don't match bulletin pattern", () => {
  const html = `<table><tr><td>not-a-bulletin</td><td>d</td><td>e</td><td>2026-05-01</td></tr></table>`;
  assert.deepEqual(extractSecurityBulletins(html), []);
});

test("extractSecurityBulletins caps at 8 rows", () => {
  const rows = Array.from({ length: 12 }, (_, i) => {
    const month = String((i % 12) + 1).padStart(2, "0");
    return `<tr><td>Month${i} 2026</td><td>d</td><td>e</td><td>2026-${month}-01</td></tr>`;
  }).join("");
  const result = extractSecurityBulletins(`<table>${rows}</table>`);
  assert.ok(result.length <= 8);
});

// --- extractSdkPackages ---

test("extractSdkPackages parses platform-tools package", () => {
  const xml = `
    <sdk:sdk-repository>
      <remotePackage path="platform-tools">
        <display-name>Android SDK Platform-Tools</display-name>
        <revision><major>35</major><minor>0</minor><micro>2</micro></revision>
        <channelRef ref="channel-0" />
      </remotePackage>
    </sdk:sdk-repository>
  `;
  const rows = extractSdkPackages(xml);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].path, "platform-tools");
  assert.equal(rows[0].displayName, "Android SDK Platform-Tools");
  assert.equal(rows[0].revision, "35.0.2");
  assert.equal(rows[0].channel, "Stable");
});

test("extractSdkPackages filters to target packages only", () => {
  const xml = `
    <remotePackage path="some-random-package">
      <display-name>Random</display-name>
      <revision><major>1</major></revision>
      <channelRef ref="channel-0" />
    </remotePackage>
    <remotePackage path="platform-tools">
      <display-name>Platform-Tools</display-name>
      <revision><major>35</major></revision>
      <channelRef ref="channel-0" />
    </remotePackage>
  `;
  const rows = extractSdkPackages(xml);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].path, "platform-tools");
});

test("extractSdkPackages caps at 16 rows", () => {
  const packages = Array.from({ length: 20 }, (_, i) =>
    `<remotePackage path="build-tools;${30 + i}">
      <display-name>Build-Tools ${30 + i}</display-name>
      <revision><major>${30 + i}</major></revision>
      <channelRef ref="channel-0" />
    </remotePackage>`
  ).join("");
  const rows = extractSdkPackages(packages);
  assert.ok(rows.length <= 16);
});

// --- pickChromeOsRows ---

test("pickChromeOsRows filters boards with servingStable", () => {
  const builds = {
    "board-a": { servingStable: { version: "1.0", chromeVersion: "120" }, brandNames: ["BrandA"] },
    "board-b": { brandNames: ["BrandB"] }
  };
  const rows = pickChromeOsRows(builds);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].board, "board-a");
});

test("pickChromeOsRows marks AUE boards", () => {
  const builds = {
    "active-board": { servingStable: { version: "1.0", chromeVersion: "120" }, isAue: false },
    "aue-board": { servingStable: { version: "0.9", chromeVersion: "118" }, isAue: true }
  };
  const rows = pickChromeOsRows(builds);
  assert.equal(rows[0].board, "active-board");
  assert.equal(rows[0].aue, false);
  assert.equal(rows[1].aue, true);
});

test("pickChromeOsRows caps at 18 rows", () => {
  const builds = Object.fromEntries(
    Array.from({ length: 25 }, (_, i) => [
      `board-${i}`,
      { servingStable: { version: "1.0", chromeVersion: String(120 - i) } }
    ])
  );
  assert.ok(pickChromeOsRows(builds).length <= 18);
});
