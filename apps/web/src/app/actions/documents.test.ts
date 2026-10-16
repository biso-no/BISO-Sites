import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listRows = vi.fn();

vi.mock("@repo/api/server", () => ({
  createSessionClient: vi.fn(async () => ({ db: { listRows } })),
}));

const { listPublishedDocuments } = await import("./documents");

const doc = {
  $id: "doc-1",
  $updatedAt: "2026-10-01T00:00:00.000Z",
  campus_id: null,
  category: "national-statutes",
  scope: "national",
  status: "published",
  title: "Vedtekter for BISO",
  version: "12",
};

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  listRows.mockReset();
  consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("listPublishedDocuments", () => {
  it("still lists documents, and logs, when the history cannot be read", async () => {
    const failure = new Error("Table with the requested ID could not be found");
    listRows.mockImplementation((_db: string, table: string) => {
      if (table === "document_versions") {
        throw failure;
      }
      return { rows: [doc] };
    });

    const documents = await listPublishedDocuments();

    expect(documents.map((row) => row.$id)).toEqual(["doc-1"]);
    expect(documents[0]?.previousVersions).toEqual([]);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to load document version history:",
      failure
    );
  });

  it("returns an empty list, and logs, when the documents cannot be read", async () => {
    const failure = new Error("Server Error");
    listRows.mockRejectedValue(failure);

    expect(await listPublishedDocuments()).toEqual([]);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to list published documents:",
      failure
    );
  });
});
