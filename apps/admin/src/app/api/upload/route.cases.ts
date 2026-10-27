import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";
import { getStorageFileUrl } from "@repo/api/storage";

const nextServer = await import("next/server");
const { NextResponse } = nextServer;

/**
 * Runs in its own `bun test` process (see route-cases.test.ts): the module
 * mocks below are process-global. Nothing here reaches Appwrite: the chunk
 * forwarder and the SDK clients are mocks, and `fetch` throws. `after()` only
 * records its task, so a test can run the post-response sweep itself.
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
const createRow = mock((..._args: unknown[]) => Promise.resolve({}));
let storedFiles: {
  $createdAt: string;
  $id: string;
  chunksTotal: number;
  chunksUploaded: number;
}[] = [];
const listFiles = mock((_params: { bucketId: string; queries: string[] }) =>
  Promise.resolve({ files: storedFiles, total: storedFiles.length })
);
const deleteFile = mock((_params: { bucketId: string; fileId: string }) =>
  Promise.resolve({})
);
const afterTasks: (() => unknown)[] = [];

mock.module("@/lib/api-auth", () => ({
  requireApiAuth: () =>
    Promise.resolve(
      userId
        ? { ctx: { email: "editor@example.org", userId } }
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
  createAdminClient: () =>
    Promise.resolve({
      db: { createRow },
      storage: { createFile, deleteFile, listFiles },
    }),
  createSessionClient: () => Promise.resolve({ storage: { createFile } }),
}));
mock.module("next/server", () => ({
  ...nextServer,
  after: (task: () => unknown) => {
    afterTasks.push(task);
  },
}));
// `lib/chunked-upload` and `lib/upload-token` open with `import "server-only"`.
mock.module("server-only", () => ({}));

const realFetch = globalThis.fetch;
globalThis.fetch = (() => {
  throw new Error("route cases must never reach the network");
}) as unknown as typeof fetch;
const realKey = process.env.APPWRITE_API_KEY;
process.env.APPWRITE_API_KEY = "cases-secret";
// The admin's canonical origin, as in production (own process: no restore).
process.env.NEXT_PUBLIC_BASE_URL = "http://admin.test/";

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
  storedFiles = [];
  afterTasks.length = 0;
  forwardChunk.mockClear();
  createFile.mockClear();
  createRow.mockClear();
  listFiles.mockClear();
  deleteFile.mockClear();
});

function bytes(size: number): Blob {
  return new Blob([new Uint8Array(size)]);
}

/**
 * A chunk request as `sendInChunks` sends it from the admin itself: multipart
 * with its real length, `Sec-Fetch-Site: same-origin` and the upload header.
 * A `null` header leaves that header out.
 */
async function chunkRequest(
  fields: Record<string, string | Blob>,
  options: { bucket?: string; headers?: Record<string, string | null> } = {}
): Promise<Request> {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    form.append(name, value);
  }
  const url = `http://admin.test/api/upload?bucket=${options.bucket ?? "media"}&chunk=1`;
  // Bun leaves content-length unset on a Request; a browser always sends it.
  const length = (
    await new Request(url, { body: form, method: "POST" }).arrayBuffer()
  ).byteLength;
  const headers = new Headers({
    "content-length": String(length),
    "sec-fetch-site": "same-origin",
    "x-biso-upload": "1",
  });
  for (const [name, value] of Object.entries(options.headers ?? {})) {
    if (value === null) {
      headers.delete(name);
    } else {
      headers.set(name, value);
    }
  }
  return new Request(url, { body: form, headers, method: "POST" });
}

function firstChunk(
  overrides: Record<string, string | Blob> = {},
  options: { bucket?: string; headers?: Record<string, string | null> } = {}
): Promise<Request> {
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
  const response = await POST(await firstChunk(overrides));
  expect(response.status).toBe(200);
  return (await response.json()) as { fileId: string; token: string };
}

function nextChunk(
  upload: { fileId: string; token: string },
  start: number,
  end: number,
  overrides: Record<string, string | Blob> = {},
  headers: Record<string, string | null> = {}
): Promise<Request> {
  return chunkRequest(
    {
      chunk: bytes(end - start + 1),
      end: String(end),
      fileId: upload.fileId,
      filename: "Min film.mp4",
      mime: "video/mp4",
      start: String(start),
      token: upload.token,
      total: String(TOTAL),
      ...overrides,
    },
    { headers }
  );
}

/** Refused before anything reaches Appwrite, the audit log or the sweep. */
async function expectRefused(request: Promise<Request>, status: number) {
  const forwarded = forwardChunk.mock.calls.length;
  const audited = createRow.mock.calls.length;
  const scheduled = afterTasks.length;
  const response = await POST(await request);
  expect(response.status).toBe(status);
  expect(forwardChunk.mock.calls.length).toBe(forwarded);
  expect(createRow.mock.calls.length).toBe(audited);
  expect(afterTasks.length).toBe(scheduled);
  expect(createFile).not.toHaveBeenCalled();
}

test("a 3-chunk upload forwards 5 + 5 + 2 MiB and returns the /view url", async () => {
  const opened = await POST(await firstChunk());
  expect(opened.status).toBe(200);
  const upload = (await opened.json()) as { fileId: string; token: string };
  expect(upload.fileId).toBeString();
  expect(upload.token).toBeString();

  const middle = await POST(await nextChunk(upload, CHUNK, 2 * CHUNK - 1));
  expect(middle.status).toBe(200);
  expect(await middle.json()).toEqual({ fileId: upload.fileId });

  const last = await POST(await nextChunk(upload, 2 * CHUNK, TOTAL - 1));
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
  const response = await POST(await firstChunk({ total: String(250 * MIB) }));
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
  // A consistent switch to another allowed type fails the token.
  await expectRefused(
    nextChunk(upload, CHUNK, 2 * CHUNK - 1, {
      filename: "Min film.webm",
      mime: "video/webm",
    }),
    403
  );
  // A switch of only the type or only the name fails the extension check.
  await expectRefused(
    nextChunk(upload, CHUNK, 2 * CHUNK - 1, { mime: "video/webm" }),
    415
  );
  await expectRefused(
    nextChunk(upload, CHUNK, 2 * CHUNK - 1, { filename: "clip.webm" }),
    415
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
  const response = await POST(await firstChunk());
  expect(response.status).toBe(502);
  expect(await response.json()).not.toHaveProperty("token");
});

test("a last chunk that does not complete the file is not reported as done", async () => {
  const upload = await openUpload();
  lastChunkCompletes = false;
  const response = await POST(await nextChunk(upload, 2 * CHUNK, TOTAL - 1));
  expect(response.status).toBe(409);
  expect(await response.json()).not.toHaveProperty("url");
});

test("a small file still goes up in one request", async () => {
  const response = await POST(
    new Request("http://admin.test/api/upload?bucket=media", {
      body: new Blob([new Uint8Array(1024)], { type: "image/png" }),
      headers: {
        "content-length": "1024",
        "content-type": "image/png",
        "x-filename": "a.png",
      },
      method: "POST",
    })
  );
  expect(response.status).toBe(200);
  const body = (await response.json()) as { fileId: string; url: string };
  expect(body.url).toBe(getStorageFileUrl("media", body.fileId));
  expect(createFile).toHaveBeenCalledTimes(1);
  expect(forwardChunk).not.toHaveBeenCalled();
});

test("refuses a chunk from another site, on every chunk", async () => {
  // The upload header forces a CORS preflight, which another site fails.
  await expectRefused(
    firstChunk({}, { headers: { "x-biso-upload": null } }),
    403
  );
  await expectRefused(
    firstChunk({}, { headers: { "sec-fetch-site": "cross-site" } }),
    403
  );
  // Another subdomain of biso.no is same-site, not same-origin.
  await expectRefused(
    firstChunk({}, { headers: { "sec-fetch-site": "same-site" } }),
    403
  );
  const upload = await openUpload();
  await expectRefused(
    nextChunk(upload, CHUNK, 2 * CHUNK - 1, {}, { "x-biso-upload": null }),
    403
  );
  await expectRefused(
    nextChunk(
      upload,
      CHUNK,
      2 * CHUNK - 1,
      {},
      { "sec-fetch-site": "cross-site" }
    ),
    403
  );
});

test("without Sec-Fetch-Site, only the admin's own Origin passes", async () => {
  await expectRefused(
    firstChunk(
      {},
      { headers: { origin: "https://evil.test", "sec-fetch-site": null } }
    ),
    403
  );
  await expectRefused(
    firstChunk({}, { headers: { "sec-fetch-site": null } }),
    403
  );
  const response = await POST(
    await firstChunk(
      {},
      { headers: { origin: "http://admin.test", "sec-fetch-site": null } }
    )
  );
  expect(response.status).toBe(200);
});

function singleRequest(
  body: BodyInit,
  headers: Record<string, string>
): Request {
  return new Request("http://admin.test/api/upload?bucket=media", {
    body,
    headers: { "content-type": "image/png", "x-filename": "a.png", ...headers },
    method: "POST",
  });
}

/** A body of `count` pieces of 1 MiB that never holds more than one. */
function streamOfMib(count: number): ReadableStream<Uint8Array> {
  const piece = new Uint8Array(MIB);
  let sent = 0;
  return new ReadableStream({
    pull(controller) {
      if (sent === count) {
        controller.close();
        return;
      }
      sent += 1;
      controller.enqueue(piece);
    },
  });
}

test("a single request without a content-length still uploads", async () => {
  const response = await POST(singleRequest(new Uint8Array(1024), {}));
  expect(response.status).toBe(200);
  expect(createFile).toHaveBeenCalledTimes(1);
});

test("a single request declaring more than its type allows is refused unread", async () => {
  const request = singleRequest(new Uint8Array(1024), {
    "content-length": String(10 * MIB + 1),
  });
  expect((await POST(request)).status).toBe(413);
  expect(request.bodyUsed).toBeFalse();
  expect(createFile).not.toHaveBeenCalled();
});

test("a single request larger than it declared is cut off at the type's limit", async () => {
  // 11 MiB of PNG while claiming 1 KiB: the read stops past 10 MiB.
  const response = await POST(
    singleRequest(streamOfMib(11), { "content-length": "1024" })
  );
  expect(response.status).toBe(413);
  expect(createFile).not.toHaveBeenCalled();
});

test("a single request whose name disagrees with its type is refused", async () => {
  const request = new Request("http://admin.test/api/upload?bucket=media", {
    body: new Uint8Array(1024),
    headers: {
      "content-length": "1024",
      "content-type": "video/mp4",
      "x-filename": "a.zip",
    },
    method: "POST",
  });
  expect((await POST(request)).status).toBe(415);
  expect(createFile).not.toHaveBeenCalled();
});

test("a chunk without a content-length still goes up, capped", async () => {
  const response = await POST(
    await firstChunk({}, { headers: { "content-length": null } })
  );
  expect(response.status).toBe(200);
  expect(forwardChunk).toHaveBeenCalledTimes(1);
});

test("a chunk body larger than it declared is cut off at one chunk", async () => {
  await expectRefused(
    firstChunk(
      { chunk: bytes(CHUNK + 256 * 1024) },
      { headers: { "content-length": "1024" } }
    ),
    413
  );
});

test("refuses a file name whose extension disagrees with its type", async () => {
  await expectRefused(firstChunk({ filename: "archive.zip" }), 415);
  await expectRefused(firstChunk({ filename: "photo.png" }), 415);
});

test("records who opened each upload in the audit log", async () => {
  const upload = await openUpload();
  await POST(await nextChunk(upload, CHUNK, 2 * CHUNK - 1));

  expect(createRow).toHaveBeenCalledTimes(1);
  const [databaseId, tableId, , row] = createRow.mock.calls[0] ?? [];
  expect([databaseId, tableId]).toEqual(["app", "audit_logs"]);
  expect(row).toMatchObject({
    action: "media.chunked_upload.start",
    actor_id: "user-1",
    resource_id: upload.fileId,
    resource_type: "file",
  });
  expect(JSON.parse((row as { payload: string }).payload)).toEqual({
    bucket: "media",
    filename: "Min_film.mp4",
    mime: "video/mp4",
    total: TOTAL,
  });
});

test("opening an upload sweeps stale partials after the response", async () => {
  const old = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
  storedFiles = [
    { $createdAt: old, $id: "abandoned", chunksTotal: 50, chunksUploaded: 4 },
    { $createdAt: old, $id: "finished", chunksTotal: 3, chunksUploaded: 3 },
  ];

  await openUpload();
  expect(afterTasks).toHaveLength(1);
  expect(listFiles).not.toHaveBeenCalled();

  await afterTasks[0]?.();
  expect(listFiles).toHaveBeenCalledTimes(1);
  const queries = listFiles.mock.calls[0]?.[0].queries ?? [];
  expect(listFiles.mock.calls[0]?.[0].bucketId).toBe("media");
  expect(queries).toContain(Query.equal("signature", [""]));
  expect(queries).toContain(Query.limit(25));
  expect(deleteFile.mock.calls.map(([call]) => call)).toEqual([
    { bucketId: "media", fileId: "abandoned" },
  ]);
});

test("a failing sweep never fails the upload", async () => {
  listFiles.mockImplementationOnce(() =>
    Promise.reject(new Error("Appwrite is down"))
  );
  await openUpload();
  await afterTasks[0]?.();
  expect(deleteFile).not.toHaveBeenCalled();
});
