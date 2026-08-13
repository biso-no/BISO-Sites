"use server";
import { cookies } from "next/headers";
import {
  Account,
  AppwriteException,
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
          // Must be a JSON round-trip, NOT structuredClone: node-appwrite
          // responses carry non-cloneable function properties (a lazy
          // `() => JSONbig.stringify(data)` serializer) that JSON.stringify
          // silently drops but structuredClone rejects with DataCloneError.
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
const APPWRITE_PROJECT =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT ||
  process.env.APPWRITE_PROJECT_ID ||
  "biso";
const NEXT_PUBLIC_APPWRITE_ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ||
  process.env.APPWRITE_ENDPOINT ||
  "https://appwrite.biso.no/v1";
const SESSION_COOKIE_NAME =
  process.env.APPWRITE_SESSION_COOKIE || "a_session_biso";
/**
 * Read-only fallback for an app that has renamed its session cookie. Sessions
 * issued under the previous name keep resolving until the old cookie expires;
 * writes always use SESSION_COOKIE_NAME. Unset for apps that never renamed.
 */
const SESSION_COOKIE_FALLBACK_NAME =
  process.env.APPWRITE_SESSION_COOKIE_FALLBACK;
const DEFAULT_APPWRITE_REQUEST_TIMEOUT_MS = 8000;
const APPWRITE_TIMEOUT_ERROR_TYPE = "appwrite_timeout";
const APPWRITE_REQUEST_TIMEOUT_MS = readPositiveInteger(
  process.env.APPWRITE_REQUEST_TIMEOUT_MS,
  DEFAULT_APPWRITE_REQUEST_TIMEOUT_MS
);

type AppwriteRequestOptions = RequestInit & {
  agent?: unknown;
  dispatcher?: unknown;
};

type SharedTransport = Pick<AppwriteRequestOptions, "agent" | "dispatcher">;

const sharedTransports = new Map<string, SharedTransport>();

function readPositiveInteger(
  value: string | undefined,
  fallback: number
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getTransportKey(client: Client): string {
  return `${client.config.endpoint}|selfSigned:${client.config.selfSigned}`;
}

function getSharedTransport(
  client: Client,
  options: AppwriteRequestOptions
): SharedTransport {
  const key = getTransportKey(client);
  const cached = sharedTransports.get(key);

  if (cached) {
    return cached;
  }

  const transport = {
    agent: options.agent,
    dispatcher: options.dispatcher,
  };

  sharedTransports.set(key, transport);
  return transport;
}

function createTimeoutSignal(): AbortSignal {
  if (typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(APPWRITE_REQUEST_TIMEOUT_MS);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, APPWRITE_REQUEST_TIMEOUT_MS);
  timeout.unref?.();
  return controller.signal;
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

function configureServerClient(client: Client): Client {
  const prepareRequest = client.prepareRequest.bind(client);
  const call = client.call.bind(client);

  client.prepareRequest = (method, url, headers, params) => {
    const request = prepareRequest(method, url, headers, params);
    const options = request.options as AppwriteRequestOptions;
    const transport = getSharedTransport(client, options);

    return {
      uri: request.uri,
      options: {
        ...options,
        ...transport,
        signal: createTimeoutSignal(),
      },
    };
  };

  client.call = async (...args: Parameters<Client["call"]>) => {
    try {
      return await call(...args);
    } catch (error) {
      if (isAbortError(error)) {
        throw new AppwriteException(
          `Appwrite request timed out after ${APPWRITE_REQUEST_TIMEOUT_MS}ms`,
          504,
          APPWRITE_TIMEOUT_ERROR_TYPE
        );
      }

      throw error;
    }
  };

  return client;
}

export async function createSessionClient(jwt?: string) {
  const client = configureServerClient(
    new Client()
      .setEndpoint(NEXT_PUBLIC_APPWRITE_ENDPOINT)
      .setProject(APPWRITE_PROJECT)
  );

  if (jwt) {
    client.setJWT(jwt);
  } else {
    const cookieStore = await cookies();
    const session =
      cookieStore.get(SESSION_COOKIE_NAME) ??
      (SESSION_COOKIE_FALLBACK_NAME
        ? cookieStore.get(SESSION_COOKIE_FALLBACK_NAME)
        : undefined);

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

/**
 * Cookie-free, unauthenticated (guest) server client. Sees exactly what an
 * anonymous visitor sees — table/row `read("any")` permissions only. Unlike
 * `createSessionClient()` it never touches `cookies()`, so it is safe to call
 * inside `"use cache"` functions, which must not read request-bound APIs.
 */
// biome-ignore lint/suspicious/useAwait: keep the same async factory shape as the other clients.
export async function createPublicClient() {
  const client = configureServerClient(
    new Client()
      .setEndpoint(NEXT_PUBLIC_APPWRITE_ENDPOINT)
      .setProject(APPWRITE_PROJECT)
  );

  return {
    get db() {
      return plainDb(new TablesDB(client));
    },
    get storage() {
      return new Storage(client);
    },
  };
}

// biome-ignore lint/suspicious/useAwait: Needs to be async.
export async function createAdminClient() {
  if (!APPWRITE_API_KEY) {
    throw new Error(
      "APPWRITE_API_KEY is not configured — admin Appwrite operations cannot run."
    );
  }
  const client = configureServerClient(
    new Client()
      .setEndpoint(NEXT_PUBLIC_APPWRITE_ENDPOINT)
      .setProject(APPWRITE_PROJECT)
      .setKey(APPWRITE_API_KEY)
  );

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
