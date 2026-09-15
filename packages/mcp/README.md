# `@repo/mcp`

A permission-aware [Model Context Protocol](https://modelcontextprotocol.io)
server over BISO's business capabilities. It runs as a standalone process — no
Next.js, no running app — and exposes scoped reads, real page-document editing,
approvals and composite workflows to any MCP client.

> **Status: not integrated.** This package is built, documented and tested on
> its own. Nothing in `apps/web`, `apps/admin`, `apps/api` or `apps/docs` imports
> it or is affected by it. See [`docs/integration.md`](./docs/integration.md) for
> how an app *could* adopt it later.

---

## Quick start

```bash
# From the repo root
bun install

# Run it (public profile — no credentials, published data only)
bun run --filter=@repo/mcp start

# Run it as a specific user
BISO_MCP_APPWRITE_JWT="<jwt>" bun run --filter=@repo/mcp start
```

Verify it end to end without touching a real backend:

```bash
bun run packages/mcp/scripts/smoke-stdio.ts
```

That spawns the binary as a real child process, drives it with a real MCP
client over stdio, and checks initialization, discovery and a tool call.

---

## Connecting it to Claude Code

Add this to your MCP client configuration, replacing the placeholders:

```json
{
  "mcpServers": {
    "biso": {
      "command": "bun",
      "args": ["run", "/ABSOLUTE/PATH/TO/BISO-Sites/packages/mcp/src/bin/stdio.ts"],
      "env": {
        "BISO_MCP_APPWRITE_ENDPOINT": "https://appwrite.biso.no/v1",
        "BISO_MCP_APPWRITE_PROJECT": "biso",
        "BISO_MCP_APPWRITE_JWT": "<A JWT MINTED FOR YOUR OWN APPWRITE SESSION>",
        "BISO_MCP_WRITE_MODE": "propose"
      }
    }
  }
}
```

Or from the Claude Code CLI:

```bash
claude mcp add biso \
  --env BISO_MCP_APPWRITE_JWT=<YOUR_JWT> \
  --env BISO_MCP_WRITE_MODE=propose \
  -- bun run /ABSOLUTE/PATH/TO/BISO-Sites/packages/mcp/src/bin/stdio.ts
```

Start with `BISO_MCP_WRITE_MODE=propose` (the default). In that mode every
mutating tool validates and describes a change and writes nothing.

---

## Configuration

Every variable is read once, at startup, by `src/config/env.ts`. Nothing deeper
in the package reads `process.env`.

| Variable | Default | Purpose |
|---|---|---|
| `BISO_MCP_APPWRITE_ENDPOINT` | `https://appwrite.biso.no/v1` | Appwrite API endpoint. |
| `BISO_MCP_APPWRITE_PROJECT` | `biso` | Appwrite project id. |
| `BISO_MCP_APPWRITE_JWT` | — | A JWT for one user's session. **Preferred credential.** |
| `BISO_MCP_APPWRITE_SESSION` | — | A raw session secret. Same authority, longer-lived. |
| `BISO_MCP_APPWRITE_API_KEY` | — | Service key. **Not an identity** — see below. |
| `BISO_MCP_WRITE_MODE` | `propose` | `propose` \| `confirm` \| `operator`. |
| `BISO_MCP_LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` \| `silent`. Always to stderr. |
| `BISO_MCP_REQUEST_TIMEOUT_MS` | `8000` | Appwrite request timeout. |
| `BISO_MCP_SLOW_REQUEST_MS` | `2000` | Log requests at or above this. |
| `BISO_MCP_WEB_BASE_URL` | `https://biso.no` | Used to build public links. |
| `BISO_MCP_ADMIN_BASE_URL` | `https://admin.biso.no` | Used to build admin links. |
| `OPENAI_API_KEY` | — | Optional. No tool in this release requires it. |
| `BISO_MCP_AI_ENABLED` | `true` | Set `false` to disable optional AI capabilities outright. |

---

## The credential and identity model

**Identity comes from the backend, never from an argument.** At startup the
server calls `account.get()` and `teams.list()` with the configured credential
and derives roles from the resulting Appwrite team memberships. There is no tool
input anywhere in this package that can name a user, add a role, or select a
campus the credential does not already carry.

Roles are derived exactly as `apps/admin` derives them:

| Team memberships | Role |
|---|---|
| National campus **+** Operations Unit department | `globaladmin` |
| Campus-{City} **+** Ledelsen{City} | `campusadmin` for that city |
| Any `SG-App-Dept-*` team | department member, scoped to that department |
| HR department | `hr` — the only role that opens recruitment |

Campus membership alone grants nothing.

### The service key is not an identity

`BISO_MCP_APPWRITE_API_KEY` bypasses row security and belongs to no user, so it
never produces a principal. Configure only a service key and the server runs on
the `public` profile — published data only.

Its one legitimate use is as an **elevated executor** for operations that the
resolved principal is already authorized for but cannot perform under their own
credential. That case is real and unavoidable: `page_translations` grants update
only to Operations Unit and the four `ledelsen` teams, so a campus admin who is
correctly authorized to publish a page still cannot write the row. `@repo/api`'s
own `publishPage` makes the same split and documents it. Application-level
authorization always runs **first**, on the principal; the elevated client only
performs a write that check already permitted, and every use names its reason,
which lands in the audit record.

---

## Capability profiles

The profile is computed from the verified principal and decides which tool
modules are *registered*. It is a usability measure — the authorization checks in
the service layer are what actually enforce access.

| Profile | When | What is registered |
|---|---|---|
| `public` | No user credential | Public discovery, `biso_whoami`, lookups, the capability matrix |
| `member` | Signed in, no admin team | The above |
| `staff` | Campus admin or department member | Content, pages, approvals, orders, events, workflows (+ recruitment if HR) |
| `it-operator` | Global admin | The above plus platform operations |

Two further gates apply on top:

- **Recruitment** is registered only for HR and global admins. This differs from
  the admin assistant, which advertises vacancy tools to any department member
  and then returns an empty list.
- **Write tools** are registered only when a service key is configured, because
  content rows grant no team-level write.

---

## Write modes

Three things are routinely conflated; this package keeps them apart.

1. **Authorization** — may this principal do this? Decided from verified team
   memberships.
2. **Human confirmation** — has a person agreed to *this* change? Only an MCP
   host elicitation answers that. A model writing `confirmed: true`, or calling
   a confirmation tool first, proves nothing — both are the model's own output.
3. **Business approval** — does the organisation require sign-off? Answered by a
   persisted `approval_requests` row.

Every mutating tool first returns a **proposal**: the resolved targets, the
validated payload, a diff, the revision it was computed against, and a
`proposalToken`. To apply it, call the same tool again with that token and its
`proposalExpiresAt`. The token binds actor + action + payload hash + revision +
expiry, so a proposal for one change can never authorize a different one.

| Mode | Behaviour |
|---|---|
| `propose` (default) | Proposals only. Nothing is ever written. |
| `confirm` | Executes after the host returns `accept` from an elicitation. A client that does not advertise the `elicitation` capability stays at `propose`, and the proposal says so. |
| `operator` | The person running the process has authorized it to apply reversible changes without a per-call prompt. |

In every mode a proposal is **single-use**: the token is spent before the write,
so a call whose outcome you do not know cannot be retried into a duplicate row.
Re-sending a spent token is refused. Check `effect` on the result — `proposed`
means nothing was written, `executed` means it was.

### What no mode enables

The `restricted` tier is **never executable from this server**: payments,
refunds, ledger postings, outbound messages and identity changes. Those need a
persisted approval record and a present human, and several are not reversible.
Asking for one returns a proposal that reports itself as not executable.

---

## What it exposes

Full detail in [`docs/tools.md`](./docs/tools.md). In brief:

- **Identity** — `biso_whoami`, `biso_list_capabilities`,
  `biso_explain_permission`, campus/department/flag lookups, exact resolution.
- **Public discovery** — `biso_public_search` across events, news, vacancies,
  pages, units, benefits and documents; `biso_public_get_page`.
- **Content** — scoped search and read across seven domains, draft creation for
  news and events, and publish/unpublish/archive where the domain supports it.
- **Pages** — load a real block document, list block types, apply validated
  block edits with per-edit outcomes, save the draft, publish through the
  existing gate.
- **Approvals** — the pending queue, request detail, and filing a publish
  approval that routes to the right team.
- **Commerce / events / recruitment** — order lookup with state diagnostics,
  event segments and audience preview, vacancy and application reads for HR.
- **Workflows** — `biso_campus_briefing` and `biso_content_quality_audit`, both
  deterministic aggregation with no model involved.

Resources carry stable context (the support matrix, block catalogue, campus ids,
authoring and permission guides). Prompts are user-initiated workflows.

---

## Commands

```bash
bun run --filter=@repo/mcp start         # run the stdio server
bun run --filter=@repo/mcp test          # 180 tests, no network
bun run --filter=@repo/mcp check-types   # tsc --noEmit
bun run --filter=@repo/mcp lint          # biome
bun run packages/mcp/scripts/smoke-stdio.ts   # real client over real stdio
```

---

## Protocol version

Built on `@modelcontextprotocol/sdk@1.30.0`, which implements protocol
`2025-11-25` and negotiates down through `2025-06-18`, `2025-03-26`,
`2024-11-05` and `2024-10-07`. The server uses only v1 SDK APIs
(`McpServer.registerTool` / `registerResource` / `registerPrompt`) and one
optional capability (`elicitation`), which it probes for and degrades from
cleanly. No experimental protocol feature is used.

---

## Docs

| Document | What it covers |
|---|---|
| [`docs/audit.md`](./docs/audit.md) | The repository audit and the full capability matrix, with source references |
| [`docs/tools.md`](./docs/tools.md) | Every tool, resource and prompt, with examples and error semantics |
| [`docs/architecture.md`](./docs/architecture.md) | Layering, the decisions and their trade-offs, the Streamable HTTP path |
| [`docs/roadmap.md`](./docs/roadmap.md) | Deferred capabilities with their specific blockers |
| [`docs/integration.md`](./docs/integration.md) | How each app could adopt this later |
