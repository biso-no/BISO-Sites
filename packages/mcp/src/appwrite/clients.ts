/**
 * The backend client bundle.
 *
 * Three clients with deliberately different authority:
 *
 * - `user` — the caller's own credential, or an anonymous client when none is
 *   configured. Appwrite applies the caller's own row permissions. This is the
 *   default for every read.
 * - `anonymous` — never carries a credential. Used by public-discovery tools so
 *   "is this actually visible to a signed-out visitor?" is answered by the
 *   backend rather than by a filter this package remembered to write.
 * - `elevated` — the service key, present only when one is configured. Bypasses
 *   row security. Reached exclusively through {@link requireElevated}, which
 *   takes the reason as an argument so every use is named at the call site and
 *   appears in the audit record.
 *
 * Why an elevated client is needed at all: several legitimate operations cannot
 * run under the caller's own permissions even when the caller is authorized.
 * `pages`/`page_translations` grant update only to Operations Unit and the
 * owning department team — never the campus team — so a campus admin publishing
 * a page is refused by RLS despite being the right person; `@repo/api`'s own
 * `publishPage` documents this and uses the admin client for the same reason.
 * `webshop_products` grants no `update` at all. The rule here is that
 * application-level authorization runs FIRST, on the principal, and the
 * elevated client only performs the write that check already permitted.
 */

import { type AppwriteClients, createAppwriteClients } from "@repo/api/runtime";
import type { ServerConfig } from "../config/env";
import { unavailable } from "../runtime/errors";
import type { Logger } from "../runtime/logger";

export interface BackendClients {
  /** Always credential-free. */
  anonymous: AppwriteClients;
  /** True when a service key was configured. */
  hasElevated: boolean;
  /** True when a user credential (JWT or session) was configured. */
  hasUserCredential: boolean;
  /**
   * The service-key client.
   *
   * `reason` is required and recorded. Throws `unavailable` when no service key
   * is configured, so a capability that needs one reports that plainly instead
   * of failing as a permission error.
   */
  requireElevated(reason: string): AppwriteClients;
  /** The caller's credential, or anonymous when none is configured. */
  user: AppwriteClients;
}

export function createBackendClients(
  config: ServerConfig,
  logger: Logger
): BackendClients {
  const shared = {
    endpoint: config.appwrite.endpoint,
    project: config.appwrite.project,
    requestTimeoutMs: config.appwrite.requestTimeoutMs,
    slowRequestMs: config.appwrite.slowRequestMs,
    onTiming: (event: {
      client: string;
      request: string;
      durationMs: number;
      outcome: string;
      slow: boolean;
    }) => {
      if (event.outcome === "timeout") {
        logger.error("Appwrite request timed out", event);
        return;
      }
      if (event.slow) {
        logger.warn("Slow Appwrite request", event);
        return;
      }
      logger.debug("Appwrite request", event);
    },
  };

  const anonymous = createAppwriteClients({
    ...shared,
    credential: { kind: "anonymous" },
  });

  const credential = config.appwrite.userCredential;
  const user = credential
    ? createAppwriteClients({ ...shared, credential })
    : anonymous;

  let elevated: AppwriteClients | null = null;
  if (config.appwrite.apiKey) {
    elevated = createAppwriteClients({
      ...shared,
      credential: { kind: "apiKey", apiKey: config.appwrite.apiKey },
    });
  }

  return {
    user,
    anonymous,
    hasUserCredential: credential !== null,
    hasElevated: elevated !== null,
    requireElevated(reason: string): AppwriteClients {
      if (!elevated) {
        throw unavailable(
          "This operation needs the service-key client, which is not configured.",
          { reason },
          "Set BISO_MCP_APPWRITE_API_KEY. The caller's own permissions are still checked first; the service key only performs a write that check already allowed."
        );
      }
      logger.debug("Using elevated client", { reason });
      return elevated;
    },
  };
}
