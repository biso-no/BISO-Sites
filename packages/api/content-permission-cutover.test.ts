import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cutoverContentPermissions,
  GENERAL_CONTENT_TABLES,
} from "./content-permission-cutover";

const db = {
  getTable: vi.fn(),
  updateTable: vi.fn(),
};

beforeEach(() => {
  db.getTable.mockReset();
  db.updateTable.mockReset();
  db.getTable.mockImplementation(async ({ tableId }: { tableId: string }) => ({
    $id: tableId,
    $permissions: ['create("team:sg-app-dept-marketing")'],
    enabled: true,
    name: `Table ${tableId}`,
    rowSecurity: true,
  }));
  db.updateTable.mockResolvedValue({});
});

describe("cutoverContentPermissions", () => {
  it("targets exactly the nine general content tables", async () => {
    expect(GENERAL_CONTENT_TABLES).toEqual([
      "events",
      "news",
      "webshop_products",
      "pages",
      "campus_benefits",
      "announcements",
      "documents",
      "content_translations",
      "page_translations",
    ]);

    await cutoverContentPermissions(db, { apply: true });

    expect(db.getTable).toHaveBeenCalledTimes(GENERAL_CONTENT_TABLES.length);
    expect(db.updateTable).toHaveBeenCalledTimes(GENERAL_CONTENT_TABLES.length);
    const touched = db.updateTable.mock.calls.map(
      (call) => (call[0] as { tableId: string }).tableId
    );
    expect(touched.sort()).toEqual([...GENERAL_CONTENT_TABLES].sort());
  });

  it("dry run reports removals without writing", async () => {
    const report = await cutoverContentPermissions(db, { apply: false });

    expect(db.updateTable).not.toHaveBeenCalled();
    expect(report.changed).toHaveLength(GENERAL_CONTENT_TABLES.length);
    expect(report.changed[0]?.removedPermissions).toEqual([
      'create("team:sg-app-dept-marketing")',
    ]);
  });

  it("clears permissions while preserving name, rowSecurity, and enabled", async () => {
    await cutoverContentPermissions(db, { apply: true });

    for (const call of db.updateTable.mock.calls) {
      const params = call[0] as {
        enabled: boolean;
        name: string;
        permissions: string[];
        rowSecurity: boolean;
        tableId: string;
      };
      expect(params.permissions).toEqual([]);
      expect(params.name).toBe(`Table ${params.tableId}`);
      expect(params.rowSecurity).toBe(true);
      expect(params.enabled).toBe(true);
    }
  });

  it("skips tables that are already service-only", async () => {
    db.getTable.mockImplementation(
      async ({ tableId }: { tableId: string }) => ({
        $id: tableId,
        $permissions: [],
        enabled: true,
        name: `Table ${tableId}`,
        rowSecurity: true,
      })
    );

    const report = await cutoverContentPermissions(db, { apply: true });

    expect(db.updateTable).not.toHaveBeenCalled();
    expect(report.unchanged).toEqual([...GENERAL_CONTENT_TABLES]);
  });

  it("records per-table failures without aborting the rest", async () => {
    db.getTable.mockImplementation(({ tableId }: { tableId: string }) => {
      if (tableId === "news") {
        return Promise.reject(new Error("network down"));
      }
      return {
        $id: tableId,
        $permissions: [],
        enabled: true,
        name: `Table ${tableId}`,
        rowSecurity: true,
      };
    });

    const report = await cutoverContentPermissions(db, { apply: true });

    expect(report.errors).toEqual([
      { message: "network down", tableId: "news" },
    ]);
    expect(report.unchanged).toHaveLength(GENERAL_CONTENT_TABLES.length - 1);
  });
});
