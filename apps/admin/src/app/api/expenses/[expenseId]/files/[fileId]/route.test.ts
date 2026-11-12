import { beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));
const storage = {
  getFile: mock(),
  getFileView: mock(),
};
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ storage })),
}));
const getExpenseViewer = mock();
mock.module("@/lib/expense-viewer", () => ({ getExpenseViewer }));
const getExpenseDetail = mock();
mock.module("@/app/(portal)/expenses/expenses-data", () => ({
  getExpenseDetail,
}));

const { GET } = await import("./route");

const call = (fileId: string) =>
  GET(new Request("http://x/api"), {
    params: Promise.resolve({ expenseId: "ex1", fileId }),
  });

beforeEach(() => {
  storage.getFile.mockReset();
  storage.getFileView.mockReset();
  getExpenseViewer.mockReset();
  getExpenseDetail.mockReset();
  getExpenseViewer.mockResolvedValue({ userId: "u1" });
  getExpenseDetail.mockResolvedValue({ receipts: [{ fileId: "f1" }] });
  storage.getFile.mockResolvedValue({ mimeType: "application/pdf" });
  storage.getFileView.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
});

describe("receipt file route", () => {
  test("404 for a file that is not on the expense", async () => {
    const res = await call("other");
    expect(res.status).toBe(404);
    expect(storage.getFileView).not.toHaveBeenCalled();
  });

  test("404 when the viewer cannot view the expense", async () => {
    getExpenseDetail.mockResolvedValue(null);
    expect((await call("f1")).status).toBe(404);
  });

  test("404 when nobody is signed in", async () => {
    getExpenseViewer.mockResolvedValue(null);
    expect((await call("f1")).status).toBe(404);
  });

  test("streams the file inline and uncached", async () => {
    const res = await call("f1");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Content-Disposition")).toBe("inline");
    expect(storage.getFileView).toHaveBeenCalledWith("expenses", "f1");
    expect((await res.arrayBuffer()).byteLength).toBe(3);
  });
});
