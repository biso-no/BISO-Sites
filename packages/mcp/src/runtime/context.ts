/**
 * The context every tool receives.
 *
 * This is the explicit, typed replacement for the admin assistant's
 * `AssistantActionDeps = Record<string, (...args: unknown[]) => Promise<unknown>>`.
 * That shape compiles regardless of whether a dependency exists, takes the
 * arguments a tool passes, or returns what the tool expects; every call site
 * has to cast, and a missing key is a runtime `TypeError` rather than a build
 * error. Here, services are named interfaces on a concrete object, so a tool
 * that reaches for something the server did not wire fails to typecheck.
 */

import type { BackendClients } from "../appwrite/clients";
import type { ServerConfig } from "../config/env";
import type { Principal } from "../identity/principal";
import type { Services } from "../services/index";
import type { Auditor } from "./audit";
import type { Logger } from "./logger";
import type { MutationGateOptions } from "./mutation";

/**
 * What a mutating call actually touched, for the persisted `audit_logs` row.
 *
 * `logAuditEvent` in `apps/admin` writes a specific action (`page_unpublished`)
 * with the resource's id and type; the dispatcher here only knows the tool's
 * name and tier, which made every publish and unpublish through
 * `biso_content_set_lifecycle` an identical row. The proposal already carries
 * both, so it reports them rather than the dispatcher guessing.
 *
 * Recorded at the one chokepoint every executable mutation passes through, so
 * a tool cannot forget to describe itself — a mutation that does not go
 * through the proposal gate is not a mutation this server can execute.
 */
export interface MutationNote {
  /** Dotted operation, e.g. `content.publish`. */
  action: string;
  /** The rows the change touches. Concrete ids, never a filter. */
  targets: ReadonlyArray<{ table: string; id: string; label?: string }>;
}

export interface ToolContext {
  auditor: Auditor;
  clients: BackendClients;
  config: ServerConfig;
  /**
   * Ask the MCP host to confirm a change with a human.
   *
   * Resolves `true` only on an explicit `accept`. Returns `false` when the
   * client has no elicitation capability, when the user declines or cancels, or
   * when the round-trip fails — every one of those is "not confirmed".
   */
  confirmWithHuman(request: {
    title: string;
    message: string;
  }): Promise<boolean>;
  /** Deep link builders for the two apps. */
  links: {
    web(path: string): string;
    admin(path: string): string;
  };
  logger: Logger;
  /** Everything the mutation gate needs, resolved once at connect time. */
  mutation: MutationGateOptions;
  /**
   * Where the mutation gate reports {@link MutationNote}. Supplied per call by
   * the dispatcher; absent in contexts built for tests that never dispatch.
   */
  noteMutation?(note: MutationNote): void;
  /**
   * The principal this call authorizes against.
   *
   * Refreshed by the tool runner before each call — see `refreshPrincipal`.
   * Handlers read it and never re-resolve it themselves.
   */
  principal: Principal;
  /**
   * Re-resolve the caller's memberships.
   *
   * `force` is passed for every mutating call, because a mutation executes
   * through the service-key client and Appwrite therefore cannot enforce a
   * revocation that happened after this process started.
   */
  refreshPrincipal(options?: { force?: boolean }): Promise<Principal>;
  services: Services;
}

export function buildLinks(config: ServerConfig): ToolContext["links"] {
  const join = (base: string, path: string) =>
    `${base}${path.startsWith("/") ? path : `/${path}`}`;
  return {
    web: (path) => join(config.links.web, path),
    admin: (path) => join(config.links.admin, path),
  };
}
