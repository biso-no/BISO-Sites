import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { resolvePageTheme } from "./page-theme";

const PURPLE = { dark: "#3b1c6b", accent: "#c8a2f0" };
const GREEN = { dark: "#0b3d2e", accent: "#8fe3b5" };
const deptOf = (t: { dark: string; accent: string }) => ({
  theme_dark: t.dark,
  theme_accent: t.accent,
});

describe("resolvePageTheme", () => {
  it("a department theme beats a doc theme", () => {
    expect(
      resolvePageTheme({ departmentTheme: deptOf(PURPLE), docTheme: GREEN })
    ).toEqual(PURPLE);
  });

  it("without a department the doc theme is used", () => {
    expect(
      resolvePageTheme({ departmentTheme: null, docTheme: PURPLE })
    ).toEqual(PURPLE);
  });

  it("a bound department with no theme renders BISO, not the doc theme", () => {
    expect(
      resolvePageTheme({
        departmentTheme: { theme_dark: null, theme_accent: null },
        docTheme: GREEN,
      })
    ).toBeNull();
  });

  it("a failing department pair gives null", () => {
    expect(
      resolvePageTheme({
        departmentTheme: { theme_dark: "#9b5de5", theme_accent: "#c8a2f0" },
        docTheme: GREEN,
      })
    ).toBeNull();
  });

  it("a hostile string in either source gives null", () => {
    const hostile = "#fff;}body{display:none";
    expect(
      resolvePageTheme({
        departmentTheme: { theme_dark: hostile, theme_accent: "#c8a2f0" },
        docTheme: null,
      })
    ).toBeNull();
    expect(
      resolvePageTheme({
        departmentTheme: null,
        docTheme: { dark: "#3b1c6b", accent: hostile },
      })
    ).toBeNull();
  });

  it("BISO's own colours apply no override", () => {
    expect(
      resolvePageTheme({
        departmentTheme: null,
        docTheme: { dark: "#001A35", accent: "#3AA3E1" },
      })
    ).toBeNull();
    expect(
      resolvePageTheme({
        departmentTheme: { theme_dark: "#001a35", theme_accent: "#3aa3e1" },
        docTheme: null,
      })
    ).toBeNull();
  });

  it("null and undefined doc themes give null", () => {
    expect(resolvePageTheme({ departmentTheme: null, docTheme: null })).toBe(
      null
    );
    expect(
      resolvePageTheme({ departmentTheme: null, docTheme: undefined })
    ).toBe(null);
  });
});
