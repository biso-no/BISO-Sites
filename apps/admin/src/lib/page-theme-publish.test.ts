import { describe, expect, test } from "bun:test";
import { departmentThemeUpdate, themeSaveError } from "./page-theme-publish";

const CONTRAST = /contrast/i;

describe("departmentThemeUpdate", () => {
  test("skips when the page carries no theme", () => {
    expect(departmentThemeUpdate({ theme: undefined })).toBe("skip");
    expect(departmentThemeUpdate({})).toBe("skip");
  });

  test("resets the department for null", () => {
    expect(departmentThemeUpdate({ theme: null })).toEqual({
      theme_accent: null,
      theme_dark: null,
    });
  });

  test("returns the lowercase hex pair for a passing theme", () => {
    expect(
      departmentThemeUpdate({ theme: { accent: "#C8A2F0", dark: "#3B1C6B" } })
    ).toEqual({ theme_accent: "#c8a2f0", theme_dark: "#3b1c6b" });
  });

  test("is invalid for a failing or malformed theme", () => {
    expect(
      departmentThemeUpdate({ theme: { accent: "#3aa3e1", dark: "#9b5de5" } })
    ).toBe("invalid");
    expect(
      departmentThemeUpdate({
        theme: { accent: "red", dark: "#fff;}body{display:none" },
      })
    ).toBe("invalid");
  });
});

describe("themeSaveError", () => {
  test("accepts absent, null and passing themes", () => {
    expect(themeSaveError({})).toBeNull();
    expect(themeSaveError({ theme: null })).toBeNull();
    expect(
      themeSaveError({ theme: { accent: "#c8a2f0", dark: "#3b1c6b" } })
    ).toBeNull();
  });

  test("rejects failing and malformed themes with a contrast sentence", () => {
    expect(
      themeSaveError({ theme: { accent: "#3aa3e1", dark: "#9b5de5" } })
    ).toMatch(CONTRAST);
    expect(themeSaveError({ theme: 5 as never })).toMatch(CONTRAST);
  });
});
