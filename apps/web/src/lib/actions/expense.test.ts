import { beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({ get: vi.fn() }));
const storage = vi.hoisted(() => ({ createFile: vi.fn() }));
const isFeatureEnabled = vi.hoisted(() => vi.fn());
const fromBuffer = vi.hoisted(() => vi.fn(() => ({ input: "file" })));

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ storage })),
  createSessionClient: vi.fn(async () => ({ account, db: {} })),
}));

vi.mock("@repo/api/file", () => ({ InputFile: { fromBuffer } }));

vi.mock("@repo/shared/utils/feature-flags-server", () => ({
  isFeatureEnabled,
}));

import { uploadExpenseAttachment } from "./expense";

function uploadForm(file: File) {
  const form = new FormData();
  form.append("file", file);
  return form;
}

describe("uploadExpenseAttachment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isFeatureEnabled.mockResolvedValue(true);
    account.get.mockResolvedValue({ $id: "submitter-1" });
    storage.createFile.mockResolvedValue({
      $id: "file-1",
      $createdAt: "2026-09-15T00:00:00.000Z",
      $permissions: ['read("user:submitter-1")'],
      $updatedAt: "2026-09-15T00:00:00.000Z",
      bucketId: "expenses",
      chunksTotal: 1,
      chunksUploaded: 1,
      mimeType: "image/png",
      name: "receipt.png",
      signature: "sig",
      sizeOriginal: 12,
    });
  });

  it("stores a receipt readable by its uploader and writable by nobody", async () => {
    // An uploader who kept update/delete could destroy the receipt behind an
    // already-approved payout straight through Appwrite. Reviewers and ledger
    // posting read receipts with the admin key, so nothing needs those grants.
    const result = await uploadExpenseAttachment(
      uploadForm(
        new File([new Uint8Array([1, 2, 3])], "receipt.png", {
          type: "image/png",
        })
      )
    );

    expect(result.success).toBe(true);
    expect(storage.createFile).toHaveBeenCalledWith(
      "expenses",
      expect.any(String),
      { input: "file" },
      ['read("user:submitter-1")']
    );
  });
});
