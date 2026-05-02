import test from "node:test";
import assert from "node:assert/strict";

import { extractFeedEntries } from "../scripts/fetch-data.mjs";

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
