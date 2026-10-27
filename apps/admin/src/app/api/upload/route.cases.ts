import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import { getStorageFileUrl } from "@repo/api/storage";
import { NextResponse } from "next/server";

/**
 * Runs in its own `bun test` process (see route-cases.test.ts): the module
 * mocks below are process-global. Nothing here reaches Appwrite: the chunk
 * forwarder and the SDK clients are mocks, and `fetch` throws.
 */

const MIB = 1024 * 1024;
const CHUNK = 5 * MIB;
const TOTAL = 12 * MIB;

interface ForwardInput {
  bucketId: string;
  chunk: Blob;
  end: number;
  fileId: string;
  filename: string;
  mime: string;
  start: number;
  total: number;
}

let userId: string | null = "user-1";
let forwardFails = false;
let lastChunkCompletes = true;

const forwardChunk = mock((input: ForwardInput) => {
  if (forwardFails) {
    return Promise.reject(
      Object.assign(new Error("Appwrite said no"), { status: 500 })
    );
  }
  const done = lastChunkCompletes && input.end === input.total - 1;
  return Promise.resolve(
    done
      ? {
          done: true,
          fileId: input.fileId,
          url: getStorageFileUrl(input.bucketId, input.fileId),
        }
      : { done: false, fileId: input.fileId }
  );
});
const createFile = mock((input: { fileId: string }) =>
  Promise.resolve({ $id: input.fileId })
);

mock.module("@/lib/api-auth", () => ({
  requireApiAuth: () =>
    Promise.resolve(
      userId
        ? { ctx: { userId } }
        : {
            response: NextResponse.json(
              { error: "Unauthorized" },
              { status: 401 }
            ),
          }
    ),
}));
mock.module("@repo/api/storage-chunks", () => ({ forwardChunk }));
mock.module("@repo/api/server", () => ({
  createAdminClient: () => Promise.resolve({ storage: { createFile } }),
  createSessionClient: () => Promise.resolve({ storage: { createFile } }),
}));

const realFetch = globalThis.fetch;
globalThis.fetch = (() => {
  throw new Error("route cases must never reach the network");
}) as unknown as typeof fetch;
const realKey = process.env.APPWRITE_API_KEY;
process.env.APPWRITE_API_KEY = "cases-secret";

const { POST } = await import("./route");

afterAll(() => {
  globalThis.fetch = realFetch;
  if (realKey === undefined) {
    // biome-ignore lint/performance/noDelete: assigning undefined would store the string "undefined".
    delete process.env.APPWRITE_API_KEY;
  } else {
    process.env.APPWRITE_API_KEY = realKey;
  }
});

beforeEach(() => {
  userId = "user-1";
  forwardFails = false;
  lastChunkCompletes = true;
  forwardChunk.mockClear();
  createFile.mockClear();
});

function bytes(size: number): Blob {
  return new Blob([new Uint8Array(size)]);
}

function chunkRequest(
  fields: Record<string, string | Blob>,
  options: { bucket?: string; headers?: Record<string, string> } = {}
): Request {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    form.append(name, value);
  }
  return new Request(
    `http://admin.test/api/upload?bucket=${options.bucket ?? "media"}&chunk=1`,
    { body: form, headers: options.headers, method: "POST" }
  );
}

function firstChunk(
  overrides: Record<string, string | Blob> = {},
  options: { bucket?: string } = {}
): Request {
  return chunkRequest(
    {
      chunk: bytes(CHUNK),
      filename: "Min film.mp4",
      mime: "video/mp4",
      total: String(TOTAL),
      ...overrides,
    },
    options
  );
}

async function openUpload(
  overrides: Record<string, string | Blob> = {}
): Promise<{ fileId: string; token: string }> {
  const response = await POST(firstChunk(overrides));
  expect(response.status).toBe(200);
  return (await response.json()) as { fileId: string; token: string };
}

function nextChunk(
  upload: { fileId: string; token: string },
  start: number,
  end: number,
  overrides: Record<string, string | Blob> = {}
): Request {
  return chunkRequest({
    chunk: bytes(end - start + 1),
    end: String(end),
    fileId: upload.fileId,
    filename: "Min film.mp4",
    mime: "video/mp4",
    start: String(start),
    token: upload.token,
    total: String(TOTAL),
    ...overrides,
  });
}

async function expectRefused(request: Request, status: number) {
  const before = forwardChunk.mock.calls.length;
  const response = await POST(request);
  expect(response.status).toBe(status);
  expect(forwardChunk.mock.calls.length).toBe(before);
  expect(createFile).not.toHaveBeenCalled();
}

test("a 3-chunk upload forwards 5 + 5 + 2 MiB and returns the /view url", async () => {
  const opened = await POST(firstChunk());
  expect(opened.status).toBe(200);
  const upload = (await opened.json()) as { fileId: string; token: string };
  expect(upload.fileId).toBeString();
  expect(upload.token).toBeString();

  const middle = await POST(nextChunk(upload, CHUNK, 2 * CHUNK - 1));
  expect(middle.status).toBe(200);
  expect(await middle.json()).toEqual({ fileId: upload.fileId });

  const last = await POST(nextChunk(upload, 2 * CHUNK, TOTAL - 1));
  expect(last.status).toBe(200);
  expect(await last.json()).toEqual({
    fileId: upload.fileId,
    url: getStorageFileUrl("media", upload.fileId),
  });

  const sent = forwardChunk.mock.calls.map(([input]) => ({
    bucketId: input.bucketId,
    bytes: input.chunk.size,
    end: input.end,
    fileId: input.fileId,
    filename: input.filename,
    mime: input.mime,
    start: input.start,
    total: input.total,
  }));
  const common = {
    bucketId: "media",
    fileId: upload.fileId,
    filename: "Min_film.mp4",
    mime: "video/mp4",
    total: TOTAL,
  };
  expect(sent).toEqual([
    { ...common, bytes: CHUNK, end: CHUNK - 1, start: 0 },
    { ...common, bytes: CHUNK, end: 2 * CHUNK - 1, start: CHUNK },
    { ...common, bytes: 2 * MIB, end: TOTAL - 1, start: 2 * CHUNK },
  ]);
  expect(createFile).not.toHaveBeenCalled();
});

test("chunk mode requires a signed-in editor", async () => {
  userId = null;
  await expectRefused(firstChunk(), 401);
});

test("refuses a total over any limit the bucket has", async () => {
  await expectRefused(
    firstChunk({ total: String(Number.MAX_SAFE_INTEGER) }),
    413
  );
  await expectRefused(firstChunk({ total: "12e6" }), 400);
  await expectRefused(firstChunk({ total: "-1" }), 400);
});

test("refuses an image/png total over 10 MB", async () => {
  await expectRefused(
    firstChunk({
      filename: "huge.png",
      mime: "image/png",
      total: String(10 * MIB + 1),
    }),
    413
  );
});

test("refuses a video/mp4 total over 250 MB", async () => {
  await expectRefused(firstChunk({ total: String(250 * MIB + 1) }), 413);
});

test("accepts a video/mp4 total of exactly 250 MB", async () => {
  const response = await POST(firstChunk({ total: String(250 * MIB) }));
  expect(response.status).toBe(200);
  expect(forwardChunk).toHaveBeenCalledTimes(1);
});

test("refuses a type the bucket does not take", async () => {
  await expectRefused(
    firstChunk({ filename: "a.zip", mime: "application/zip" }),
    415
  );
});

test("refuses chunk mode for a file that fits one request", async () => {
  await expectRefused(firstChunk({ total: String(CHUNK) }), 400);
});

test("refuses chunk mode on a bucket written with the editor's own session", async () => {
  await expectRefused(
    firstChunk(
      { filename: "a.png", mime: "image/png", total: String(8 * MIB) },
      { bucket: "content" }
    ),
    400
  );
});

test("refuses a first chunk that is not exactly one chunk long", async () => {
  await expectRefused(firstChunk({ chunk: bytes(CHUNK - 1) }), 400);
});

test("refuses a body larger than one chunk before reading it", async () => {
  await expectRefused(
    chunkRequest(
      { chunk: bytes(1) },
      { headers: { "content-length": String(CHUNK + 1024 * 1024) } }
    ),
    413
  );
});

test("refuses a forged token", async () => {
  const upload = await openUpload();
  const [expiresAt] = upload.token.split(".");
  await expectRefused(
    nextChunk(
      { fileId: upload.fileId, token: `${expiresAt}.${"A".repeat(43)}` },
      CHUNK,
      2 * CHUNK - 1
    ),
    403
  );
});

test("refuses a token reused for another file", async () => {
  const first = await openUpload();
  const second = await openUpload();
  await expectRefused(
    nextChunk(
      { fileId: second.fileId, token: first.token },
      CHUNK,
      2 * CHUNK - 1
    ),
    403
  );
});

test("refuses another editor's token", async () => {
  const upload = await openUpload();
  userId = "user-2";
  await expectRefused(nextChunk(upload, CHUNK, 2 * CHUNK - 1), 403);
});

test("refuses a MIME that changes mid-upload", async () => {
  const upload = await openUpload();
  await expectRefused(
    nextChunk(upload, CHUNK, 2 * CHUNK - 1, { mime: "video/webm" }),
    403
  );
  await expectRefused(
    nextChunk(upload, CHUNK, 2 * CHUNK - 1, { filename: "clip.webm" }),
    403
  );
});

test("refuses a total that grows mid-upload", async () => {
  const upload = await openUpload();
  await expectRefused(
    nextChunk(upload, CHUNK, 2 * CHUNK - 1, { total: String(250 * MIB) }),
    403
  );
});

test("refuses a chunk whose end reaches the total", async () => {
  const upload = await openUpload();
  await expectRefused(
    nextChunk(upload, 2 * CHUNK, TOTAL, { chunk: bytes(TOTAL - 2 * CHUNK) }),
    400
  );
});

test("refuses an oversize middle chunk", async () => {
  const upload = await openUpload();
  await expectRefused(nextChunk(upload, CHUNK, 2 * CHUNK), 413);
});

test("refuses a short middle chunk", async () => {
  const upload = await openUpload();
  await expectRefused(nextChunk(upload, CHUNK, 2 * CHUNK - 2), 400);
});

test("refuses a range that is not on a chunk boundary or rewrites the first chunk", async () => {
  const upload = await openUpload();
  await expectRefused(nextChunk(upload, CHUNK + 1, 2 * CHUNK), 400);
  await expectRefused(nextChunk(upload, 0, CHUNK - 1), 400);
});

test("refuses bytes that do not match the claimed range", async () => {
  const upload = await openUpload();
  await expectRefused(
    nextChunk(upload, CHUNK, 2 * CHUNK - 1, { chunk: bytes(10) }),
    400
  );
});

test("a failed forward answers 502 and issues no token", async () => {
  forwardFails = true;
  const response = await POST(firstChunk());
  expect(response.status).toBe(502);
  expect(await response.json()).not.toHaveProperty("token");
});

test("a last chunk that does not complete the file is not reported as done", async () => {
  const upload = await openUpload();
  lastChunkCompletes = false;
  const response = await POST(nextChunk(upload, 2 * CHUNK, TOTAL - 1));
  expect(response.status).toBe(409);
  expect(await response.json()).not.toHaveProperty("url");
});

test("a small file still goes up in one request", async () => {
  const response = await POST(
    new Request("http://admin.test/api/upload?bucket=media", {
      body: new Blob([new Uint8Array(1024)], { type: "image/png" }),
      headers: { "content-type": "image/png", "x-filename": "a.png" },
      method: "POST",
    })
  );
  expect(response.status).toBe(200);
  const body = (await response.json()) as { fileId: string; url: string };
  expect(body.url).toBe(getStorageFileUrl("media", body.fileId));
  expect(createFile).toHaveBeenCalledTimes(1);
  expect(forwardChunk).not.toHaveBeenCalled();
});
