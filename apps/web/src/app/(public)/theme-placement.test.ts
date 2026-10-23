import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP = path.resolve(import.meta.dirname, "..");

describe("theme placement", () => {
  it.each([
    "layout.tsx",
    "(public)/layout.tsx",
  ])("%s never renders PageThemeStyle, so a theme cannot outlive its page", (file) => {
    const source = readFileSync(path.join(APP, file), "utf8");
    expect(source).not.toContain("PageThemeStyle");
    expect(source).not.toContain("page-theme-style");
  });
});
