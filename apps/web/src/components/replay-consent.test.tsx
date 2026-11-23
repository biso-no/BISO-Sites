import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeOnly } from "@/test/source";

const read = (f: string) =>
  codeOnly(readFileSync(join(import.meta.dirname, f), "utf8"));

describe("ReplayConsent", () => {
  // `chooseReplayConsent` applies a "no" before saving it (tested in
  // @repo/observability), so a failed save still stops recording.
  it("saves and applies the answer through chooseReplayConsent", () => {
    expect(read("replay-consent.tsx")).toContain(
      'chooseReplayConsent("web", choice, setReplayConsent)'
    );
  });
});
