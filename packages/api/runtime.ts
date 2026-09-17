/**
 * Framework-independent Appwrite client factory.
 *
 * `./server` is the entry point for the Next.js apps: it is a `"use server"`
 * module, it reads `next/headers` to resolve the caller's session cookie, and
 * it takes its endpoint/project/key from `process.env` at module scope. All of
 * that is correct inside a request-scoped Next.js runtime and wrong outside
 * one — a plain Node/Bun process (an MCP server, a CLI, a worker) has no
 * request scope, may need to hold more than one credential at a time, and
 * should not pull the Next runtime into its import graph.
 *
 * This module is the additive counterpart for those callers: same underlying
 * `node-appwrite` clients, same request timeout and slow-request logging
 * behaviour, but every input is passed in explicitly and nothing is read from
 * the ambient request.
 *
 * `./server` is unchanged and remains the only entry point the apps use.
 *
 * ```ts
 * const clients = createAppwriteClients({
 *   endpoint: "https://appwrite.biso.no/v1",
 *   project: "biso",
 *   credential: { kind: "jwt", jwt },
 * });
 * const row = await clients.db.getRow<Jobs>("app", "jobs", id);
 * ```
 */

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
 * How a client authenticates.
 *
 * - `anonymous` — no credential. Sees exactly what a signed-out visitor sees
 *   (`read("any")` table/row permissions only).
 * - `jwt` — an Appwrite JWT minted for one user's session. Requests carry that
 *   user's own permissions; Appwrite verifies and expires the token.
 * - `session` — a raw Appwrite session secret, equivalent to `jwt` but longer
 *   lived. Prefer `jwt` where the caller can mint one.
 * - `apiKey` — a service key. Bypasses row security entirely. This is NOT a
 *   user identity: never derive a principal, role, or scope from it.
 */
export type AppwriteCredential =
  | { kind: "anonymous" }
  | { kind: "jwt"; jwt: string }
  | { kind: "session"; session: string }
  | { kind: "apiKey"; apiKey: string };

export interface AppwriteRuntimeOptions {
  credential: AppwriteCredential;
  /** Appwrite API endpoint, e.g. `https://appwrite.biso.no/v1`. */
  endpoint: string;
  /**
   * Receives one record per Appwrite call. A standalone process must keep
   * stdout clean (an MCP server speaks JSON-RPC on it), so this module never
   * writes to the console itself — the host decides where timings go.
   */
  onTiming?: (event: AppwriteTimingEvent) => void;
  /** Appwrite project id, e.g. `biso`. */
  project: string;
  /**
   * Abort a request after this many milliseconds. Matches `./server`'s
   * default so both entry points fail the same way under a slow backend.
   */
  requestTimeoutMs?: number;
  /**
   * Requests at or above this duration are reported to {@link onTiming}.
   * Defaults to 2000ms, matching `./server`.
   */
  slowRequestMs?: number;
}

export interface AppwriteTimingEvent {
  /** Which credential kind issued the call. */
  client: AppwriteCredential["kind"];
  durationMs: number;
  outcome: "ok" | "error" | "timeout";
  /** `METHOD /path`, query string stripped (it carries row filters). */
  request: string;
  /** True when the call was at or above `slowRequestMs`. */
  slow: boolean;
}

export interface AppwriteClients {
  account: Account;
  /** The credential kind this bundle was built with. */
  credentialKind: AppwriteCredential["kind"];
  db: TablesDB;
  functions: Functions;
  messaging: Messaging;
  storage: Storage;
  teams: Teams;
  /**
   * The Appwrite Users API, which only exists on a service-key client.
   * `null` for every other credential kind.
   */
  users: Users | null;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 8000;
const DEFAULT_SLOW_REQUEST_MS = 2000;
const V1_PREFIX_REGEX = /^\/v1\//;
const APPWRITE_TIMEOUT_ERROR_TYPE = "appwrite_timeout";

/** `METHOD /path` for logs and error messages; the `/v1` prefix is implied. */
function describeRequest(method: string, url: URL | string): string {
  try {
    const { pathname } = typeof url === "string" ? new URL(url) : url;
    return `${method.toUpperCase()} ${pathname.replace(V1_PREFIX_REGEX, "/")}`;
  } catch {
    return method.toUpperCase();
  }
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

type PreparedRequest = ReturnType<Client["prepareRequest"]>;
type RequestOptions = PreparedRequest["options"] & {
  agent?: unknown;
  dispatcher?: unknown;
};
type SharedTransport = Pick<RequestOptions, "agent" | "dispatcher">;

/**
 * Connection pooling is per endpoint, not per client: a process that builds a
 * fresh client per request would otherwise open a new pool every time.
 */
const sharedTransports = new Map<string, SharedTransport>();

function getSharedTransport(
  client: Client,
  options: RequestOptions
): SharedTransport {
  const key = `${client.config.endpoint}|selfSigned:${client.config.selfSigned}`;
  const cached = sharedTransports.get(key);
  if (cached) {
    return cached;
  }
  const transport = { agent: options.agent, dispatcher: options.dispatcher };
  sharedTransports.set(key, transport);
  return transport;
}

function createTimeoutSignal(timeoutMs: number): AbortSignal {
  if (typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();
  return controller.signal;
}

function instrument(
  client: Client,
  kind: AppwriteCredential["kind"],
  timeoutMs: number,
  slowMs: number,
  onTiming: ((event: AppwriteTimingEvent) => void) | undefined
): Client {
  const prepareRequest = client.prepareRequest.bind(client);
  const call = client.call.bind(client);
  const redirect = client.redirect.bind(client);

  client.prepareRequest = (method, url, requestHeaders, params) => {
    const request = prepareRequest(method, url, requestHeaders, params);
    const options = request.options as RequestOptions;
    return {
      uri: request.uri,
      options: {
        ...options,
        ...getSharedTransport(client, options),
        signal: createTimeoutSignal(timeoutMs),
      },
    };
  };

  const report = (
    request: string,
    startedAt: number,
    outcome: AppwriteTimingEvent["outcome"]
  ) => {
    // `performance.now()` is monotonic, so a wall-clock step mid-request (an
    // NTP correction, a container clock sync) cannot make a duration wrong or
    // negative. `./server` switched to it for a Next-specific reason — reading
    // the wall clock during a Cache Components prerender fails the render —
    // which cannot happen out here. The reason to match is the simpler one:
    // this module documents itself as having the same slow-request logging
    // behaviour, and monotonic is the right clock for an elapsed time anyway.
    //
    // Rounded because `durationMs` reaches an `audit_logs` row through
    // `@repo/mcp`, and a fractional millisecond there is noise, not precision.
    const durationMs = Math.round(performance.now() - startedAt);
    onTiming?.({
      client: kind,
      request,
      durationMs,
      outcome,
      slow: durationMs >= slowMs,
    });
  };

  const wrap = <A extends unknown[], R>(
    inner: (...args: A) => Promise<R>,
    describe: (args: A) => string
  ) => {
    return async (...args: A): Promise<R> => {
      const request = describe(args);
      const startedAt = performance.now();
      try {
        const result = await inner(...args);
        report(request, startedAt, "ok");
        return result;
      } catch (error) {
        if (isAbortError(error)) {
          report(request, startedAt, "timeout");
          throw new AppwriteException(
            `Appwrite request timed out after ${timeoutMs}ms (${kind} ${request})`,
            504,
            APPWRITE_TIMEOUT_ERROR_TYPE
          );
        }
        report(request, startedAt, "error");
        throw error;
      }
    };
  };

  client.call = wrap(call, (args: Parameters<Client["call"]>) =>
    describeRequest(args[0], args[1])
  ) as Client["call"];
  client.redirect = wrap(redirect, (args: Parameters<Client["redirect"]>) =>
    describeRequest(args[0], args[1])
  ) as Client["redirect"];

  return client;
}

function applyCredential(client: Client, credential: AppwriteCredential): void {
  switch (credential.kind) {
    case "jwt":
      client.setJWT(credential.jwt);
      break;
    case "session":
      client.setSession(credential.session);
      break;
    case "apiKey":
      client.setKey(credential.apiKey);
      break;
    default:
      // anonymous — no credential is applied on purpose.
      break;
  }
}

/**
 * Build an Appwrite client bundle from explicit configuration.
 *
 * Unlike `./server`'s factories this is synchronous, reads nothing from the
 * environment or the ambient request, and can be called many times in one
 * process with different credentials.
 *
 * Note the deliberate omission of `./server`'s `plainDb` proxy: that exists so
 * SDK class instances survive the RSC → Client Component boundary, which does
 * not apply outside Next.js. Callers here get the SDK's own return values.
 */
export function createAppwriteClients(
  options: AppwriteRuntimeOptions
): AppwriteClients {
  const {
    endpoint,
    project,
    credential,
    requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    slowRequestMs = DEFAULT_SLOW_REQUEST_MS,
    onTiming,
  } = options;

  if (!endpoint) {
    throw new Error("createAppwriteClients: `endpoint` is required");
  }
  if (!project) {
    throw new Error("createAppwriteClients: `project` is required");
  }

  const client = instrument(
    new Client().setEndpoint(endpoint).setProject(project),
    credential.kind,
    requestTimeoutMs,
    slowRequestMs,
    onTiming
  );
  applyCredential(client, credential);

  return {
    account: new Account(client),
    db: new TablesDB(client),
    functions: new Functions(client),
    messaging: new Messaging(client),
    storage: new Storage(client),
    teams: new Teams(client),
    users: credential.kind === "apiKey" ? new Users(client) : null,
    credentialKind: credential.kind,
  };
}

/** True when an error is the timeout this module raises. */
export function isAppwriteTimeout(error: unknown): boolean {
  return (
    error instanceof AppwriteException &&
    error.type === APPWRITE_TIMEOUT_ERROR_TYPE
  );
}

/** Appwrite's HTTP status for an error, when it carries one. */
export function appwriteStatus(error: unknown): number | null {
  return error instanceof AppwriteException ? error.code : null;
}
