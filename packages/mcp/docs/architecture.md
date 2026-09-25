# Architecture

## Layering

```
src/bin/stdio.ts          the standalone binary; owns stdout hygiene
  └─ src/server.ts        factory: config → clients → principal → registration
       ├─ config/env.ts   the only place process.env is read
       ├─ appwrite/       three clients with different authority
       ├─ identity/       principal derivation + the scope engine
       ├─ services/       typed backend contracts (no MCP types here)
       ├─ domains/        tool modules (no Appwrite calls here)
       ├─ resources/      stable context
       ├─ prompts/        user-initiated workflows
       └─ runtime/        errors, results, mutation gate, audit, registration
```

The layers are enforced by direction of import: `services/` knows nothing about
MCP, and `domains/` makes no Appwrite calls. A tool that wanted to run its own
query would have to add a service first, which is where authorization lives.

The factory ordering is load-bearing:

1. config is read once,
2. clients are built from it,
3. the principal is resolved **from the backend**,
4. registration is computed from that principal.

Steps 3 and 4 in that order are why a tool a principal may not use is never
registered. Capability is derived from verified identity, not from what the
client asks for.

Registration is a *snapshot*, though, and a stdio server outlives it — the host
that spawned it can live for hours. So the principal is re-resolved per call
(forced before anything that mutates, TTL-bounded for reads; see
`identity/refresh.ts`) and the tool's profile is re-checked against that
refreshed principal before the handler runs. Without that second check a tool
whose only gate is its profile stays callable for the whole session after the
membership behind it has been withdrawn.

---

## Decisions

### 1. A framework-independent backend entry point

**Problem.** `@repo/api/server` is `"use server"`, imports `next/headers` at
module scope, and reads its endpoint, project and API key from `process.env`
when the module loads.

**What was actually measured.** Under Bun 1.3.11 the module imports fine in a
plain process and `createSessionClient(jwt)` works; only the no-JWT cookie path
throws. So this was a choice, not a forced move.

**Decision.** Add `packages/api/runtime.ts`: same `node-appwrite` clients, same
timeout and slow-request behaviour, but every input passed explicitly and
nothing read from the ambient request. `./server` is untouched.

**Why.** Three reasons, in order of weight: it keeps the whole Next runtime out
of a stdio process (verified at zero modules — see `runtime/isolation.test.ts`);
`"use server"` has real semantics under bundlers and other loaders, so relying
on Bun tolerating it is relying on an accident; and module-scope credentials
make it impossible to hold two configurations or inject one in a test.

**Cost.** One more file in `@repo/api` and a small amount of duplicated
instrumentation. Accepted because the alternative couples a standalone server to
a web framework it never uses.

### 2. The service key is an executor, never an identity

Several legitimate operations cannot run under the caller's own credential even
when the caller is the right person. `page_translations` grants update only to
Operations Unit and the four `ledelsen` teams, so a campus admin correctly
authorized to publish a page is refused by row security. `@repo/api`'s own
`publishPage` uses the admin client for exactly this and documents that callers
must authorize first.

So: `requireElevated(reason)` takes the reason as an argument, application-level
authorization always runs first on the principal, and the reason lands in the
audit record. `resolvePrincipal` never derives an identity from a service key —
configure only a key and the server runs on the `public` profile.

`pages.test.ts` asserts the ordering directly: a refused save requests **zero**
elevations.

**Rejected:** using the service key for reads too, "since we filter anyway". It
would mean every read bug becomes a cross-campus disclosure instead of an empty
list. Reads use the caller's own client, so Appwrite is a second enforcement
layer under the application filter.

### 3. Explicit service contracts instead of a function record

The admin assistant injects `Record<string, (...args: unknown[]) => Promise<unknown>>`.
That compiles whether or not a dependency exists, takes the right arguments, or
returns the right shape; every call site casts, and a missing key is a runtime
`TypeError`. `ToolContext.services` is a concrete object of named interfaces
instead, so reaching for something the server did not wire fails to compile.

### 4. Support is data, not code paths

`services/content-registry.ts` holds one row per domain: the table, its real
status enum, its translation model, its scope columns, which operations are
supported, and a sentence for each that is not. The same data drives
registration, execution, `biso_list_capabilities` and the resource.

This exists because the assistant's uniform `CONTENT_DOMAIN` enum promises
operations its adapters do not implement, and a model discovers that only after
telling the user it was creating something.

### 5. Proposals, and three separate questions

**Authorization** (may this principal?) comes from team memberships.
**Human confirmation** (did a person agree to *this*?) comes only from a host
elicitation. **Business approval** (does the org require sign-off?) comes from a
persisted `approval_requests` row.

A model calling a `confirm_action` tool answers none of them: the call is the
model's own output. So confirmation is `elicitation/create`, and when the client
cannot elicit, the mutation stays proposal-only rather than proceeding.

The token binds actor + action + payload hash + revision + expiry under a
per-process secret. Not persisted — a proposal describes a change a user was just
shown, not a durable grant.

**Rejected:** a server-side proposal store keyed by id. It survives restarts,
which is the problem: a pending proposal that outlives the conversation that
produced it is a standing grant nobody remembers issuing.

### 6. Restricted operations are absent, not gated

Payments, refunds, ledger postings, outbound messages and identity changes are
not executable in any write mode. Two concrete reasons from the audit:

- `postLedgerTransaction` in `@repo/connectors` sends **no idempotency key and
  performs no dedupe pre-check**. A retry posts a second voucher.
- The double-refund guard is an atomic `refund_lock` held by the orchestrator in
  `@repo/shared/utils/order-refunds`. A second implementation of a money
  invariant is a second thing to get wrong.

The tools that would need these either do not exist or return a proposal that
reports itself as not executable.

### 7. Deterministic workflows, no second model

`biso_campus_briefing` and `biso_content_quality_audit` run real queries and
arrange the results. No model is called, so no provider key is needed and
neither can invent an item. The MCP client already has a model — the one calling
the tools — and it has the user's question, which this server does not.

Same reasoning removes `generate_copy`: the editor's version returns a literal
placeholder that a model can then write into a live page.

### 8. Block metadata restated, with a compile-time proof

`@repo/editor`'s block definitions sit beside their React components and hold
live component references, so the registry is neither importable nor
serialisable here. `services/blocks.ts` restates the metadata and pins it two
ways: `satisfies readonly BlockType[]` rejects an invalid entry, and
`AssertExhaustive<Exclude<BlockType, …>>` fails to compile if the editor gains a
block this catalogue lacks.

(The editor's own AI tool list has the first guard and not the second, which is
why its copilot cannot insert 14 of the 33 block types.)

### 9. Two additive exports from `@repo/editor`

`./operations` and `./theme/presets`. Both modules are already React-free —
`operations.ts` imports only types from `./types` — so exporting them adds no
dependency and changes no behaviour. The alternative was reimplementing
`emptyBlock`'s 33 default shapes and the block mutations, which is 300 lines of
drift risk against the editor's own semantics.

`packages/mcp/tsconfig.json` maps `@/*` into `../editor/src/*` so `tsc` can
follow the editor's internal type imports. `apps/admin` does the same thing for
the same reason.

---

## Errors

Thirteen codes (`runtime/errors.ts`), kept apart because collapsing them
misleads a model: `no_results` read as `forbidden` makes it abandon a valid
search; `forbidden` read as `requires_authorization` makes it file an approval
nobody can grant.

A `DomainError` keeps its message and remedy. Anything else becomes `internal`
with a fixed message — an unexpected throw can carry a connection string, a
token, or a row the caller may not read. The real error goes to stderr.

Out-of-scope reads report `not_found`, not `forbidden`: distinguishing them
confirms the id exists.

---

## Transport

### stdio (implemented)

`src/bin/stdio.ts` redirects the entire `console` surface to stderr *before*
importing anything else. Convention alone does not hold here — `@repo/api`'s
server module logs slow requests with `console.warn`, and any future dependency
can add one. One stray byte on stdout corrupts the stream and the client
disconnects with a parse error that points nowhere.

### Streamable HTTP (deliberately not implemented)

The SDK supports it and `createBisoMcpServer` is transport-agnostic, so the
server work is small. The **authentication** work is not, and shipping the
transport without it would mean an unauthenticated privileged HTTP server.

What it needs:

1. **Per-request identity.** Today the principal is resolved once at startup
   from one credential. HTTP needs one per request — the `Authorization` header
   carrying an Appwrite JWT, with `resolvePrincipal` moving into the request
   path and a short cache keyed by token fingerprint.
2. **Per-session context.** `ToolContext` is currently per-process. It would
   become per-session, which also means registration becomes per-session, since
   registration depends on the principal.
3. **Origin validation and binding.** `Origin` checking, binding to loopback for
   local use, and CORS matching `apps/api/src/lib/allowed-origins.ts`.
4. **Rate limiting.** `apps/api` has none; an HTTP MCP endpoint should not
   inherit that.

Until all four exist, stdio is the only transport. See
[`roadmap.md`](./roadmap.md).

---

## Testing

180 tests, no network, providers mocked by default.

`testing/index.ts` is an in-memory `BackendClients` that implements enough of
the Appwrite query language — `equal`, `contains`, `search`, `or`,
`greaterThanEqual`, `limit`, `offset`, and nested attributes like `campus.$id` —
that an authorization test genuinely excludes another department's rows. A test
that only asserted the filter *string* would pass even if the filter were never
applied.

`server.test.ts` drives a real SDK `Client` against a real server over
`InMemoryTransport`, so schemas, annotations, name collisions and result
serialisation are all exercised through the protocol.

`runtime/isolation.test.ts` asserts the standalone claim two ways: the real
module graph contains zero Next and zero React modules after loading the server,
and no source file imports a request-bound or browser API.

`scripts/smoke-stdio.ts` spawns the binary as a real child process and drives it
with a real client over real stdio.

### Not covered by the default suite

No test in this package contacts Appwrite, Microsoft Graph, SharePoint, Vipps,
Stripe, 24SevenOffice or OpenAI. Nothing here has been verified against a live
backend. A staging smoke procedure is in [`roadmap.md`](./roadmap.md); it has
**not** been run.
