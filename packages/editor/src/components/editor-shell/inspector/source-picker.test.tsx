import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  type EditorCallbacks,
  EditorCallbacksContext,
} from "@/editor/callbacks";
import { SourcePicker } from "./source-picker";

const CALLBACKS: EditorCallbacks = {
  activeLocale: "no",
  campuses: [
    { id: "oslo", name: "Oslo" },
    { id: "bergen", name: "Bergen" },
  ],
  departments: [
    { campusId: "oslo", id: "d1", name: "Marketing" },
    { campusId: "bergen", id: "d3", name: "Bergen Events" },
    { campusId: null, id: "d2", name: "Events" },
  ],
  locales: [],
  onLocaleChange: () => undefined,
  savePage: async () => undefined,
  uploadFile: async () => ({ fileId: "", url: "" }),
};

const SELECTED_D2 =
  /<option[^>]*value="d2"[^>]*selected|<option[^>]*selected[^>]*value="d2"/;

const render = (value: string, pageCampus?: string) =>
  renderToStaticMarkup(
    createElement(
      EditorCallbacksContext.Provider,
      { value: CALLBACKS },
      createElement(SourcePicker, {
        onChange: () => undefined,
        pageCampus,
        value,
      })
    )
  );

describe("SourcePicker", () => {
  test("lists the page department and every department from callbacks", () => {
    const out = render("auto");
    expect(out).toContain("This page&#x27;s department");
    expect(out).toContain('value="auto"');
    expect(out).toContain('value="d1"');
    expect(out).toContain("Marketing");
    expect(out).toContain('value="d2"');
    expect(out).toContain("Events");
  });

  test("selects the current value", () => {
    expect(render("d2")).toMatch(SELECTED_D2);
  });

  test("keeps a department that is no longer listed", () => {
    expect(render("gone")).toContain('value="gone"');
  });
});

describe("SourcePicker grouping", () => {
  test("groups by campus and puts the page's campus first", () => {
    const out = render("auto", "bergen");
    expect(out).toContain('<optgroup label="Bergen">');
    expect(out).toContain('<optgroup label="Oslo">');
    expect(out).toContain('<optgroup label="Other">');
    expect(out.indexOf('label="Bergen"')).toBeLessThan(
      out.indexOf('label="Oslo"')
    );
  });
});
