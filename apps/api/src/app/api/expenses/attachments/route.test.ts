import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({ get: vi.fn() }));
const storage = vi.hoisted(() => ({ createFile: vi.fn() }));
const isFeatureEnabled = vi.hoisted(() => vi.fn());
const fromBuffer = vi.hoisted(() => vi.fn(() => ({ input: "file" })));

vi.mock("@/lib/auth", () => ({
  createAuthenticatedClient: vi.fn(async () => ({ account })),
}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ storage })),
}));
vi.mock("@repo/shared/utils/feature-flags-server", () => ({
  isFeatureEnabled,
}));
vi.mock("@repo/api/file", () => ({ InputFile: { fromBuffer } }));

import { POST } from "./route";

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4,
]);
const HEIC = new Uint8Array([
  0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63,
]);

function uploadRequest(file?: File, authorization = "Bearer jwt") {
  const form = new FormData();
  if (file) {
    form.append("file", file);
  }
  const headers = new Headers();
  if (authorization) {
    headers.set("authorization", authorization);
  }
  return new Request("https://api.example/api/expenses/attachments", {
    body: form,
    headers,
    method: "POST",
  }) as never;
}

describe("expense receipt upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APPWRITE_ENDPOINT", "https://appwrite.example/v1");
    vi.stubEnv("NEXT_PUBLIC_APPWRITE_PROJECT", "biso-test");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    isFeatureEnabled.mockResolvedValue(true);
    account.get.mockResolvedValue({ $id: "submitter-1" });
    storage.createFile.mockResolvedValue({
      $id: "file-1",
      name: "IMG_0001.png",
      sizeOriginal: 12,
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("refuses uploads while reimbursements are switched off", async () => {
    isFeatureEnabled.mockResolvedValue(false);

    const response = await POST(uploadRequest(new File([PNG], "a.png")));

    expect(response.status).toBe(403);
    expect(isFeatureEnabled).toHaveBeenCalledWith("expenses_module");
    expect(storage.createFile).not.toHaveBeenCalled();
  });

  it("requires a signed-in caller", async () => {
    account.get.mockRejectedValue(new Error("no session"));

    const response = await POST(uploadRequest(new File([PNG], "a.png")));

    expect(response.status).toBe(401);
  });

  it("refuses a cookie-only cross-site form post", async () => {
    // multipart/form-data is CORS-safelisted, so a cross-origin form post with
    // the session cookie is a simple request and never preflighted. Requiring
    // the bearer token the app sends is what makes that post useless.
    const response = await POST(uploadRequest(new File([PNG], "a.png"), ""));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Authentication required",
    });
    expect(isFeatureEnabled).not.toHaveBeenCalled();
    expect(storage.createFile).not.toHaveBeenCalled();
  });

  it("requires a file", async () => {
    const response = await POST(uploadRequest());

    expect(response.status).toBe(400);
  });

  it("refuses files over the bucket's 10 MB limit", async () => {
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.pdf");

    const response = await POST(uploadRequest(big));

    expect(response.status).toBe(413);
    expect(storage.createFile).not.toHaveBeenCalled();
  });

  it("refuses a HEIC photo even when it is labelled as a JPEG", async () => {
    const response = await POST(
      uploadRequest(new File([HEIC], "IMG_0001.jpg", { type: "image/jpeg" }))
    );

    expect(response.status).toBe(415);
    expect(storage.createFile).not.toHaveBeenCalled();
  });

  it("stores a receipt readable by its uploader only and returns its id", async () => {
    const response = await POST(
      uploadRequest(new File([PNG], "IMG_0001.HEIC", { type: "image/heic" }))
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      success: true,
      file: {
        fileId: "file-1",
        mimeType: "image/png",
        name: "IMG_0001.png",
        size: 12,
        viewUrl:
          "https://appwrite.example/v1/storage/buckets/expenses/files/file-1/view?project=biso-test",
      },
    });
    expect(fromBuffer).toHaveBeenCalledWith(expect.any(Buffer), "IMG_0001.png");
    expect(storage.createFile).toHaveBeenCalledWith(
      "expenses",
      expect.any(String),
      { input: "file" },
      ['read("user:submitter-1")']
    );
  });
});
