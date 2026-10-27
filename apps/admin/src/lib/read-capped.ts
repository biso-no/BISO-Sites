import { readContentLength } from "./upload-buckets";

/** The body, or the news that it was over the cap. */
export type CappedBody =
  | { bytes: Uint8Array<ArrayBuffer>; tooLarge: false }
  | { bytes?: never; tooLarge: true };

/**
 * Reads at most `maxBytes` of a request body. A declared `content-length`
 * over the cap is refused without reading. A missing or invalid one is
 * tolerated: the bytes are counted as they arrive, and reading stops as soon
 * as they pass the cap, whatever the header claimed. So an upload route never
 * holds more than its limit in memory.
 */
export async function readCapped(
  request: Request,
  maxBytes: number
): Promise<CappedBody> {
  const declared = readContentLength(request.headers);
  if (declared !== null && declared > maxBytes) {
    return { tooLarge: true };
  }
  if (!request.body) {
    return { bytes: new Uint8Array(0), tooLarge: false };
  }

  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  let next = await reader.read();
  while (!next.done) {
    size += next.value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return { tooLarge: true };
    }
    parts.push(next.value);
    // The body arrives in order; each read waits for the next piece.
    next = await reader.read();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return { bytes, tooLarge: false };
}
