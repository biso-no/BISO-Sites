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
  principal: Principal;
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
