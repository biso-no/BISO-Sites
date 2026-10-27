import { afterEach, beforeEach, expect, test, vi } from "vitest";

// `./storage-chunks` opens with `import "server-only"`, which throws outside a
// react-server build.
vi.mock("server-only", () => ({}));

const ENDPOINT = "https://appwrite.test/v1";
const PROJECT = "test-project";
const API_KEY = "test-api-key";
const MIB = 1024 * 1024;
const CHUNK = 5 * MIB;
const TOTAL = 12 * MIB;
const ANOTHER_FILE = /another file/;
const NAMES_THE_KEY = /APPWRITE_API_KEY/;

const fetchMock = vi.fn<typeof fetch>();

function appwriteFile(chunksUploaded: number, chunksTotal: number, id = "f1") {
  return Response.json(
    { $id: id, chunksTotal, chunksUploaded },
    { status: 201 }
  );
}

async function loadModule() {
  vi.resetModules();
  return await import("./storage-chunks");
}

function chunkInput(start: number, end: number, size = end - start + 1) {
  return {
    bucketId: "media",
    chunk: new Blob([new Uint8Array(size)]),
    end,
    fileId: "f1",
    filename: "clip.mp4",
    mime: "video/mp4",
    start,
    total: TOTAL,
  };
}

function sentRequest(call = 0) {
  const [url, init] = fetchMock.mock.calls[call] ?? [];
  return {
    body: init?.body as FormData,
    headers: new Headers(init?.headers),
    method: init?.method,
    url: String(url),
  };
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APPWRITE_ENDPOINT", ENDPOINT);
  vi.stubEnv("NEXT_PUBLIC_APPWRITE_PROJECT", PROJECT);
  vi.stubEnv("APPWRITE_API_KEY", API_KEY);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("the chunk size is Appwrite's 5 MiB", async () => {
  const { CHUNK_BYTES } = await import("./storage");
  expect(CHUNK_BYTES).toBe(CHUNK);
});

test("the first chunk opens the upload with the service key and no x-appwrite-id", async () => {
  fetchMock.mockResolvedValueOnce(appwriteFile(1, 3));
  const { forwardChunk } = await loadModule();

  const result = await forwardChunk(chunkInput(0, CHUNK - 1));

  expect(result).toEqual({ done: false, fileId: "f1" });
  const sent = sentRequest();
  expect(sent.method).toBe("POST");
  expect(sent.url).toBe(`${ENDPOINT}/storage/buckets/media/files`);
  expect(sent.headers.get("content-range")).toBe(
    `bytes 0-${CHUNK - 1}/${TOTAL}`
  );
  expect(sent.headers.get("x-appwrite-project")).toBe(PROJECT);
  expect(sent.headers.get("x-appwrite-key")).toBe(API_KEY);
  expect(sent.headers.has("x-appwrite-id")).toBe(false);
  expect(sent.body.get("fileId")).toBe("f1");
  const file = sent.body.get("file") as File;
  expect(file.name).toBe("clip.mp4");
  expect(file.size).toBe(CHUNK);
  expect(file.type).toBe("video/mp4");
});

test("every later chunk names the upload with x-appwrite-id", async () => {
  fetchMock.mockResolvedValueOnce(appwriteFile(2, 3));
  const { forwardChunk } = await loadModule();

  const result = await forwardChunk(chunkInput(CHUNK, 2 * CHUNK - 1));

  expect(result).toEqual({ done: false, fileId: "f1" });
  const sent = sentRequest();
  expect(sent.headers.get("x-appwrite-id")).toBe("f1");
  expect(sent.headers.get("content-range")).toBe(
    `bytes ${CHUNK}-${2 * CHUNK - 1}/${TOTAL}`
  );
});

test("the chunk that completes the file returns its /view url", async () => {
  fetchMock.mockResolvedValueOnce(appwriteFile(3, 3));
  const { forwardChunk } = await loadModule();

  const result = await forwardChunk(chunkInput(2 * CHUNK, TOTAL - 1));

  expect(result).toEqual({
    done: true,
    fileId: "f1",
    url: `${ENDPOINT}/storage/buckets/media/files/f1/view?project=${PROJECT}`,
  });
  expect(sentRequest().headers.get("content-range")).toBe(
    `bytes ${2 * CHUNK}-${TOTAL - 1}/${TOTAL}`
  );
});

test("an Appwrite refusal rejects with its status", async () => {
  fetchMock.mockResolvedValueOnce(
    Response.json(
      {
        message: "File extension not allowed",
        type: "storage_file_type_unsupported",
      },
      { status: 400 }
    )
  );
  const { forwardChunk } = await loadModule();

  await expect(forwardChunk(chunkInput(0, CHUNK - 1))).rejects.toMatchObject({
    status: 400,
  });
});

test("an answer for another file is refused", async () => {
  fetchMock.mockResolvedValueOnce(appwriteFile(1, 3, "someone-else"));
  const { forwardChunk } = await loadModule();

  await expect(forwardChunk(chunkInput(0, CHUNK - 1))).rejects.toThrow(
    ANOTHER_FILE
  );
});

test("a chunk whose range is impossible never reaches Appwrite", async () => {
  const { forwardChunk } = await loadModule();

  // Past the total.
  await expect(
    forwardChunk(chunkInput(2 * CHUNK, TOTAL, TOTAL - 2 * CHUNK))
  ).rejects.toThrow(RangeError);
  // Bytes that do not match the range.
  await expect(forwardChunk(chunkInput(0, CHUNK - 1, 10))).rejects.toThrow(
    RangeError
  );
  // Backwards.
  await expect(forwardChunk(chunkInput(CHUNK, CHUNK - 1, 1))).rejects.toThrow(
    RangeError
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

test("without a service key nothing is sent", async () => {
  vi.stubEnv("APPWRITE_API_KEY", "");
  vi.stubEnv("APPWRITE_FUNCTION_API_KEY", "");
  const { forwardChunk } = await loadModule();

  await expect(forwardChunk(chunkInput(0, CHUNK - 1))).rejects.toThrow(
    NAMES_THE_KEY
  );
  expect(fetchMock).not.toHaveBeenCalled();
});
