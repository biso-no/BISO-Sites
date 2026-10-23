import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { HeadingBlock, PageDoc } from "@/editor/types";
import { parseHtml } from "@/lib/test-dom";
import { HeadingInspector } from "./inspector";

const base: HeadingBlock = {
  eyebrow: "",
  id: "h",
  intro: "",
  size: "medium",
  title: "Om oss",
  type: "heading",
};

const notes = (link: HeadingBlock["link"]) =>
  [
    ...parseHtml(
      renderToStaticMarkup(
        <HeadingInspector
          block={{ ...base, link }}
          doc={{} as PageDoc}
          onPatch={() => undefined}
        />
      )
    ).querySelectorAll(".pe-insp-note"),
  ].map((note) => note.textContent);

describe("HeadingInspector link note", () => {
  test("no link, an empty one, or a working one needs no note", () => {
    expect(notes(undefined)).toEqual([]);
    expect(notes({ href: "", label: "" })).toEqual([]);
    expect(notes({ href: "/om-oss", label: "Les mer" })).toEqual([]);
  });

  test("a label without a link says the link won't show", () => {
    expect(notes({ href: "", label: "Les mer" })).toEqual([
      "No link yet, so the link and its underline won't show.",
    ]);
  });

  test("a working link without a label says the link won't show", () => {
    for (const label of ["", "   "]) {
      expect(notes({ href: "/om-oss", label })).toEqual([
        "No label yet, so the link and its underline won't show.",
      ]);
    }
  });

  test("an unsafe link says it isn't allowed", () => {
    expect(notes({ href: "javascript:x", label: "Les mer" })).toEqual([
      "This link isn't allowed, so the link and its underline won't show.",
    ]);
  });
});
