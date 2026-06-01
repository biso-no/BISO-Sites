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

// Env-driven so the browser client can target staging/preview Appwrite,
// matching server.ts. Falls back to the production project/endpoint.
const APPWRITE_PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT || "biso";
const NEXT_PUBLIC_APPWRITE_ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://appwrite.biso.no/v1";

export const clientSideClient = new Client()
  .setEndpoint(NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT);

// For client-side usage we keep the Document Database helper for components
// that call listDocuments/getDocument, etc.
export const clientDatabase = new Databases(clientSideClient);
export const clientStorage = new Storage(clientSideClient);
export const clientAccount = new Account(clientSideClient);
export const clientFunctions = new Functions(clientSideClient);
