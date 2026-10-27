import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import { getStorageFileUrl } from "@repo/api/storage";
import { NextResponse } from "next/server";

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
  forwardChunk.mockClear();
  createFile.mockClear();
});

function chunkRequest(fields: Record<string, string | Blob>): Request {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    form.append(name, value);
  }
  return new Request("http://admin.test/api/media/upload?chunk=1", {
    body: form,
    method: "POST",
  });
}

const PODCAST = {
  filename: "Podcast.mp3",
  mime: "audio/mpeg",
  total: String(TOTAL),
};

function first(overrides: Record<string, string | Blob> = {}): Request {
  return chunkRequest({
    chunk: new Blob([new Uint8Array(CHUNK)]),
    ...PODCAST,
    ...overrides,
  });
}

function next(
  upload: { fileId: string; token: string },
  start: number,
  end: number,
  overrides: Record<string, string | Blob> = {}
): Request {
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

async function expectRefused(request: Request, status: number) {
  const before = forwardChunk.mock.calls.length;
  expect((await POST(request)).status).toBe(status);
  expect(forwardChunk.mock.calls.length).toBe(before);
  expect(createFile).not.toHaveBeenCalled();
}

test("a 3-chunk audio upload answers with the inline media shape", async () => {
  const upload = (await (await POST(first())).json()) as {
    fileId: string;
    token: string;
  };
  expect((await POST(next(upload, CHUNK, 2 * CHUNK - 1))).status).toBe(200);
  const last = await POST(next(upload, 2 * CHUNK, TOTAL - 1));

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
  const upload = (await (await POST(first())).json()) as { fileId: string };
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
  const upload = (await (await POST(first(video))).json()) as {
    fileId: string;
    token: string;
  };
  await expectRefused(
    next(upload, CHUNK, 2 * CHUNK - 1, { ...video, mime: "audio/mp4" }),
    403
  );
});
