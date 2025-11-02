import { Client, Account, ID, Databases, Storage, Functions, Query, OAuthProvider, Realtime } from "appwrite";

// Re-export runtime classes and helpers so apps can import from '@repo/api/client'
export { Client, Account, ID, Databases, Storage, Functions, Query, OAuthProvider, Realtime } from "appwrite";
// Re-export types (type-only) used by client code
export type { Models, RealtimeResponseEvent, Payload } from "appwrite";

const APPWRITE_PROJECT = "biso";
const NEXT_PUBLIC_APPWRITE_ENDPOINT = "https://appwrite.biso.no/v1";

export const clientSideClient = new Client()
        .setEndpoint(NEXT_PUBLIC_APPWRITE_ENDPOINT)
        .setProject(APPWRITE_PROJECT)


// For client-side usage we keep the Document Database helper for components
// that call listDocuments/getDocument, etc.
export const clientDatabase = new Databases(clientSideClient);
export const clientStorage = new Storage(clientSideClient);
export const clientAccount = new Account(clientSideClient);
export const clientFunctions = new Functions(clientSideClient);
