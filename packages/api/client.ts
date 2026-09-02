import { Account, Client, Databases, Functions, Storage } from "appwrite";

// Re-export types (type-only) used by client code
export type { Models, Payload, RealtimeResponseEvent } from "appwrite";

// Re-export runtime classes and helpers so apps can import from '@repo/api/client'
export {
  Account,
  Client,
  Databases,
  Functions,
  ID,
  OAuthProvider,
  Query,
  Realtime,
  Storage,
} from "appwrite";

// Appwrite backend configuration.
//
// These identify the Appwrite installation/project and should NOT be confused
// with the URL of the frontend deployment.
const APPWRITE_PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT || "biso";

const APPWRITE_ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://appwrite.biso.no/v1";

/**
 * Returns the URL of the frontend deployment currently running in the browser.
 *
 * Examples:
 * - https://admin.biso.no
 * - https://<preview-domain>
 * - http://localhost:3000
 *
 * Do not resolve this at module scope because this module may also be evaluated
 * during SSR/building, where `window` does not exist.
 */
export function getBaseUrl(): string {
  if (typeof window === "undefined") {
    throw new Error(
      "getBaseUrl() can only be called in the browser. Use the server-side getBaseUrl() from server.ts instead."
    );
  }

  return window.location.origin;
}

export const clientSideClient = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT);

export const clientDatabase = new Databases(clientSideClient);
export const clientStorage = new Storage(clientSideClient);
export const clientAccount = new Account(clientSideClient);
export const clientFunctions = new Functions(clientSideClient);
