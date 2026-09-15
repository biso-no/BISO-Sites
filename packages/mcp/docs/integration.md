# Future integration guide

**Nothing here has been done.** This package is standalone: no app imports it,
and no app's routes, dependencies or behaviour changed. This document describes
how each app *could* adopt it, and what would have to be true first.

---

## What is reusable today, without adopting the server

Three pieces are useful on their own, and are exported for that reason.

### `@repo/mcp/identity` — the scope engine

The repo currently has **two** identity derivations that disagree:

| | `apps/admin` `getUserAuthContext` | `apps/api` `getAdminScope` |
|---|---|---|
| Team parsing | `parseTeamMemberships` — ignores teams that are neither a known campus nor `SG-App-Dept-*` | `normalizeTeamName` — classifies **any** unrecognised team as a department |
| `biso-members` | Ignored | Becomes a department name |
| HR role | Derived | Not derived |
| Output | `UserAuthContext` | `AdminScope` |

Neither is wrong for its own use, but they are not the same function, and a
third copy would make it worse. `@repo/mcp/identity` exports the admin
derivation (the stricter one) as pure functions plus the scope engine
(`scopeQueries`, `assertWriteAccess`, `canReadRow`, `assertPublishAccess`).

A consolidation would look like: move these into `@repo/shared`, have
`apps/admin` keep its cookie/`cache()` wrapper but delegate the derivation, and
have `apps/api` adopt the same one. That is a real behaviour change for
`apps/api` — `managedDepartmentNames` would stop containing `biso-members` — so
it needs its own PR, its own tests and a look at every `getAdminScope` caller.

### `@repo/api/runtime` — framework-independent Appwrite clients

Already additive and already shipped here. Useful to any future worker, CLI or
scheduled job that should not import Next.

### `@repo/mcp` content registry

`supportMatrix()` is a machine-readable statement of which content operations
exist per domain. `apps/admin` could use it to stop rendering a delete button for
benefits, which its own assistant advertises and its adapter does not implement.

---

## Adopting the server itself

### Option A — developer tooling (no app change)

Each developer or staff member runs the stdio server locally against their own
Appwrite session. Nothing is deployed.

**Ready now.** See the README. This is the intended first step, and it is the
only option that needs no further work.

### Option B — `apps/admin` hosts an HTTP MCP endpoint

A route like `apps/admin/src/app/api/mcp/route.ts` would mount the Streamable
HTTP transport, resolve the principal from the caller's session cookie, and hand
it to `createBisoMcpServer`.

**Blocked by all four items in [roadmap §2.1](./roadmap.md).** In particular the
principal must become per-request; today it is resolved once at startup. Without
that, the server would act as whoever started the process for every caller.

Sketch, once unblocked:

```ts
// NOT IMPLEMENTED — illustrative only
export async function POST(request: NextRequest) {
  const ctx = await getUserAuthContext();
  if (!ctx) return unauthorized();

  const created = await createBisoMcpServer({
    config: mcpConfigFromEnv(),
    principalOverride: toPrincipal(ctx),   // the adapter that does not exist yet
  });

  const transport = new StreamableHTTPServerTransport({ /* … */ });
  await created.server.connect(transport);
  return transport.handleRequest(request);
}
```

`toPrincipal(ctx)` is the missing piece: `UserAuthContext` and `Principal` are
structurally close but not identical (`activeCampusId` exists on one and is
deliberately absent from the other). Writing it is small; deciding whether the
admin portal's active-campus narrowing should apply to MCP calls is not.

### Option C — `apps/admin` replaces its assistant's tool layer

The heaviest option, and the one with the most upside: the admin assistant keeps
its chat UI and swaps `AssistantActionDeps` for `@repo/mcp`'s services.

It would fix, in one move, the defects the audit found: the dropped `limit`, the
ignored search terms, the inconsistent result shapes, the operations advertised
without adapters, and the capability map that offers vacancy tools to
non-HR staff.

**What stays in the app:** the client tools. `navigate`, `fillForm` and
`showDraftPreview` need a browser and have no server equivalent — this package
maps them to links and proposals instead, which is right for an MCP client and
wrong for an in-app widget that can actually navigate.

**Blocked by:** Option B, plus a decision about `confirmAction`. The app's
version renders a card and the user clicks; this package requires a host
elicitation. Both are real confirmations, but they are different mechanisms, and
the mutation gate would need to accept the app's.

### Option D — `apps/web` consumes public discovery

Not recommended. `apps/web`'s cached readers in `src/lib/data/` are already
correct, use `createPublicClient()`, and have carefully-reasoned caching
semantics (every reader throws on a transient failure so a blip is never cached
as a false absence). Routing them through MCP would add a hop and lose the
caching. The public discovery tools exist for *external* clients.

---

## If you adopt it, keep these invariants

1. **Identity from the backend.** If an integration ever lets a caller supply a
   principal, role or campus, the whole model collapses. `principalOverride`
   exists for tests and for a host that has *already* authenticated the user —
   never for a value that arrived in a request body.
2. **Authorization before elevation.** `requireElevated(reason)` is only ever
   called after the principal-based check has passed.
3. **Restricted stays restricted.** Payments, refunds, ledger postings, outbound
   messages and identity changes are not executable. An integration that relaxes
   this inherits the specific hazards in [roadmap §3.3](./roadmap.md) —
   `postLedgerTransaction` still has no idempotency key.
4. **stdout stays clean** in any stdio deployment.
5. **Retrieved content is data.** Never instructions.

---

## What adopting it would cost

Honestly: Option A is free and useful today. Option B is a few days, most of it
authentication rather than MCP. Option C is a larger piece of work whose value
is proportional to how much the admin assistant is actually used — which is
worth measuring before committing to it.

The audit and the capability matrix in [`audit.md`](./audit.md) are useful on
their own even if none of these happen.
