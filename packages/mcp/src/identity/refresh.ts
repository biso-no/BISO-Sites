/**
 * Keeping the principal current.
 *
 * `resolvePrincipal` reads the caller's account and team memberships, and the
 * roles derived from those memberships are what every authorization check in
 * this package runs against. Resolving once at startup makes that snapshot
 * permanent for the life of the process — and a stdio server lives as long as
 * the MCP host that spawned it, which can be hours.
 *
 * That matters more here than it would in a request-scoped app, because a
 * mutation this package authorizes is then *executed* through the service-key
 * client. Appwrite never sees the user's identity on that write, so it cannot
 * apply the revocation itself. The application-side check is the only check,
 * and a stale one authorizes work the organisation has already withdrawn.
 *
 * So: a short TTL for reads, which the user's own credential still gates, and a
 * forced re-resolve before anything that can reach the elevated client.
 */

import type { BackendClients } from "../appwrite/clients";
import type { Logger } from "../runtime/logger";
import type { Principal } from "./principal";
import { resolvePrincipal } from "./resolve";

/** How long a resolved principal may be reused for a read. */
export const PRINCIPAL_TTL_MS = 60_000;

export interface PrincipalCache {
  /** The last resolved principal, without a round trip. */
  current(): Principal;
  /**
   * Re-resolve if the cached value is older than the TTL.
   *
   * `force` ignores the TTL and is used for every mutating call. A forced
   * refresh that fails **throws**: if the current memberships cannot be
   * confirmed, the safe answer is to not act on the remembered ones. An
   * unforced refresh that fails keeps the cached value and logs, because the
   * caller's own credential still gates whatever the read returns.
   */
  refresh(options?: { force?: boolean }): Promise<Principal>;
}

export function createPrincipalCache(input: {
  clients: BackendClients;
  /**
   * True when `initial` was supplied rather than resolved.
   *
   * A caller-injected principal has no memberships to go back to — re-resolving
   * would silently replace the identity the caller asked for with a different
   * one. It is held as given.
   */
  fixed?: boolean;
  initial: Principal;
  logger: Logger;
  now?: () => number;
}): PrincipalCache {
  const now = input.now ?? (() => Date.now());
  let principal = input.initial;
  let resolvedAt = now();

  return {
    current() {
      return principal;
    },
    async refresh(options) {
      const force = options?.force ?? false;
      // Nothing to re-resolve: an injected principal is authoritative by
      // definition, an anonymous session has no memberships, and without a user
      // credential there is no one to ask.
      if (input.fixed || !input.clients.hasUserCredential) {
        return principal;
      }
      if (!force && now() - resolvedAt < PRINCIPAL_TTL_MS) {
        return principal;
      }
      try {
        principal = await resolvePrincipal(input.clients, input.logger);
        resolvedAt = now();
        return principal;
      } catch (error) {
        if (force) {
          throw error;
        }
        input.logger.warn(
          "Could not refresh the principal; continuing with the cached one",
          { error: error instanceof Error ? error.message : String(error) }
        );
        return principal;
      }
    },
  };
}
