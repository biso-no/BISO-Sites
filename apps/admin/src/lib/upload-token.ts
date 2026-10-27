import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { resolveApiKey } from "@repo/api/server-env";

/**
 * Server-only. Signs the terms of a chunked upload when its first chunk is
 * accepted, so every later chunk must carry the same file, bucket, type, total
 * size, name and editor, or be refused before it reaches Appwrite.
 *
 * The signing key is derived from the service key (HMAC-SHA256 of a fixed
 * label, keyed by the API key), read with the admin client's own
 * `resolveApiKey` (`APPWRITE_API_KEY`, else `APPWRITE_FUNCTION_API_KEY`), so
 * the two never disagree. It is a secret the admin server already holds and
 * requires at startup, so no new env var is needed. The label keeps the
 * derived key distinct from the API key and from any other use of it. Rotating
 * the API key invalidates uploads in flight, which then simply fail.
 *
 * The message is a JSON array, so no value can bleed into its neighbour.
 */

const KEY_LABEL = "biso-admin/chunked-upload-token/v1";

/**
 * Long enough for 250 MB over a slow connection; the token is bound to one
 * editor and one file either way.
 */
export const UPLOAD_TOKEN_TTL_MS = 6 * 60 * 60 * 1000;

const TOKEN_REGEX = /^(\d{1,16})\.([A-Za-z0-9_-]{43})$/;

export interface UploadTokenClaims {
  bucketId: string;
  fileId: string;
  filename: string;
  mime: string;
  total: number;
  userId: string;
}

interface UploadTokenOptions {
  now?: number;
  /** Defaults to the service key, as the admin client resolves it. */
  secret?: string;
}

function resolveSecret(secret: string | undefined): string {
  const value = secret ?? resolveApiKey();
  if (!value) {
    throw new Error(
      "APPWRITE_API_KEY is not configured — upload tokens cannot be signed."
    );
  }
  return value;
}

function sign(
  claims: UploadTokenClaims,
  expiresAt: number,
  secret: string
): Buffer {
  const key = createHmac("sha256", secret).update(KEY_LABEL).digest();
  const message = JSON.stringify([
    claims.fileId,
    claims.bucketId,
    claims.mime,
    claims.total,
    claims.filename,
    claims.userId,
    expiresAt,
  ]);
  return createHmac("sha256", key).update(message).digest();
}

export function createUploadToken(
  claims: UploadTokenClaims,
  options: UploadTokenOptions = {}
): string {
  const secret = resolveSecret(options.secret);
  const expiresAt = (options.now ?? Date.now()) + UPLOAD_TOKEN_TTL_MS;
  return `${expiresAt}.${sign(claims, expiresAt, secret).toString("base64url")}`;
}

/** True only for an unexpired token issued for exactly these terms. */
export function verifyUploadToken(
  token: string,
  claims: UploadTokenClaims,
  options: UploadTokenOptions = {}
): boolean {
  const match = TOKEN_REGEX.exec(token);
  if (!match) {
    return false;
  }
  const expiresAt = Number(match[1]);
  if (expiresAt <= (options.now ?? Date.now())) {
    return false;
  }
  const given = Buffer.from(match[2] ?? "", "base64url");
  const expected = sign(claims, expiresAt, resolveSecret(options.secret));
  return given.length === expected.length && timingSafeEqual(given, expected);
}
