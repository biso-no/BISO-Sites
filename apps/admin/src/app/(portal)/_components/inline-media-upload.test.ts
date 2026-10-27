import { expect, mock, test } from "bun:test";
import type { InlineMediaUpload } from "@/lib/inline-media";
import { uploadInlineMedia } from "./inline-media-upload";

const MIB = 1024 * 1024;
const CHUNK = 5 * MIB;

function fetcherAnswering(answers: { body: unknown; status?: number }[]) {
  return mock((_url: RequestInfo | URL, _init?: RequestInit) => {
    const next = answers.shift();
    return next
      ? Promise.resolve(
          Response.json(next.body, { status: next.status ?? 200 })
        )
      : Promise.reject(new Error("unexpected request"));
  });
}

const UPLOADED: InlineMediaUpload = {
  fileId: "f1",
  fileName: "Podcast.mp3",
  mediaKind: "audio",
  mimeType: "audio/mpeg",
  size: 12 * MIB,
  url: "https://appwrite.test/view",
};

test("a file over 5 MiB goes up in chunks of the shared protocol", async () => {
  const fetcher = fetcherAnswering([
    { body: { fileId: "f1", token: "t1" } },
    { body: { fileId: "f1" } },
    { body: { file: UPLOADED } },
  ]);
  const file = new File([new Uint8Array(12 * MIB)], "Podcast.mp3", {
    type: "audio/mpeg",
  });

  expect(await uploadInlineMedia(file, fetcher)).toEqual(UPLOADED);
  expect(fetcher).toHaveBeenCalledTimes(3);
  const calls = fetcher.mock.calls.map(([url, init]) => {
    const form = init?.body as FormData;
    return [
      url,
      (form.get("chunk") as Blob).size,
      form.get("start"),
      form.get("mime"),
    ];
  });
  expect(calls).toEqual([
    ["/api/media/upload?chunk=1", CHUNK, null, "audio/mpeg"],
    ["/api/media/upload?chunk=1", CHUNK, String(CHUNK), "audio/mpeg"],
    ["/api/media/upload?chunk=1", 2 * MIB, String(2 * CHUNK), "audio/mpeg"],
  ]);
});

test("a file of 5 MiB or less keeps the single request", async () => {
  const fetcher = fetcherAnswering([
    { body: { file: { ...UPLOADED, size: CHUNK } } },
  ]);
  const file = new File([new Uint8Array(CHUNK)], "Podcast.mp3", {
    type: "audio/mpeg",
  });

  await uploadInlineMedia(file, fetcher);

  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, init] = fetcher.mock.calls[0] ?? [];
  expect(url).toBe("/api/media/upload");
  expect(init?.body).toBe(file);
  expect(init?.headers).toEqual({
    "content-type": "audio/mpeg",
    "x-filename": "Podcast.mp3",
  });
});

test("a refused chunk throws the route's message", async () => {
  const fetcher = fetcherAnswering([
    { body: { fileId: "f1", token: "t1" } },
    { body: { error: "Upload token is not valid" }, status: 403 },
  ]);
  const file = new File([new Uint8Array(12 * MIB)], "Podcast.mp3", {
    type: "audio/mpeg",
  });

  await expect(uploadInlineMedia(file, fetcher)).rejects.toThrow(
    "Upload token is not valid"
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
});
