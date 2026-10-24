import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { FactItem, PageDoc } from "@/editor/types";
import { parseHtml } from "@/lib/test-dom";
import { FactsInspector } from "./inspector";

const notes = (item: FactItem) =>
  [
    ...parseHtml(
      renderToStaticMarkup(
        <FactsInspector
          block={{ id: "f", items: [item], type: "facts" }}
          doc={{} as PageDoc}
          onPatch={() => undefined}
        />
      )
    ).querySelectorAll(".pe-insp-note"),
  ].map((note) => note.textContent);

describe("FactsInspector link note", () => {
  test("no link, or a working one, needs no note", () => {
    expect(notes({ label: "Sted", text: "Oslo" })).toEqual([]);
    expect(
      notes({ href: "mailto:a@biso.no", label: "E-post", text: "a@biso.no" })
    ).toEqual([]);
  });

  test("an unsafe link says the value shows as plain text", () => {
    expect(
      notes({ href: "javascript:alert(1)", label: "Web", text: "x" })
    ).toEqual(["This link isn't allowed, so the value shows as plain text."]);
  });

  test("a link that is there but empty says so", () => {
    expect(notes({ href: " ", label: "Web", text: "x" })).toEqual([
      "No link yet, so the value shows as plain text.",
    ]);
  });
});
