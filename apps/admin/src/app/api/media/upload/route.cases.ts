import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import { getStorageFileUrl } from "@repo/api/storage";

const nextServer = await import("next/server");
const { NextResponse } = nextServer;

/**
 * Chunk mode of the inline-media route. Runs in its own `bun test` process
 * (see route-cases.test.ts) because the module mocks are process-global.
 * Nothing here reaches Appwrite: the forwarder is a mock and `fetch` throws.
 */

const MIB = 1024 * 1024;
const CHUNK = 5 * MIB;
const TOTAL = 12 * MIB;

interface ForwardInput {
  bucketId: string;
  chunk: Blob;
  end: number;
  fileId: string;
  start: number;
  total: number;
}

let userId: string | null = "user-1";
const forwardChunk = mock((input: ForwardInput) =>
  Promise.resolve(
    input.end === input.total - 1
      ? {
          done: true,
          fileId: input.fileId,
          url: getStorageFileUrl(input.bucketId, input.fileId),
        }
      : { done: false, fileId: input.fileId }
  )
);
const createFile = mock(() => Promise.resolve({ $id: "single" }));
const createRow = mock((..._args: unknown[]) => Promise.resolve({}));
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
      storage: {
        createFile,
        deleteFile: () => Promise.resolve({}),
        listFiles: () => Promise.resolve({ files: [], total: 0 }),
      },
    }),
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
  afterTasks.length = 0;
  forwardChunk.mockClear();
  createFile.mockClear();
  createRow.mockClear();
});

/** As `sendInChunks` sends it; a `null` header leaves that header out. */
async function chunkRequest(
  fields: Record<string, string | Blob>,
  overrides: Record<string, string | null> = {}
): Promise<Request> {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    form.append(name, value);
  }
  const url = "http://admin.test/api/media/upload?chunk=1";
  // Bun leaves content-length unset on a Request; a browser always sends it.
  const length = (
    await new Request(url, { body: form, method: "POST" }).arrayBuffer()
  ).byteLength;
  const headers = new Headers({
    "content-length": String(length),
    "sec-fetch-site": "same-origin",
    "x-biso-upload": "1",
  });
  for (const [name, value] of Object.entries(overrides)) {
    if (value === null) {
      headers.delete(name);
    } else {
      headers.set(name, value);
    }
  }
  return new Request(url, { body: form, headers, method: "POST" });
}

const PODCAST = {
  filename: "Podcast.mp3",
  mime: "audio/mpeg",
  total: String(TOTAL),
};

function first(
  overrides: Record<string, string | Blob> = {},
  headers: Record<string, string | null> = {}
): Promise<Request> {
  return chunkRequest(
    {
      chunk: new Blob([new Uint8Array(CHUNK)]),
      ...PODCAST,
      ...overrides,
    },
    headers
  );
}

function next(
  upload: { fileId: string; token: string },
  start: number,
  end: number,
  overrides: Record<string, string | Blob> = {}
): Promise<Request> {
  return chunkRequest({
    chunk: new Blob([new Uint8Array(end - start + 1)]),
    ...PODCAST,
    end: String(end),
    fileId: upload.fileId,
    start: String(start),
    token: upload.token,
    ...overrides,
  });
}

async function expectRefused(request: Promise<Request>, status: number) {
  const forwarded = forwardChunk.mock.calls.length;
  const audited = createRow.mock.calls.length;
  expect((await POST(await request)).status).toBe(status);
  expect(forwardChunk.mock.calls.length).toBe(forwarded);
  expect(createRow.mock.calls.length).toBe(audited);
  expect(createFile).not.toHaveBeenCalled();
}

test("a 3-chunk audio upload answers with the inline media shape", async () => {
  const upload = (await (await POST(await first())).json()) as {
    fileId: string;
    token: string;
  };
  expect((await POST(await next(upload, CHUNK, 2 * CHUNK - 1))).status).toBe(
    200
  );
  const last = await POST(await next(upload, 2 * CHUNK, TOTAL - 1));

  expect(last.status).toBe(200);
  expect(await last.json()).toEqual({
    file: {
      fileId: upload.fileId,
      fileName: "Podcast.mp3",
      mediaKind: "audio",
      mimeType: "audio/mpeg",
      size: TOTAL,
      url: getStorageFileUrl("media", upload.fileId),
    },
  });
  expect(
    forwardChunk.mock.calls.map(([input]) => [
      input.bucketId,
      input.start,
      input.end,
    ])
  ).toEqual([
    ["media", 0, CHUNK - 1],
    ["media", CHUNK, 2 * CHUNK - 1],
    ["media", 2 * CHUNK, TOTAL - 1],
  ]);
  expect(createFile).not.toHaveBeenCalled();
});

test("chunk mode requires a signed-in editor", async () => {
  userId = null;
  await expectRefused(first(), 401);
});

test("refuses an extension and MIME mismatch", async () => {
  await expectRefused(
    first({ filename: "photo.jpg", mime: "application/javascript" }),
    415
  );
});

test("refuses a total over 250 MB", async () => {
  await expectRefused(first({ total: String(250 * MIB + 1) }), 413);
});

test("refuses a forged token", async () => {
  const upload = (await (await POST(await first())).json()) as {
    fileId: string;
  };
  await expectRefused(
    next(
      { fileId: upload.fileId, token: `9999999999999.${"A".repeat(43)}` },
      CHUNK,
      2 * CHUNK - 1
    ),
    403
  );
});

test("refuses a MIME that changes mid-upload", async () => {
  const video = { filename: "clip.mp4", mime: "video/mp4" };
  const upload = (await (await POST(await first(video))).json()) as {
    fileId: string;
    token: string;
  };
  await expectRefused(
    next(upload, CHUNK, 2 * CHUNK - 1, { ...video, mime: "audio/mp4" }),
    403
  );
});

test("refuses a chunk from another site", async () => {
  await expectRefused(first({}, { "x-biso-upload": null }), 403);
  await expectRefused(first({}, { "sec-fetch-site": "cross-site" }), 403);
  await expectRefused(
    first({}, { origin: "https://evil.test", "sec-fetch-site": null }),
    403
  );
});

test("requires a valid content-length", async () => {
  await expectRefused(first({}, { "content-length": null }), 411);
});

test("records who opened the upload and schedules the sweep", async () => {
  const upload = (await (await POST(await first())).json()) as {
    fileId: string;
  };
  expect(createRow).toHaveBeenCalledTimes(1);
  expect(createRow.mock.calls[0]?.[3]).toMatchObject({
    action: "media.chunked_upload.start",
    actor_id: "user-1",
    resource_id: upload.fileId,
  });
  expect(afterTasks).toHaveLength(1);
});
