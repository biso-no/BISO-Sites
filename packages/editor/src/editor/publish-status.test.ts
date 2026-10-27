import { describe, expect, test } from "bun:test";
import { withPublishStatusSync } from "./publish-status";

const resolved = () => Promise.resolve(undefined);

describe("withPublishStatusSync", () => {
  test("marks the document published once the host has published it", async () => {
    // After publishing, the host updated only its own copy of the document.
    // The editor's store kept `status: "draft"`, so the next autosave wrote
    // the page back to draft and took it off the site.
    const statuses: string[] = [];
    const callbacks = withPublishStatusSync(
      { onPublish: resolved, onUnpublish: resolved },
      (status) => statuses.push(status)
    );

    await callbacks.onPublish?.("no");
    await callbacks.onUnpublish?.("no");

    expect(statuses).toEqual(["published", "draft"]);
  });

  test("leaves the status alone when the host failed", async () => {
    const statuses: string[] = [];
    const callbacks = withPublishStatusSync(
      {
        onPublish: () => Promise.reject(new Error("publish failed")),
      },
      (status) => statuses.push(status)
    );

    await expect(callbacks.onPublish?.("no")).rejects.toThrow("publish failed");
    expect(statuses).toEqual([]);
  });

  test("tells the shell when the host copied the page's theme to its department", async () => {
    const events: string[] = [];
    const copied = withPublishStatusSync(
      { onPublish: () => Promise.resolve({ themeCopied: true }) },
      (status) => events.push(status),
      () => events.push("theme copied")
    );
    await copied.onPublish?.("no");
    expect(events).toEqual(["published", "theme copied"]);

    events.length = 0;
    const kept = withPublishStatusSync(
      { onPublish: () => Promise.resolve({ themeCopied: false }) },
      (status) => events.push(status),
      () => events.push("theme copied")
    );
    await kept.onPublish?.("no");
    await withPublishStatusSync(
      { onPublish: resolved },
      (status) => events.push(status),
      () => events.push("theme copied")
    ).onPublish?.("no");
    expect(events).toEqual(["published", "published"]);
  });

  test("passes through a host that cannot publish", () => {
    const callbacks = withPublishStatusSync({}, () => undefined);
    expect(callbacks.onPublish).toBeUndefined();
    expect(callbacks.onUnpublish).toBeUndefined();
  });
});
