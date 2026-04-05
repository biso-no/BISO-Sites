"use server";
import { cookies } from "next/headers";
import {
  Account,
  Client,
  Functions,
  Messaging,
  Storage,
  TablesDB,
  Teams,
  Users,
} from "node-appwrite";

/**
 * Wrap a TablesDB instance so that listRows and getRow return plain objects
 * instead of Appwrite SDK class instances, which Next.js cannot serialize
 * across the RSC → Client Component boundary.
 */
function plainDb(db: TablesDB): TablesDB {
  return new Proxy(db, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (
        (prop === "listRows" || prop === "getRow") &&
        typeof value === "function"
      ) {
        return async (...args: unknown[]) => {
          const result = await (value as (...a: unknown[]) => unknown).apply(
            target,
            args
          );
          return JSON.parse(JSON.stringify(result));
        };
      }
      if (typeof value === "function") {
        return value.bind(target);
      }
      return value;
    },
  });
}

const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
const APPWRITE_PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT || "biso";
const NEXT_PUBLIC_APPWRITE_ENDPOINT =
  process.env.NEXT_PUBLIC_NEXT_PUBLIC_APPWRITE_ENDPOINT ||
  "https://appwrite.biso.no/v1";

export async function createSessionClient(jwt?: string) {
  const client = new Client()
    .setEndpoint(NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT);

  if (jwt) {
    client.setJWT(jwt);
  } else {
    const session =
      (await cookies()).get("a_session_biso") ||
      (await cookies()).get("a_session_biso_admin");

    if (session) {
      client.setSession(session.value);
    }
  }

  return {
    get account() {
      return new Account(client);
    },
    get db() {
      return plainDb(new TablesDB(client));
    },
    get teams() {
      return new Teams(client);
    },
    get storage() {
      return new Storage(client);
    },
    get functions() {
      return new Functions(client);
    },
    get messaging() {
      return new Messaging(client);
    },
  };
}

// biome-ignore lint/suspicious/useAwait: Needs to be async.
export async function createAdminClient() {
  const client = new Client()
    .setEndpoint(NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT)
    .setKey(APPWRITE_API_KEY!);

  return {
    get account() {
      return new Account(client);
    },
    get db() {
      return plainDb(new TablesDB(client));
    },
    get teams() {
      return new Teams(client);
    },
    get storage() {
      return new Storage(client);
    },
    get users() {
      return new Users(client);
    },
    get functions() {
      return new Functions(client);
    },
    get messaging() {
      return new Messaging(client);
    },
  };
}
