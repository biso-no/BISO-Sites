import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) =>
  readFileSync(join(import.meta.dir, path), "utf8");

describe("consent bar answer", () => {
  // `chooseReplayConsent` applies a "no" before saving it (tested in
  // @repo/observability), so a failed save still stops recording.
  test("is saved and applied through chooseReplayConsent", () => {
    expect(read("replay-consent.tsx")).toContain(
      'chooseReplayConsent("admin", choice, setReplayConsent)'
    );
  });
});

describe("consent bar in the admin shell", () => {
  test("the wrapper skips body padding", () => {
    expect(read("replay-consent.tsx")).toContain("reserveBodySpace={false}");
  });

  test("the inner scroller reserves the bar height", () => {
    expect(read("../app/(portal)/_components/admin-shell.tsx")).toContain(
      "pb-[var(--replay-consent-bar-height,0px)]"
    );
  });
});
