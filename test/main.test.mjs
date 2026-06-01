import test from "node:test";
import assert from "node:assert/strict";

import { chromeRows, feedRows, escapeHtml, safeUrl, formatDate, age } from "../src/main.js";

test("chromeRows escapes data-derived table content", () => {
  const html = chromeRows([
    {
      platform: `<img src=x onerror="alert(1)">`,
      channel: "Stable",
      version: `1.2.3<script>alert(1)</script>`,
      milestone: `123`,
      corroboratedByVersionHistory: true,
      sourceUrl: `javascript:alert(1)`
    }
  ]);

  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /1\.2\.3&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /javascript:alert/);
});

test("feedRows escapes titles and unsafe URLs", () => {
  const html = feedRows([
    {
      title: `<svg onload="alert(1)"></svg>`,
      url: `javascript:alert(1)`,
      updated: "2026-04-30T10:00:00Z"
    }
  ]);

  assert.match(html, /&lt;svg onload=&quot;alert\(1\)&quot;&gt;&lt;\/svg&gt;/);
  assert.doesNotMatch(html, /javascript:alert/);
});

test("chromeRows handles missing milestone", () => {
  const html = chromeRows([
    {
      platform: "Windows",
      channel: "Stable",
      version: "120.0.0.0",
      milestone: null,
      corroboratedByVersionHistory: false,
      sourceUrl: "https://example.com"
    }
  ]);

  assert.match(html, /未知/);
});

test("chromeRows shows Dash priority when not corroborated", () => {
  const html = chromeRows([
    {
      platform: "Windows",
      channel: "Stable",
      version: "120.0.0.0",
      milestone: "120",
      corroboratedByVersionHistory: false,
      sourceUrl: "https://example.com"
    }
  ]);

  assert.match(html, /Dash 优先/);
});

test("chromeRows shows corroborated when versions match", () => {
  const html = chromeRows([
    {
      platform: "Windows",
      channel: "Stable",
      version: "120.0.0.0",
      milestone: "120",
      corroboratedByVersionHistory: true,
      sourceUrl: "https://example.com"
    }
  ]);

  assert.match(html, /已交叉校验/);
});

test("feedRows handles empty array", () => {
  const html = feedRows([]);
  assert.equal(html, "");
});

test("feedRows handles multiple entries", () => {
  const html = feedRows([
    { title: "Entry 1", url: "https://example.com/1", updated: "2026-01-01T00:00:00Z" },
    { title: "Entry 2", url: "https://example.com/2", updated: "2026-01-02T00:00:00Z" }
  ]);

  assert.match(html, /Entry 1/);
  assert.match(html, /Entry 2/);
});

// --- escapeHtml ---

test("escapeHtml handles all special characters", () => {
  assert.equal(escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
});

test("escapeHtml handles null and undefined", () => {
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
});

test("escapeHtml coerces numbers to string", () => {
  assert.equal(escapeHtml(42), "42");
});

test("escapeHtml handles empty string", () => {
  assert.equal(escapeHtml(""), "");
});

test("escapeHtml handles boolean values", () => {
  assert.equal(escapeHtml(true), "true");
  assert.equal(escapeHtml(false), "false");
});

// --- safeUrl ---

test("safeUrl allows https URLs", () => {
  assert.equal(safeUrl("https://example.com"), "https://example.com/");
});

test("safeUrl allows http URLs", () => {
  assert.match(safeUrl("http://example.com"), /^http:\/\/example\.com/);
});

test("safeUrl blocks javascript: URIs", () => {
  assert.equal(safeUrl("javascript:alert(1)"), "#");
});

test("safeUrl blocks data: URIs", () => {
  assert.equal(safeUrl("data:text/html,<script>alert(1)</script>"), "#");
});

test("safeUrl resolves relative paths against base", () => {
  const result = safeUrl("not a url");
  assert.match(result, /^https:\/\/example\.invalid\//);
});

test("safeUrl resolves empty string against base", () => {
  const result = safeUrl("");
  assert.match(result, /^https:\/\/example\.invalid\//);
});

test("safeUrl blocks vbscript: URIs", () => {
  assert.equal(safeUrl("vbscript:alert(1)"), "#");
});

test("safeUrl handles URLs with special characters", () => {
  const result = safeUrl("https://example.com/path?q=hello&lang=zh");
  assert.match(result, /example\.com/);
});

// --- formatDate ---

test("formatDate returns Chinese locale date", () => {
  const result = formatDate("2026-04-30T10:00:00Z");
  assert.match(result, /2026/);
  assert.match(result, /4/);
});

test("formatDate returns fallback for null", () => {
  assert.equal(formatDate(null), "未知");
});

test("formatDate returns fallback for invalid date string", () => {
  assert.equal(formatDate("not-a-date"), "not-a-date");
});

test("formatDate handles undefined", () => {
  assert.equal(formatDate(undefined), "未知");
});

test("formatDate handles empty string", () => {
  assert.equal(formatDate(""), "未知");
});

// --- age ---

test("age returns minutes for recent timestamps", () => {
  const recent = new Date(Date.now() - 120_000).toISOString();
  assert.match(age(recent), /分钟前/);
});

test("age returns hours for timestamps hours ago", () => {
  const hoursAgo = new Date(Date.now() - 7_200_000).toISOString();
  assert.match(age(hoursAgo), /小时前/);
});

test("age returns days for timestamps days ago", () => {
  const daysAgo = new Date(Date.now() - 172_800_000).toISOString();
  assert.match(age(daysAgo), /天前/);
});

test("age returns fallback for null", () => {
  assert.equal(age(null), "未知");
});

test("age returns fallback for invalid date", () => {
  assert.equal(age("not-a-date"), "未知");
});

test("age returns fallback for undefined", () => {
  assert.equal(age(undefined), "未知");
});

test("age handles very recent timestamps", () => {
  const veryRecent = new Date(Date.now() - 1000).toISOString();
  assert.match(age(veryRecent), /分钟前/);
});

test("age handles timestamps exactly 1 hour ago", () => {
  const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const result = age(oneHourAgo);
  assert.match(result, /小时前/);
});

test("age handles timestamps exactly 1 day ago", () => {
  const oneDayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const result = age(oneDayAgo);
  assert.match(result, /小时前|天前/);
});
