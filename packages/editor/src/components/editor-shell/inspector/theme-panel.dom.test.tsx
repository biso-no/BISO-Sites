import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "bun:test";
import {
  BISO_THEME,
  contrastRatio,
  type PageTheme,
} from "@repo/shared/utils/page-theme";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { EditorCallbacks } from "@/editor/callbacks";
import { EditorCallbacksContext } from "@/editor/callbacks";
import { canvasThemeStyle, effectiveTheme } from "@/editor/effective-theme";
import { useEditorStore } from "@/editor/store";
import type { EditorDepartment, PageDoc } from "@/editor/types";
import { autosaveSignature } from "../autosave-signature";
import { click, fire, installDom, typeInto } from "./test-events";
import { ThemePanel } from "./theme-panel";

const USE_BUTTON = /^Use #/;
const RATIO_OK = /✓ \d+\.\d : 1/;

let restore: () => void = () => undefined;
beforeAll(() => {
  restore = installDom();
});
afterAll(() => restore());

const mounted: { host: HTMLElement; root: Root }[] = [];
afterEach(() => {
  for (const { host, root } of mounted.splice(0)) {
    act(() => root.unmount());
    host.remove();
  }
});

const DEPT: EditorDepartment = {
  campusId: null,
  id: "d1",
  name: "Fadderullan Oslo",
  theme: { accent: "#fecd45", dark: "#3b1d63" },
};

function seed(meta: Partial<PageDoc["meta"]> = {}) {
  act(() => {
    useEditorStore.setState({ past: [], future: [], themePreview: null });
    useEditorStore.getState().setDoc({
      meta: { department: "", slug: "p", status: "draft", title: "P", ...meta },
      sections: [],
      version: 2,
    });
  });
}

function mount(departments: EditorDepartment[] = [DEPT]) {
  const value = {
    activeLocale: "no",
    campuses: [],
    departments,
    locales: [],
    onLocaleChange: () => undefined,
    savePage: async () => undefined,
    uploadFile: async () => ({ fileId: "", url: "" }),
  } as EditorCallbacks;
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  mounted.push({ host, root });
  act(() => {
    root.render(
      <EditorCallbacksContext.Provider value={value}>
        <ThemePanel />
      </EditorCallbacksContext.Provider>
    );
  });
  return host;
}

const field = (host: Element, label: string) =>
  host.querySelector(`[data-colour="${label}"]`) as HTMLElement;
const hex = (host: Element, label: string) =>
  field(host, label).querySelector('input[type="text"]') as HTMLInputElement;
const area = (host: Element, label: string) =>
  field(host, label).querySelector('[role="slider"]') as HTMLElement;
const btn = (host: Element, text: string) =>
  [...host.querySelectorAll("button")].find(
    (b) => b.textContent === text || b.getAttribute("aria-label") === text
  ) as HTMLButtonElement;
const theme = () => useEditorStore.getState().doc.meta.theme;

function enter(el: Element) {
  fire(el, "onKeyDown", { key: "Enter" });
}

describe("typing a colour", () => {
  test("a failing dark commits once, explains itself and offers a shade", () => {
    seed({ theme: BISO_THEME });
    const host = mount();
    typeInto(hex(host, "Dark"), "#9B5DE5");
    enter(hex(host, "Dark"));
    expect(useEditorStore.getState().past).toHaveLength(1);
    expect(theme()).toEqual({ accent: BISO_THEME.accent, dark: "#9b5de5" });

    const ratio = (
      Math.floor(contrastRatio("#9b5de5", "#ffffff") * 10) / 10
    ).toFixed(1);
    expect(host.textContent).toContain(
      `Too light for white text (${ratio} : 1, needs 7 : 1)`
    );
    const use = [...host.querySelectorAll("button")].find((b) =>
      USE_BUTTON.test(b.textContent ?? "")
    ) as HTMLButtonElement;
    expect(use).toBeDefined();
    click(use);
    const dark = (theme() as PageTheme).dark;
    expect(contrastRatio(dark, "#ffffff")).toBeGreaterThanOrEqual(7);
    expect(dark).toBe(use.textContent?.slice(4));
  });

  test("a passing colour shows a tick and the ratio", () => {
    seed({ theme: BISO_THEME });
    const host = mount();
    expect(field(host, "Dark").parentElement?.textContent).toMatch(RATIO_OK);
  });

  test("a failing accent explains itself", () => {
    seed({ theme: BISO_THEME });
    const host = mount();
    typeInto(hex(host, "Accent"), "#0a2a4a");
    enter(hex(host, "Accent"));
    expect(host.textContent).toContain(
      "Doesn't stand out on the dark colour ("
    );
    expect(host.textContent).toContain(", needs 4.5 : 1)");
  });

  test("bad input shows Not a colour and does not commit", () => {
    seed({ theme: BISO_THEME });
    const host = mount();
    typeInto(hex(host, "Dark"), "zzz");
    enter(hex(host, "Dark"));
    expect(host.textContent).toContain("Not a colour");
    expect(useEditorStore.getState().past).toHaveLength(0);
  });
});

describe("quick picks, reset, seeding", () => {
  test("sky on Accent commits the pair; Reset commits null", () => {
    seed({ theme: BISO_THEME });
    const host = mount();
    click(
      field(host, "Accent").querySelector(
        '[aria-label="Sun #fecd45"]'
      ) as Element
    );
    expect(theme()).toEqual({ accent: "#fecd45", dark: BISO_THEME.dark });
    click(
      field(host, "Accent").querySelector(
        '[aria-label="Sky #3aa3e1"]'
      ) as Element
    );
    expect((theme() as PageTheme).accent).toBe("#3aa3e1");
    click(btn(host, "Reset"));
    expect(theme()).toBeNull();
    expect(hex(host, "Dark").value).toBe(BISO_THEME.dark);
    expect(hex(host, "Accent").value).toBe(BISO_THEME.accent);
  });

  test("an untouched department page seeds from the department and keeps its other colour", () => {
    seed({ department: "d1" });
    const host = mount();
    expect(hex(host, "Dark").value).toBe("#3b1d63");
    expect(hex(host, "Accent").value).toBe("#fecd45");
    click(
      field(host, "Accent").querySelector(
        '[aria-label="Sky #3aa3e1"]'
      ) as Element
    );
    expect(theme()).toEqual({ accent: "#3aa3e1", dark: "#3b1d63" });
  });

  test("with no theme anywhere both fields show BISO", () => {
    seed();
    const host = mount();
    expect(hex(host, "Dark").value).toBe(BISO_THEME.dark);
  });
});

describe("scope line", () => {
  test("names the department", () => {
    seed({ department: "d1" });
    expect(mount().textContent).toContain(
      "Applies to all Fadderullan Oslo pages"
    );
  });
  test("without a department it is this page", () => {
    seed();
    expect(mount().textContent).toContain("Applies to this page");
  });
});

describe("keyboard and dragging", () => {
  test("ArrowRight changes the slider's value text", () => {
    seed({ theme: BISO_THEME });
    const host = mount();
    const before = area(host, "Accent").getAttribute("aria-valuetext");
    fire(area(host, "Accent"), "onKeyDown", { key: "ArrowRight" });
    expect(area(host, "Accent").getAttribute("aria-valuetext")).not.toBe(
      before
    );
  });

  test("a drag is one undo entry, repaints the canvas live and never touches the autosave signature", () => {
    seed({ theme: BISO_THEME });
    const host = mount();
    const el = area(host, "Accent");
    el.getBoundingClientRect = () =>
      ({ height: 100, left: 0, top: 0, width: 100 }) as DOMRect;
    const signature = autosaveSignature(useEditorStore.getState().doc);
    const canvasStyle = () => {
      const { doc, themePreview } = useEditorStore.getState();
      return canvasThemeStyle(themePreview ?? effectiveTheme(doc.meta, [DEPT]));
    };
    const before = JSON.stringify(canvasStyle());

    fire(el, "onPointerDown", { clientX: 5, clientY: 5, pointerId: 1 });
    fire(el, "onPointerMove", { clientX: 40, clientY: 30, pointerId: 1 });
    fire(el, "onPointerMove", { clientX: 80, clientY: 20, pointerId: 1 });
    const dragged = useEditorStore.getState().themePreview;
    expect(dragged).not.toBeNull();
    expect(JSON.stringify(canvasStyle())).not.toBe(before);
    expect(hex(host, "Accent").value).toBe(dragged?.accent as string);
    expect(useEditorStore.getState().past).toHaveLength(0);
    expect(autosaveSignature(useEditorStore.getState().doc)).toBe(signature);

    fire(el, "onPointerUp", { clientX: 80, clientY: 20, pointerId: 1 });
    expect(useEditorStore.getState().past).toHaveLength(1);
    expect(useEditorStore.getState().themePreview).toBeNull();
    expect(theme()?.accent).toBe(dragged?.accent as string);
  });
});

describe("unmount", () => {
  test("a preview mid-drag is cleared when the panel goes away", () => {
    seed({ theme: BISO_THEME });
    const host = mount();
    const el = area(host, "Accent");
    el.getBoundingClientRect = () =>
      ({ height: 100, left: 0, top: 0, width: 100 }) as DOMRect;
    fire(el, "onPointerDown", { clientX: 5, clientY: 5, pointerId: 1 });
    expect(useEditorStore.getState().themePreview).not.toBeNull();
    const { root } = mounted.pop() as { root: Root };
    act(() => root.unmount());
    expect(useEditorStore.getState().themePreview).toBeNull();
  });
});
