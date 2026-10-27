import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { uploadFile, uploadMediaFile } from "./upload-client";

const MIB = 1024 * 1024;
const SESSION_EXPIRED = /session has expired/;
const CHECK_CONNECTION = /check your connection/;
const CHUNK = 5 * MIB;

type Answer = { body: unknown; status?: number } | Error;

let answers: Answer[] = [];
const fetchMock = mock((_url: string, _init?: RequestInit) => {
  const next = answers.shift();
  if (!next) {
    return Promise.reject(new Error("unexpected request"));
  }
  if (next instanceof Error) {
    return Promise.reject(next);
  }
  return Promise.resolve(
    Response.json(next.body, { status: next.status ?? 200 })
  );
});

const realFetch = globalThis.fetch;
globalThis.fetch = fetchMock as unknown as typeof fetch;
afterAll(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  answers = [];
  fetchMock.mockClear();
});

function video(size: number, name = "Min film.mp4"): File {
  return new File([new Uint8Array(size)], name, { type: "video/mp4" });
}

function sentForm(call: number): FormData {
  return fetchMock.mock.calls[call]?.[1]?.body as FormData;
}

describe("uploadFile in chunks", () => {
  it("splits a 12 MiB file into 5 + 5 + 2 MiB and reports progress", async () => {
    answers = [
      { body: { fileId: "f1", token: "t1" } },
      { body: { fileId: "f1" } },
      { body: { fileId: "f1", url: "https://appwrite.test/view" } },
    ];
    const progress: number[] = [];

    const result = await uploadFile(video(12 * MIB), {
      bucket: "media",
      onProgress: (fraction) => progress.push(fraction),
    });

    expect(result).toEqual({ fileId: "f1", url: "https://appwrite.test/view" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [url, init] of fetchMock.mock.calls) {
      expect(url).toBe("/api/upload?bucket=media&chunk=1");
      expect(init?.method).toBe("POST");
    }
    const sizes = [0, 1, 2].map(
      (call) => (sentForm(call).get("chunk") as Blob).size
    );
    expect(sizes).toEqual([CHUNK, CHUNK, 2 * MIB]);

    const first = sentForm(0);
    expect(first.get("total")).toBe(String(12 * MIB));
    expect(first.get("mime")).toBe("video/mp4");
    expect(first.get("filename")).toBe("Min film.mp4");
    expect(first.has("fileId")).toBeFalse();
    expect(first.has("token")).toBeFalse();

    const ranges = [1, 2].map((call) => {
      const form = sentForm(call);
      return [
        form.get("fileId"),
        form.get("token"),
        form.get("start"),
        form.get("end"),
      ];
    });
    expect(ranges).toEqual([
      ["f1", "t1", String(CHUNK), String(2 * CHUNK - 1)],
      ["f1", "t1", String(2 * CHUNK), String(12 * MIB - 1)],
    ]);
    expect(progress).toEqual([5 / 12, 10 / 12, 1]);
  });

  it("uploadMediaFile chunks into the media bucket", async () => {
    answers = [
      { body: { fileId: "f1", token: "t1" } },
      { body: { fileId: "f1", url: "u" } },
    ];
    expect(await uploadMediaFile(video(CHUNK + 1))).toEqual({
      fileId: "f1",
      url: "u",
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/upload?bucket=media&chunk=1"
    );
  });

  it("stops at the first refused chunk and returns its message", async () => {
    answers = [
      { body: { fileId: "f1", token: "t1" } },
      { body: { error: "Upload token is not valid" }, status: 403 },
    ];
    const result = await uploadFile(video(12 * MIB), { bucket: "media" });
    expect(result).toEqual({ error: "Upload token is not valid" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("says the session expired when a chunk answers 401", async () => {
    answers = [{ body: { error: "Unauthorized" }, status: 401 }];
    const result = await uploadFile(video(12 * MIB), { bucket: "media" });
    expect(result.error).toMatch(SESSION_EXPIRED);
  });

  it("never throws on a network failure mid-upload", async () => {
    answers = [{ body: { fileId: "f1", token: "t1" } }, new Error("offline")];
    const result = await uploadFile(video(12 * MIB), { bucket: "media" });
    expect(result.error).toMatch(CHECK_CONNECTION);
  });

  it("refuses a last chunk answer without a url", async () => {
    answers = [
      { body: { fileId: "f1", token: "t1" } },
      { body: { fileId: "f1" } },
    ];
    const result = await uploadFile(video(CHUNK + 1), { bucket: "media" });
    expect(result.error).toBeString();
  });
});

describe("uploadFile in one request", () => {
  it("sends a file of exactly 5 MiB as today's single request", async () => {
    answers = [{ body: { fileId: "f1", url: "u" } }];
    const file = video(CHUNK, "Min film.mp4");
    const progress: number[] = [];

    const result = await uploadFile(file, {
      bucket: "media",
      onProgress: (fraction) => progress.push(fraction),
    });

    expect(result).toEqual({ fileId: "f1", url: "u" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/upload?bucket=media");
    expect(init?.body).toBe(file);
    expect(init?.headers).toEqual({
      "Content-Type": "video/mp4",
      "x-filename": encodeURIComponent("Min film.mp4"),
    });
    expect(progress).toEqual([1]);
  });

  it("keeps a bucket written with the editor's session to one request", async () => {
    answers = [{ body: { fileId: "f1", url: "u" } }];
    const image = new File([new Uint8Array(8 * MIB)], "a.png", {
      type: "image/png",
    });
    expect(await uploadFile(image)).toEqual({ fileId: "f1", url: "u" });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/upload");
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(image);
  });
});
