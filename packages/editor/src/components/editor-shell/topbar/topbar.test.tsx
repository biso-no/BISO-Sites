import { afterEach, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { EditorCallbacksContext } from "@/editor/callbacks";
import { useEditorStore } from "@/editor/store";
import type { PageDoc } from "@/editor/types";
import { parseHtml } from "@/lib/test-dom";
import { Topbar } from "./index";

const pristine = { ...useEditorStore.getInitialState() };
afterEach(() => {
  Object.assign(useEditorStore.getInitialState(), pristine);
});

const render = (theme: PageDoc["meta"]["theme"]) => {
  Object.assign(useEditorStore.getInitialState(), {
    doc: {
      meta: { department: "", slug: "a", status: "draft", title: "A", theme },
      sections: [],
      version: 2,
    } satisfies PageDoc,
  });
  const html = renderToStaticMarkup(
    <EditorCallbacksContext.Provider
      value={{
        activeLocale: "no",
        campuses: [],
        departments: [],
        locales: [],
        onLocaleChange: () => undefined,
        onPublish: () => Promise.resolve(undefined),
        savePage: () => Promise.resolve(undefined),
        uploadFile: () => Promise.resolve({ fileId: "", url: "" }),
      }}
    >
      <Topbar />
    </EditorCallbacksContext.Provider>
  );
  return parseHtml(html).querySelector(".pe-publish") as Element;
};

test("a failing theme disables Publish and explains why", () => {
  const button = render({ dark: "#9b5de5", accent: "#fecd45" });
  expect(button.hasAttribute("disabled")).toBe(true);
  expect(button.getAttribute("title")).toContain("contrast");
});

test("a passing theme or none leaves Publish as it was", () => {
  for (const theme of [
    undefined,
    null,
    { dark: "#2a0a4a", accent: "#fecd45" },
  ]) {
    const button = render(theme);
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.getAttribute("title")).toBe("Publish to biso.no");
  }
});
