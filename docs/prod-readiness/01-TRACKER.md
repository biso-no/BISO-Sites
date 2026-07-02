> Reconstructed 2026-07-02 from session memory after the original (uncommitted) files were lost. Wording is reconstructed; finding IDs and severities are preserved.

# Production-Readiness Audit — Session Tracker

## Session status

| Session | Scope | Status | Date | Findings produced | Notes |
|---------|-------|--------|------|--------------------|-------|
| S00 | Scope & scaffold | ✅ done | 2026-07-01 | — | Created `00-PLAN.md`, `01-TRACKER.md`, `02-FINDINGS.md`, `03-LAUNCH-GATE.md`. |
| S01 | Build, deploy & CI | ✅ done | 2026-07-01 | PR-001–PR-007 | 1 high (PR-001), 2 medium (PR-002, PR-007), 4 low. `bun run build` succeeds for all 4 apps; web's Appwrite flatten script fails locally (dangling styled-jsx symlink). |
| S02 | Dependencies, config & secrets | ✅ done | 2026-07-01 | PR-008–PR-014 | 1 high (PR-008, unpatched Next.js), 3 medium, 3 low. Security gates C1 (no client-side secrets) and C2 (no committed secrets) both passed. All S01 env-naming leads resolved as benign/documented fallbacks. |
| S03 | Security / authz architecture | ✅ done | 2026-07-01 | PR-015–PR-028 | 2 blockers, 5 high, 4 medium, 3 low. Whole-repo authz chain reviewed (Azure AD → M365 → Appwrite teams → RLS). Two critical gaps found in provisioning and collection permissions. See `04-AUTHZ-MODEL.md`. |
| S04 (partial) | Types, lint & dead-code | ✅ (partial) | 2026-07-01 | PR-029–PR-031 | Session was cut short before formal close-out. TypeScript passes clean on all 15 packages (positive result, no finding). Captured: 2 circular-dep pairs, `@repo/ui` lint misconfiguration, 11 unused deps / 2 unused files / 1 unused catalog entry. Gate A3/A4 remain unverified pending a full re-run. |
| S05 | Payments & money-path runtime | ✅ done | 2026-07-02 | PR-032–PR-045 (+shared) | 1 confirmed blocker (PR-032), 1 blocker (PR-033), 5 high (stock races, reconciliation gap, Finago posting), medium/low. Vipps crypto verified sound; the exposed checkout route is the hole. |
| S06 | Auth token lifecycle | ✅ done | 2026-07-02 | PR-058–PR-074 | 4 high (offboarding, booking races, dead anon cookie), 7 medium (OAuth CSRF, JWT self-heal, Graph token caching, cookie membership), low. Expense token flow verified sound (reference pattern). |
| S07 | Appwrite runtime semantics | ✅ done | 2026-07-02 | PR-075–PR-082 (+pagination) | Pagination truncation on auth/entitlement reads (PR-075), multi-write atomicity gaps, storage bucket exposure (PR-079), file orphaning. Grounded against `appwrite.config.json`; no realtime usage. |
| S08 | Next.js/Bun runtime | ✅ done | 2026-07-02 | PR-083–PR-087 | No cache cross-user leak, no edge/Bun landmines in shipping code (positives). force-dynamic disables ISR, build-env inlining risk (PR-085). |
| S09 | Failure modes & resource exhaustion | ✅ done | 2026-07-02 | PR-046–PR-057 | 5 high (no Appwrite/Vipps/24SO timeouts, no error tracking, homepage fragility). Memory hygiene verified clean over a week. |
| S10 | Synthesis & go/no-go | ✅ done | 2026-07-02 | — | Consolidated verdict in `07-GO-NO-GO.md`: **NO-GO**, 4 live blockers + 1 gated, ordered remediation path. |
| S11 | Remediation: observability + homepage resilience | ✅ done | 2026-07-02 | — | Minimally code-remediated PR-048 with structured `onRequestError` server logging in `web`, `admin`, `api`, and `docs`; code-remediated PR-049's homepage Appwrite-blip crash. Deploy log retention/alerting or Sentry/OTel remains owner/infrastructure work. |
| S12 | Remediation: upstream deadlines + reservation cleanup query | ✅ done | 2026-07-02 | — | Code-remediated PR-046 Appwrite request deadlines/shared transport, PR-047 checkout-chain deadlines, PR-050 24SO membership timeout/fallback, and PR-037 reservation cleanup query syntax. Remaining follow-ups: deploy smoke, Vipps maintenance-path deadlines, server-side membership cache, PR-037 limit/product scoping, and PR-035/036/038/039 money-path work. |

**Findings tally:** 87 findings logged (PR-001–PR-087). S01–S04: 31 (2 blocker,
7 high, 10 medium, 12 low). S05–S09 runtime: 56 more (2 blocker + 1 gated, and
the high/medium/low split per `02-FINDINGS.md`'s tally table, which is the
authoritative per-ID breakdown). **PR-032, PR-033, PR-015, PR-017, and PR-034
are code/config-remediated locally as of 2026-07-02; PR-046, PR-047, PR-048,
PR-049, PR-050, and PR-037's query syntax now have local code remediations.
All owner live checks called out in `02-FINDINGS.md` remain pending before full
closure.**

## Blockers board

Two open `blocker`-severity findings from S03 currently gate launch. Both must
be resolved (or explicitly risk-accepted with owner sign-off, which the
severity definition in `00-PLAN.md` treats as disqualifying for `blocker`
specifically — blockers cannot be waived, only fixed) before go-live.

| ID | Title | App/package | Status |
|----|-------|-------------|--------|
| PR-015 | M365 user-creation never assigns Azure security-group membership — new admin users get zero Appwrite team membership and therefore zero authorization on first sign-in. | `apps/admin` (`_actions/it-users.ts`, `lib/m365-sync.ts`) | code-remediated locally; owner Azure tenant verification pending |
| PR-017 | 31 of 82 Appwrite collections grant `create("users")` or `create("any")` — including unauthenticated `create("any")` on `orders`, `cart_reservations`, `approval_requests` — making document-level row permissions the sole (and previously unintended) enforcement layer. | `packages/api/appwrite.config.json` (schema, whole repo impact) | code/config-remediated locally; owner Appwrite live permission verification pending |
| PR-032 | Checkout API charged a **client-supplied amount with no authentication**. Code remediation now requires an Appwrite JWT, derives `userId` from `account.get()`, recomputes trusted product totals server-side, and rejects mismatches before order/provider creation. | `apps/api` (payment checkout route), `apps/web` checkout action | code-remediated locally; owner live smoke pending |
| PR-033 | `orders` collection grants `create("any")` → any client can forge a `status:"paid"` order with arbitrary amount/items. Concrete instance of PR-017; legit flow uses the admin client so the grant is safe to remove. VERIFIED IN CODE. | `packages/api/appwrite.config.json` | code/config-remediated locally; owner Appwrite live permission verification pending |
| PR-034 (gated) | Forged pre-"approved" expense payouts: `expense`/`expense_attachments` grant `create("users")` and the payout cron never verifies an approval chain. **Latent — gated by `expenses_ledger_posting` (default OFF).** Hard gate: do not enable that flag until fixed. | `apps/api` (expense-posting), `packages/api/appwrite.config.json` | code/config-remediated locally; keep flag OFF until owner live verification |

See `02-FINDINGS.md` for full evidence and recommended fixes, `03-LAUNCH-GATE.md`
(gates `F5`/`C7`/`D2`/`D3` red), and `07-GO-NO-GO.md` for the ordered verdict.
**Code/config remediation is complete locally for PR-015/017/033/034, and
PR-032 was already code-remediated.** Full closure still requires owner live
verification for Appwrite permissions, Azure group assignment, and checkout /
expense smoke checks.

## Session-end checklist (for every future session)

- [ ] All findings from this session appended to `02-FINDINGS.md` with a
      `PR-###` ID continuing the sequence.
- [ ] This table's session row updated (status, date, findings, notes).
- [ ] Blockers board above updated if any blocker opened or closed.
- [ ] Relevant rows in `03-LAUNCH-GATE.md` updated.
- [ ] `06-SESSION-STATE.md` updated with current in-flight state before ending.
