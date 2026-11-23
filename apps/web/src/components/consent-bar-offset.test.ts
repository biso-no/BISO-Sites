import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (f: string) => readFileSync(join(import.meta.dirname, f), "utf8");

describe("bottom-fixed UI sits above the consent bar", () => {
  it.each([
    "layout/mobile-app-banner.tsx",
    "onboarding/onboarding-popout.tsx",
  ])("%s offsets its bottom by the bar height", (file) => {
    expect(read(file)).toContain(
      "bottom-[calc(var(--replay-consent-bar-height,0px)+"
    );
  });
});
