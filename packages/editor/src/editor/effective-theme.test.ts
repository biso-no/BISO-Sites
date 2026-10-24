import { describe, expect, test } from "bun:test";
import {
  canvasThemeStyle,
  effectiveTheme,
  guardPublish,
  themeBlocksSave,
} from "./effective-theme";
import { withPublishStatusSync } from "./publish-status";
import type { EditorDepartment, PageMeta } from "./types";

const BLOCKED_PUBLISH = /contrast/;

const purple = { dark: "#2a0a4a", accent: "#fecd45" };
const green = { dark: "#0a3a1a", accent: "#7be495" };

const departments: EditorDepartment[] = [
  { campusId: "1", id: "d-1", name: "One", theme: purple },
  { campusId: "1", id: "d-2", name: "Two", theme: null },
];

const meta = (patch: Partial<PageMeta>): PageMeta => ({
  department: "d-1",
  slug: "s",
  status: "draft",
  title: "T",
  ...patch,
});

describe("effectiveTheme", () => {
  test("the page's own theme wins", () => {
    expect(effectiveTheme(meta({ theme: green }), departments)).toEqual(green);
  });

  test("an explicit null beats the department theme", () => {
    expect(effectiveTheme(meta({ theme: null }), departments)).toBeNull();
  });

  test("absent follows the department", () => {
    expect(effectiveTheme(meta({}), departments)).toEqual(purple);
  });

  test("no matching department gives null", () => {
    expect(effectiveTheme(meta({ department: "zzz" }), departments)).toBeNull();
    expect(effectiveTheme(meta({ department: "d-2" }), departments)).toBeNull();
  });
});

describe("themeBlocksSave", () => {
  test("is false for absent, null and a passing theme", () => {
    expect(themeBlocksSave(meta({}))).toBe(false);
    expect(themeBlocksSave(meta({ theme: null }))).toBe(false);
    expect(themeBlocksSave(meta({ theme: purple }))).toBe(false);
  });

  test("is true for a theme that fails contrast", () => {
    expect(
      themeBlocksSave(meta({ theme: { dark: "#9b5de5", accent: "#fecd45" } }))
    ).toBe(true);
  });
});

describe("canvasThemeStyle", () => {
  test("null, BISO and bad hex give nothing", () => {
    expect(canvasThemeStyle(null)).toBeUndefined();
    expect(
      canvasThemeStyle({ dark: "#001A35", accent: "#3AA3E1" })
    ).toBeUndefined();
    expect(
      canvasThemeStyle({ dark: "#fff;}body{", accent: "#fecd45" })
    ).toBeUndefined();
  });

  test("a failing but valid theme still paints", () => {
    expect(
      canvasThemeStyle({ dark: "#9b5de5", accent: "#fecd45" })?.["--biso-deep"]
    ).toBe("#9b5de5");
  });
});

describe("guardPublish", () => {
  test("rejects without calling the handler while blocked, calls it otherwise", async () => {
    let calls = 0;
    const publish = () => {
      calls += 1;
      return Promise.resolve();
    };
    const bad = meta({ theme: { dark: "#9b5de5", accent: "#fecd45" } });
    // Rejecting matters: the shell marks the page published when the
    // publish resolves, so a resolved no-op would claim a publish that never
    // happened.
    await expect(guardPublish(publish, () => bad)?.()).rejects.toThrow(
      BLOCKED_PUBLISH
    );
    expect(calls).toBe(0);
    await guardPublish(publish, () => meta({}))?.();
    expect(calls).toBe(1);
    expect(guardPublish(undefined, () => bad)).toBeUndefined();
  });

  test("a blocked publish never reaches the published status", async () => {
    const statuses: string[] = [];
    const bad = meta({ theme: { dark: "#9b5de5", accent: "#fecd45" } });
    const callbacks = withPublishStatusSync(
      {
        onPublish: guardPublish(
          () => Promise.resolve(undefined),
          () => bad
        ),
      },
      (status) => statuses.push(status)
    );
    await expect(callbacks.onPublish?.("no")).rejects.toThrow();
    expect(statuses).toEqual([]);
  });
});
