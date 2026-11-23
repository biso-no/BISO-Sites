import {
  DocumentsCategory,
  DocumentsLanguage,
  DocumentsScope,
  DocumentsStatus,
} from "@repo/api/types/appwrite";
import { describe, expect, it } from "vitest";
import { documentEntries } from "./document";
import { ctx } from "./fixtures";

type Row = Parameters<typeof documentEntries>[0];
const doc = (o: Partial<Row> = {}): Row => ({
  $id: "doc1",
  title: "Statutter &amp; vedtekter",
  description: "<p>Regler</p>",
  category: Object.values(DocumentsCategory)[0],
  status: DocumentsStatus.PUBLISHED,
  campus_id: "3",
  scope: DocumentsScope.CAMPUS,
  language: null,
  ...o,
});

describe("documentEntries", () => {
  it("maps national english documents", () => {
    const e = documentEntries(
      doc({ language: DocumentsLanguage.EN, scope: DocumentsScope.NATIONAL }),
      ctx()
    );
    expect(e.map((x) => x.locale)).toEqual(["no", "en"]);
    expect(e[0]).toMatchObject({
      text_locale: "en",
      campus_id: "all",
      url: "/api/documents/doc1/download",
      type: "document",
      title: "Statutter & vedtekter",
      summary: "Regler",
    });
  });
  it("defaults to norwegian and campus bucket", () => {
    expect(documentEntries(doc(), ctx())[1]).toMatchObject({
      text_locale: "no",
      campus_id: "3",
    });
  });
  it("caps a long body like the other types", () => {
    const e = documentEntries(
      doc({ description: `<p>${"ord ".repeat(3000)}</p>` }),
      ctx()
    );
    expect(e[0].body.length).toBeLessThanOrEqual(4001);
    expect(e[0].summary.length).toBeLessThanOrEqual(201);
  });
  it("hides drafts", () => {
    expect(
      documentEntries(doc({ status: DocumentsStatus.DRAFT }), ctx())
    ).toEqual([]);
  });
});
