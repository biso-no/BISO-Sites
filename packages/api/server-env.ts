/**
 * Where the server clients reach Appwrite, and with which service key. Lives
 * outside `server.ts` because that file is `"use server"`, and so may export
 * only async functions (and an exported sync key reader there would be a
 * server action handing out the key). `storage-chunks.ts` and the admin's
 * upload token (`@repo/api/server-env`) need the same values, so the key is
 * resolved the same way everywhere. Server code only: in a browser bundle
 * the key is simply undefined. No `server-only` marker here: `server.ts`
 * imports this file, and tests across the apps load `server.ts` as is.
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
