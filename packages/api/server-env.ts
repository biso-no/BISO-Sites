/**
 * Where the server clients reach Appwrite, and with which service key. Lives
 * outside `server.ts` because that file is `"use server"`, and so may export
 * only async functions; `storage-chunks.ts` needs the same values. Not a
 * package export: nothing outside `packages/api` should read the key.
 */

/**
 * Read on every call, not at module load: inside an Appwrite Function the key
 * arrives per execution (the `x-appwrite-key` header, which the function copies
 * into `APPWRITE_FUNCTION_API_KEY`) — after this module has been imported. The
 * injected `APPWRITE_FUNCTION_API_KEY` env var itself only exists at build time.
 */
export function resolveApiKey(): string | undefined {
  return process.env.APPWRITE_API_KEY || process.env.APPWRITE_FUNCTION_API_KEY;
}

export const APPWRITE_PROJECT =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT ||
  process.env.APPWRITE_PROJECT_ID ||
  "biso";

export const NEXT_PUBLIC_APPWRITE_ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ||
  process.env.APPWRITE_ENDPOINT ||
  "https://appwrite.biso.no/v1";
