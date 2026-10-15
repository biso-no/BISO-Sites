import { describe, expect, it, vi } from "vitest";
import { backfillDocumentPermissions } from "./document-permission-backfill";

const PUBLIC_READ = 'read("any")';

function fakeDb(rows: {
  documents: Array<{ $id: string; $permissions: string[]; status: string }>;
  document_versions: Array<{
    $id: string;
    $permissions: string[];
    document_id: string;
  }>;
}) {
  return {
    listRows: vi.fn(async ({ tableId }: { tableId: string }) => ({
      rows: rows[tableId as keyof typeof rows],
      total: rows[tableId as keyof typeof rows].length,
    })),
    updateRow: vi.fn(async () => ({})),
  };
}

describe("backfillDocumentPermissions", () => {
  it("gives published documents and their versions public read, drafts none", async () => {
    // Rows written before row permissions existed carry none, so removing
    // the table-level grant would hide every published document.
    const db = fakeDb({
      document_versions: [
        { $id: "v1", $permissions: [], document_id: "pub" },
        { $id: "v2", $permissions: [], document_id: "draft" },
      ],
      documents: [
        { $id: "pub", $permissions: [], status: "published" },
        { $id: "draft", $permissions: [PUBLIC_READ], status: "draft" },
        { $id: "ok", $permissions: [PUBLIC_READ], status: "published" },
      ],
    });

    const report = await backfillDocumentPermissions(db, { apply: true });

    // v2 belongs to a draft and already has no permissions.
    expect(report.unchanged.sort()).toEqual(["ok", "v2"]);
    expect(report.changed.map((c) => `${c.tableId}/${c.rowId}`).sort()).toEqual(
      ["document_versions/v1", "documents/draft", "documents/pub"]
    );
    expect(db.updateRow).toHaveBeenCalledWith(
      expect.objectContaining({ rowId: "pub", permissions: [PUBLIC_READ] })
    );
    expect(db.updateRow).toHaveBeenCalledWith(
      expect.objectContaining({ rowId: "draft", permissions: [] })
    );
    expect(db.updateRow).toHaveBeenCalledWith(
      expect.objectContaining({ rowId: "v1", permissions: [PUBLIC_READ] })
    );
  });

  it("only reports in a dry run", async () => {
    const db = fakeDb({
      document_versions: [],
      documents: [{ $id: "pub", $permissions: [], status: "published" }],
    });

    const report = await backfillDocumentPermissions(db, { apply: false });

    expect(report.changed).toHaveLength(1);
    expect(db.updateRow).not.toHaveBeenCalled();
  });
});
