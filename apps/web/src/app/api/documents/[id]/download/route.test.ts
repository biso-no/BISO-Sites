import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listRows = vi.fn();
const downloadDocument = vi.fn();

vi.mock("@repo/api/server", () => ({
  createSessionClient: vi.fn(async () => ({ db: { listRows } })),
}));
vi.mock("@repo/connectors/sharepoint", () => ({
  getSharePointConfig: vi.fn(() => ({})),
  SharePointService: class {
    downloadDocument = downloadDocument;
  },
}));

const { GET } = await import("./route");

const LINE_BREAK_OR_TAB_REGEX = /[\r\n\t]/;

const doc = {
  $id: "doc-1",
  sharepoint_drive_id: "drive-1",
  sharepoint_item_id: "current-item",
  title: "Vedtekter for BISO",
};

function request(query = ""): NextRequest {
  return {
    nextUrl: new URL(`https://biso.no/api/documents/doc-1/download${query}`),
  } as NextRequest;
}

const context = { params: Promise.resolve({ id: "doc-1" }) };

/** Routes listRows by table. */
function mockTables(tables: Record<string, Record<string, unknown>[]>): void {
  listRows.mockImplementation((_db: string, table: string) => ({
    rows: tables[table] ?? [],
  }));
}

beforeEach(() => {
  listRows.mockReset();
  downloadDocument.mockReset();
  downloadDocument.mockResolvedValue(new ArrayBuffer(4));
});

describe("GET /api/documents/[id]/download", () => {
  it("serves the current file when no version is requested", async () => {
    mockTables({ documents: [doc] });

    const response = await GET(request(), context);

    expect(response.status).toBe(200);
    expect(downloadDocument).toHaveBeenCalledWith("drive-1", "current-item");
    expect(response.headers.get("Content-Disposition")).toBe(
      "attachment; filename=\"Vedtekter for BISO.pdf\"; filename*=UTF-8''Vedtekter%20for%20BISO.pdf"
    );
  });

  it("serves a previous version that belongs to the document", async () => {
    mockTables({
      document_versions: [
        {
          $id: "ver-7",
          document_id: "doc-1",
          sharepoint_drive_id: "drive-1",
          sharepoint_item_id: "archived-item",
          version_major: 7,
          version_minor: 1,
        },
      ],
      documents: [doc],
    });

    const response = await GET(request("?version=ver-7"), context);

    expect(response.status).toBe(200);
    expect(downloadDocument).toHaveBeenCalledWith("drive-1", "archived-item");
    expect(response.headers.get("Content-Disposition")).toBe(
      "attachment; filename=\"Vedtekter for BISO v7.1.pdf\"; filename*=UTF-8''Vedtekter%20for%20BISO%20v7.1.pdf"
    );
  });

  it("keeps line breaks out of the header and sends non-ASCII names in both forms", async () => {
    mockTables({
      documents: [{ ...doc, title: 'Lokale lover\r\nfor Bodø "æ"\tutkast' }],
    });

    const response = await GET(request(), context);

    expect(response.status).toBe(200);
    const header = response.headers.get("Content-Disposition");
    expect(header).toBe(
      "attachment; filename=\"Lokale lover__for Bod_ ____utkast.pdf\"; filename*=UTF-8''Lokale%20lover__for%20Bod%C3%B8%20_%C3%A6__utkast.pdf"
    );
    expect(header).not.toMatch(LINE_BREAK_OR_TAB_REGEX);
  });

  it("returns 404 for a version id that is not this document's", async () => {
    mockTables({ document_versions: [], documents: [doc] });

    const response = await GET(request("?version=ver-other"), context);

    expect(response.status).toBe(404);
    expect(downloadDocument).not.toHaveBeenCalled();
  });

  it("returns 404 when the document is missing or unpublished", async () => {
    mockTables({
      document_versions: [{ $id: "ver-7", document_id: "doc-1" }],
      documents: [],
    });

    const response = await GET(request("?version=ver-7"), context);

    expect(response.status).toBe(404);
    expect(downloadDocument).not.toHaveBeenCalled();
  });
});
