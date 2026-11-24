import { describe, expect, it } from "bun:test";
import { resolveTargets } from "./resolve";

const row = (table: string, body: Record<string, unknown> | null = null) =>
  ({ kind: "row", table, id: "r1", action: "update", body }) as const;

describe("resolveTargets", () => {
  it("maps plain tables to one type", () => {
    expect(resolveTargets(row("events"))).toEqual({
      kind: "targets",
      targets: [{ type: "event", id: "r1" }],
    });
    expect(resolveTargets(row("webshop_products"))).toEqual({
      kind: "targets",
      targets: [{ type: "product", id: "r1" }],
    });
    expect(resolveTargets(row("documents"))).toEqual({
      kind: "targets",
      targets: [{ type: "document", id: "r1" }],
    });
  });

  it("reads content translations from the body", () => {
    expect(
      resolveTargets(
        row("content_translations", { content_type: "event", content_id: "e9" })
      )
    ).toEqual({ kind: "targets", targets: [{ type: "event", id: "e9" }] });
    expect(
      resolveTargets(
        row("content_translations", {
          content_type: "department",
          content_id: "d1",
        })
      )
    ).toEqual({ kind: "targets", targets: [{ type: "unit", id: "d1" }] });
    expect(
      resolveTargets(
        row("content_translations", {
          content_type: "memberBenefit",
          content_id: "b1",
        })
      ).kind
    ).toBe("ignored");
    expect(resolveTargets(row("content_translations")).kind).toBe("ignored");
  });

  it("maps page translations to their page", () => {
    expect(resolveTargets(row("page_translations", { page_id: "p7" }))).toEqual(
      { kind: "targets", targets: [{ type: "page", id: "p7" }] }
    );
    expect(resolveTargets(row("page_translations")).kind).toBe("ignored");
  });

  it("maps departments to department-related, then unit", () => {
    // department-related compares the unit's entry before the unit writes.
    expect(resolveTargets(row("departments"))).toEqual({
      kind: "targets",
      targets: [
        { type: "department-related", id: "r1" },
        { type: "unit", id: "r1" },
      ],
    });
  });

  it("re-syncs what a page row was bound to, from its body", () => {
    const deleted = (body: Record<string, unknown>) =>
      ({
        kind: "row",
        table: "pages",
        id: "p1",
        action: "delete",
        body,
      }) as const;
    expect(
      resolveTargets(
        deleted({ slug: "projects/winter-games", department_id: null })
      )
    ).toEqual({
      kind: "targets",
      targets: [
        { type: "page", id: "p1" },
        { type: "project-path", id: "winter-games" },
      ],
    });
    expect(
      resolveTargets(
        deleted({ slug: "projects/winter-games", department_id: "d1" })
      )
    ).toEqual({
      kind: "targets",
      targets: [
        { type: "page", id: "p1" },
        { type: "unit", id: "d1" },
        { type: "project-path", id: "winter-games" },
      ],
    });
    expect(
      resolveTargets(
        deleted({ slug: "units/oslo/fadderullan", department_id: "d1" })
      )
    ).toEqual({
      kind: "targets",
      targets: [
        { type: "page", id: "p1" },
        { type: "unit", id: "d1" },
      ],
    });
    expect(resolveTargets(row("pages"))).toEqual({
      kind: "targets",
      targets: [{ type: "page", id: "r1" }],
    });
  });

  it("ignores other tables", () => {
    expect(resolveTargets(row("orders")).kind).toBe("ignored");
  });
});
