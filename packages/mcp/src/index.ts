/**
 * `@repo/mcp` — a permission-aware Model Context Protocol server over BISO's
 * business capabilities.
 *
 * The package is a library first and a binary second: `createBisoMcpServer`
 * builds a wired server without connecting a transport, so the same factory
 * serves the stdio entry point (`src/bin/stdio.ts`), an in-memory client in the
 * tests, and — once its authentication story is finished — a Streamable HTTP
 * host. See `docs/architecture.md` for that path.
 */

export {
  describeConfig,
  LOG_LEVELS,
  type LogLevel,
  loadConfig,
  type ServerConfig,
  WRITE_MODES,
  type WriteMode,
} from "./config/env";
export {
  ANONYMOUS_PRINCIPAL,
  describePrincipal,
  isAnonymous,
  isCampusAdmin,
  isGlobalAdmin,
  isHr,
  POLICY_PROFILES,
  type PolicyProfile,
  type Principal,
} from "./identity/principal";
export {
  deriveRoles,
  isHrDepartment,
  parseTeamMemberships,
  resolveProfile,
} from "./identity/resolve";

export {
  assertPublishAccess,
  assertWriteAccess,
  canReadRow,
  describeScope,
  scopeQueries,
} from "./identity/scope";
export type { ToolContext } from "./runtime/context";

export {
  DomainError,
  ERROR_CODES,
  type ErrorCode,
  isDomainError,
} from "./runtime/errors";

export {
  buildProposalToken,
  createProposal,
  diffFields,
  MUTATION_TIERS,
  type MutationProposal,
  type MutationTier,
  tierIsExecutable,
  verifyProposalToken,
} from "./runtime/mutation";
export {
  fingerprint,
  redactSecrets,
  SENSITIVE_COLUMNS,
  stripSensitive,
} from "./runtime/redact";
export {
  defineTool,
  registerModules,
  type ToolDefinition,
  type ToolModule,
} from "./runtime/register";
export {
  type AppliedScope,
  buildPagination,
  clampLimit,
  decodeCursor,
  encodeCursor,
  type Pagination,
  type ToolOutcome,
  toCallToolResult,
  toToolError,
} from "./runtime/result";
export {
  ALL_MODULES,
  type CreatedServer,
  type CreateServerOptions,
  createBisoMcpServer,
  SERVER_NAME,
  SERVER_VERSION,
} from "./server";
export {
  BLOCK_TYPE_CATALOG,
  BLOCK_TYPES,
  FEED_BINDING_BLOCKS,
  isKnownBlockType,
} from "./services/blocks";
export {
  CONTENT_DOMAINS,
  CONTENT_OPERATIONS,
  type ContentDomain,
  type ContentOperation,
  domainsSupporting,
  supportMatrix,
  supports,
  unsupportedReason,
} from "./services/content-registry";
export { createServices, type Services } from "./services/index";
