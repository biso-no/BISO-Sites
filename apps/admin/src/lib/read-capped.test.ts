import { describe, expect, it } from "bun:test";
import { readCapped } from "./read-capped";

const KIB = 1024;

/** A body that arrives in `count` pieces of `size` bytes, sharing one buffer. */
function streamOf(count: number, size: number): ReadableStream<Uint8Array> {
  const piece = new Uint8Array(size).fill(7);
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

function post(
  body: BodyInit | null,
  headers: Record<string, string> = {}
): Request {
  return new Request("http://admin.test/api/upload", {
    body,
    headers,
    method: "POST",
  });
}

describe("readCapped", () => {
  it("reads a body under the cap whole, with or without a length", async () => {
    const withLength = await readCapped(
      post(new Uint8Array(10 * KIB), { "content-length": String(10 * KIB) }),
      10 * KIB
    );
    expect(withLength.tooLarge).toBeFalse();
    expect(withLength.bytes?.byteLength).toBe(10 * KIB);

    const withoutLength = await readCapped(post(streamOf(4, KIB)), 4 * KIB);
    expect(withoutLength.tooLarge).toBeFalse();
    expect(withoutLength.bytes?.byteLength).toBe(4 * KIB);
    expect(withoutLength.bytes?.[0]).toBe(7);
  });

  it("refuses a declared length over the cap without reading", async () => {
    const request = post(new Uint8Array(10), {
      "content-length": String(KIB + 1),
    });
    expect((await readCapped(request, KIB)).tooLarge).toBeTrue();
    expect(request.bodyUsed).toBeFalse();
  });

  it("stops once the bytes pass the cap, whatever the length claimed", async () => {
    const lying = await readCapped(
      post(streamOf(5, KIB), { "content-length": "10" }),
      4 * KIB
    );
    expect(lying.tooLarge).toBeTrue();
    const unannounced = await readCapped(post(streamOf(5, KIB)), 4 * KIB);
    expect(unannounced.tooLarge).toBeTrue();
  });

  it("stops reading a huge body early instead of buffering it", async () => {
    let pulled = 0;
    const piece = new Uint8Array(KIB);
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(piece);
      },
    });
    expect((await readCapped(post(endless), 8 * KIB)).tooLarge).toBeTrue();
    expect(pulled).toBeLessThan(20);
  });

  it("reads an empty body as no bytes", async () => {
    const result = await readCapped(post(null), KIB);
    expect(result.tooLarge).toBeFalse();
    expect(result.bytes?.byteLength).toBe(0);
  });
});
