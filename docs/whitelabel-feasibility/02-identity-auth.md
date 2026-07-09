# Whitelabel Feasibility — Identity & Auth

> Investigation area 2 of 6. Analysis only — no code changes proposed here.
> Format per finding: **ID · portability · app/package · title**, then current
> state + evidence, what "managed" would require, and classification rationale.
>
> Portability tags: **portable** (a — already generic/config-driven),
> **moderate** (b — needs extraction/abstraction, no architecture change),
> **blocker** (c — fundamental redesign or fork decision required).

## Verdict for this area

The **connector layer is clean; the auth architecture around it is not.**
`packages/connectors` (Azure/Graph, SharePoint) is fully parameterized — no
hardcoded tenant or client IDs. But the admin app's *only* login path is
Microsoft OAuth, and admin authorization is provisioned from Azure AD security
group **names** mapped onto a hardcoded BISO org structure. An organization
without Microsoft 365 cannot use the admin app as built. The public web app is
close to portable already.

---

## Findings

### AUTH-01 · moderate · `packages/api` · Appwrite endpoint/project defaults are BISO but env-overridable
**Current state:** `createSessionClient()`/`createAdminClient()` fall back to
project `"biso"` / endpoint `https://appwrite.biso.no/v1` when env vars are
absent (`packages/api/server.ts:44-52`; same fallbacks in
`packages/api/client.ts:20-22`). Session cookie name defaults to
`a_session_biso` (`server.ts:53-54`).
**Evidence:** `packages/api/server.ts`, `packages/api/client.ts`.
**Managed version:** remove BISO fallbacks; require explicit env per
deployment/tenant. Trivial.
**Why moderate not portable:** silent BISO defaults would leak into any fork
that misses an env var.

### AUTH-02 · portable · `apps/web` · Public-site auth is multi-provider and org-agnostic
**Current state:** Web wires Google, Facebook, Apple, Microsoft OAuth plus
magic link (`apps/web/src/lib/server.ts:10-119`); login UI surfaces magic link
+ Google/Facebook/Apple (`apps/web/src/components/login.tsx:188-243`).
Anonymous sessions are minted lazily via `ensureAnonymousSession()`
(`apps/web/src/lib/anon-session.ts:52-53`) — no middleware, no eager
provisioning. Auth classification logic (`auth-utils.ts:14-26`) is generic.
**Managed version:** essentially none needed beyond AUTH-06 (cookie domain).
Provider set is Appwrite-project-level config, which pairs naturally with a
project-per-tenant model.

### AUTH-03 · blocker · `apps/admin` · Admin login is Microsoft-OAuth-only
**Current state:** The sole admin sign-in action is `signInWithAzure()` →
`account.createOAuth2Token(OAuthProvider.Microsoft, …)`
(`apps/admin/src/lib/server.ts:25-48`); the login component renders a single
"Sign in with BISO" Microsoft button
(`apps/admin/src/components/login.tsx:13,48-86`). The OAuth callback **awaits**
`syncM365Permissions()` before setting the session cookie
(`(auth)/auth/oauth/route.ts:36,44`) — Microsoft Graph group sync sits on the
critical login path. A magic-link callback route exists but is unreachable
from the UI.
**Managed version:** tenant-selectable IdP (generic OIDC covers most orgs),
with authorization provisioning decoupled from the Microsoft token (see
AUTH-04). This is an auth-architecture change, not a config extraction.
**Why blocker:** a non-M365 org has no way to log in to the admin app at all.

### AUTH-04 · blocker · `apps/admin`, `packages/shared`, `apps/api` · Role model hardcodes BISO's org taxonomy
**Current state:** Roles derive from Appwrite team memberships that are synced
from Azure AD security groups by name:
- `syncM365Permissions()` calls Graph `GET /me/transitiveMemberOf` with the
  user's Microsoft access token, filters `SG-App-Campus-*` / `SG-App-Dept-*`
  (`apps/admin/src/lib/m365-sync.ts:145-161,229-297`); silently skips when no
  Microsoft identity exists (`:243-247`).
- Hardcoded campus list `["Oslo","Bergen","Stavanger","Trondheim"]` + National
  (`packages/shared/utils/team-roles.ts:16-26`); `globaladmin` requires
  `National` + `"Operations Unit"` teams (`:66-75`); `campusadmin` requires
  `Ledelsen {City}` + city team (`:82-100`).
- Hardcoded numeric campus IDs `Oslo:1 … National:5` used as FK values on
  content rows (`apps/admin/src/lib/campus-constants.ts:14-20`), plus derived
  team IDs like `sg-app-dept-operationsunit` (`:27,52-58`).
- `apps/api/src/lib/admin-auth.ts:45-96` re-implements the same three-tier
  model for the standalone API.
- Group-name convention also lives in a connector helper:
  `getRequiredSecurityGroups()` → `SG-App-Campus-${campus}` etc.
  (`packages/connectors/src/azure/users.ts:1178-1183`).

One mitigating fact: role **reading** is already decoupled —
`getUserAuthContext()` only reads Appwrite teams
(`apps/admin/src/lib/authorization.ts:112-155`), never Graph. Labels are read
but unused for authz.
**Managed version:** per-tenant org-structure config (org-unit list, IDs,
group-name → role mapping) replacing the constants and the `SG-App-*` parser.
The read side survives; the provisioning side and constants do not.
**Why blocker:** BISO's boards/campuses/units are encoded as compile-time
constants that double as database FK values; two apps duplicate the model.

### AUTH-05 · portable · `packages/connectors` · Graph/SharePoint connectors are fully parameterized
**Current state:** `createGraphClient(tenantId, clientId, clientSecret)`
(`packages/connectors/src/azure/index.ts:5-9`); `GraphUserService` takes creds
as constructor args (`azure/users.ts:296-298`); domain filtering is an
`allowedDomain` parameter (`:274-283`). `SharePointService(config)` with
zod-validated config from `SHAREPOINT_*` env vars, site list env-driven
(`sharepoint/index.ts:513-566`).
**Managed version:** per-tenant credential storage if shared-infra;
per-deployment env vars already suffice for fork model. The connector layer
needs no rework.

### AUTH-06 · moderate · both apps · Cookie domain `.biso.no` and cookie-name guard hardcoded
**Current state:** production session cookies pin `domain: ".biso.no"` in at
least five places (`apps/web/src/lib/anon-session.ts:17`,
`web/(auth)/auth/oauth/route.ts:33`, `web/(auth)/auth/callback/route.ts:53`,
`admin/(auth)/auth/oauth/route.ts:49`, `admin/src/lib/actions/user.ts:182`).
Admin `instrumentation.ts:14,44-52` refuses to boot unless
`APPWRITE_SESSION_COOKIE === "a_session_biso_admin"`.
**Managed version:** a `COOKIE_DOMAIN` env var + relaxing the boot guard.
Mechanical, but scattered.

### AUTH-07 · moderate · `apps/admin`, `apps/api` · Single Azure tenant per deployment via env
**Current state:** one global set of `AZURE_GRAPH_TENANT_ID/CLIENT_ID/SECRET`
(`apps/admin/src/lib/it/graph.ts:11-15`), `AZURE_CLIENT_ID/SECRET/TENANT_ID`
for recruitment scheduling (`recruitment-scheduling.ts:24-26`),
`SHAREPOINT_*`, and `M365_DOMAIN` defaulting to `"biso.no"`
(`graph.ts:17`; `apps/api/.../users/route.ts:28`). `tenant-guard.ts:17-41`
refuses to act on users outside `@biso.no` (env-overridable).
M365 feature modules degrade gracefully when creds are absent
(`getGraphService()` returns null, `graph.ts:19-34`) — they are optional;
login/authz are not (AUTH-03/04).
**Managed version:** fork model — per-deployment env, works today. Shared
infra — per-tenant secret storage + tenant-scoped `getGraphService()`.

### AUTH-08 · moderate* · `packages/shared`, external function · Membership verification is BI-specific but cleanly abstracted
**Current state:** `checkMembership()` requires a linked generic **OIDC**
identity ("BI Student"), then invokes an Appwrite Function
`verify_biso_membership` that lives **outside this repo**
(`packages/shared/utils/membership.ts:44-63`). Called at checkout
(`apps/web/src/app/actions/orders.ts:83`) and profile. The `biso-members`
Appwrite team is the member-ACL cohort, deliberately excluded from Azure sync
(`m365-sync.ts:19-24,280`). No Feide/Vipps-login/BankID anywhere.
**Managed version:** parameterize the function name + OIDC provider per
tenant, or make membership optional. The abstraction boundary (one function
call + one linked identity) is already right; only the concrete provider is
BISO/BI-specific.
**\*Classification note:** the *provider* is unavoidably org-specific
(blocker-shaped for any tenant wanting registry-verified membership), but the
*architecture* is portable — hence moderate.

### AUTH-09 · moderate · misc · Scattered org-identity fallbacks
**Current state:** `https://app.biso.no` URL fallbacks
(`recruitment-workspace.ts:538`, `interviews.ts:469`); analytics host
`analytics.biso.no` (`admin/layout.tsx:37`); `contact@biso.no` in error pages;
`STUDENT_POPULATION = 6840` (BI headcount) in
`admin/.../event-studio-editor.tsx:154`; web `images.remotePatterns`
allow-lists `appwrite.biso.no`/`biso.no`.
**Managed version:** consolidate into a single org-config source (env or DB).

---

## What "arbitrary org auth" minimally requires

1. **Per-tenant IdP config** — replace admin's hardcoded
   `OAuthProvider.Microsoft` with a tenant-selectable provider (generic OIDC
   covers most enterprise IdPs). Pairs naturally with Appwrite
   project-per-tenant, since providers are project-level config. (AUTH-03)
2. **Config-driven role provisioning** — per-tenant org-structure map
   (unit list + IDs + group→role rules) replacing `SG-App-*` parsing and the
   campus constants, in both `apps/admin` and `apps/api`. Read side
   (Appwrite teams) survives as-is. (AUTH-04)
3. **Per-tenant Azure app registration** — only for tenants that want M365
   features; already env-shaped. (AUTH-05/07)
4. **Cookie domain/name from config.** (AUTH-06)
5. **Pluggable membership provider** — swap `verify_biso_membership` + the
   "BI Student" OIDC identity per tenant, or disable. (AUTH-08)

## Classification rollup

| ID | Portability | Scope |
|---|---|---|
| AUTH-01 | moderate | BISO fallback defaults in `@repo/api` |
| AUTH-02 | portable | Web multi-provider auth + lazy anon sessions |
| AUTH-03 | **blocker** | Admin login Microsoft-only |
| AUTH-04 | **blocker** | Role model = hardcoded BISO taxonomy + Azure group names |
| AUTH-05 | portable | Graph/SharePoint connector layer |
| AUTH-06 | moderate | `.biso.no` cookie domain, cookie-name boot guard |
| AUTH-07 | moderate | Single Azure tenant per deployment (env-driven) |
| AUTH-08 | moderate | Membership check — clean abstraction, BI-specific provider |
| AUTH-09 | moderate | Scattered org-identity fallbacks |
