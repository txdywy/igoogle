import test from "node:test";
import assert from "node:assert/strict";

import { chromeRows, feedRows } from "../src/main.js";

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
