import { describe, expect, test } from "bun:test";
import { normalizePageDoc } from "./serialize";
import type { PageDoc } from "./types";

const legacyDoc = (blocks: unknown[]): PageDoc =>
  ({
    blocks,
    meta: {
      accentColor: "#3DA9E0",
      department: "biso",
      slug: "legacy",
      status: "published",
      title: "Legacy page",
    },
  }) as PageDoc;

describe("normalizePageDoc", () => {
  test("moves the department-grid display mode out of universal layout", () => {
    const normalized = normalizePageDoc(
      legacyDoc([
        {
          heading: "Departments",
          id: "departments",
          layout: "list",
          showFilters: true,
          type: "departmentGrid",
        },
      ])
    );
    const block = normalized.blocks[0] as unknown as Record<string, unknown>;

    expect(block.variant).toBe("list");
    expect(block.layout).toBeUndefined();
  });

  test("normalizes retired team hue names on existing pages", () => {
    const normalized = normalizePageDoc(
      legacyDoc([
        {
          heading: "Team",
          id: "team",
          members: [
            { hue: "claret", initials: "AA", name: "A", role: "One" },
            { hue: "leaf", initials: "BB", name: "B", role: "Two" },
          ],
          type: "team",
        },
      ])
    );
    const block = normalized.blocks[0] as unknown as {
      members: { hue: string }[];
    };

    expect(block.members.map((member) => member.hue)).toEqual([
      "blue",
      "slate",
    ]);
  });

  test("returns the original object when no migration is needed", () => {
    const doc = legacyDoc([]);
    expect(normalizePageDoc(doc)).toBe(doc);
  });
});
