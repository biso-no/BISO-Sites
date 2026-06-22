"use server";

import { resolveDepartments } from "@repo/ai/server/department-resolver";
import type { Models } from "@repo/api";
import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Campus, Departments } from "@repo/api/types/appwrite";
import type {
  DepartmentDataHealthEntry,
  DepartmentDataIssue,
  DepartmentFixDecision,
  DepartmentFixSummary,
  DepartmentRemediationPlan,
  DepartmentResolution,
  M365UserListItem,
  RemediationGroup,
  RemediationSnapshot,
} from "@repo/shared/types/user-management";
import { revalidatePath } from "next/cache";
import { mapWithConcurrency } from "@/lib/it/concurrency";
import {
  buildCampusPrefixToId,
  type CanonicalDepartment,
  extractCampusPrefix,
  isClosedName,
  normalizeWithCampus,
  stripClosedSuffix,
} from "@/lib/it/department-matching";
import { emailLocalPart, extractCampusHint } from "@/lib/it/email-classify";
import { getGraphService, M365_DOMAIN, toListItem } from "@/lib/it/graph";
import { findInactiveAccounts } from "@/lib/it/inactivity";
import { buildRemediationPlan } from "@/lib/it/remediation-bucketing";
import { getAllowedTenantUser } from "@/lib/it/tenant-guard";
import { requireItPermission } from "@/lib/it-permissions";
import { logAuditEvent } from "./audit-log";

type ActionResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: string };

const TRAILING_WHITESPACE_REGEX = /\s$/;
const SNAPSHOT_TABLE = "m365_remediation_snapshot";
const AI_CHUNK_SIZE = 30;
const AI_CONCURRENCY = 5;
const NATIONAL_KEY = "__national__";
const INACTIVE_MONTHS = 6;
const DEACTIVATE_CONCURRENCY = 5;
// Mailbox userPurpose values that are NOT individual user accounts — excluded
// from the "inactive accounts" list (they never sign in by design).
const RESOURCE_PURPOSES = new Set(["room", "equipment", "shared"]);
const LOG = "[dept-analysis]";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

interface CanonicalData {
  campusIdToName: Map<string, string>;
  canonical: CanonicalDepartment[]; // includes closed (nedlagt) entries
  departments: Departments[];
}

interface CanonicalLookups {
  allCandidates: Set<string>;
  campusNames: Set<string>;
  candidatesByCampus: Map<string, Set<string>>;
  closedKeys: Set<string>;
  inactiveDeptNames: Set<string>;
  tokenToCampus: Map<string, string>;
}

interface ResolutionChunk {
  campusLabel: string;
  candidates: string[];
  users: M365UserListItem[];
}

async function loadCanonicalData(): Promise<CanonicalData> {
  const { db } = await createAdminClient();
  const [campuses, departments] = await Promise.all([
    db.listRows<Campus>("app", "campus", [
      Query.orderAsc("name"),
      Query.limit(100),
    ]),
    db.listRows<Departments>("app", "departments", [
      Query.orderAsc("Name"),
      Query.limit(1000),
    ]),
  ]);

  const campusIdToName = new Map(
    campuses.rows.map((campus) => [campus.$id, campus.name])
  );
  const canonical = departments.rows.map((department) => ({
    name: department.Name,
    campusId: department.campus_id,
    active: department.active !== false,
  }));

  return { canonical, campusIdToName, departments: departments.rows };
}

function buildCanonicalLookups(data: CanonicalData): CanonicalLookups {
  const campusNames = new Set(data.campusIdToName.values());
  const tokenToCampus = new Map<string, string>();
  for (const name of campusNames) {
    tokenToCampus.set(name.toLowerCase(), name);
  }
  const candidatesByCampus = new Map<string, Set<string>>();
  const allCandidates = new Set<string>();
  const inactiveDeptNames = new Set<string>();
  // Include ALL departments — active and inactive/closed — as candidates so the
  // AI can still place users whose unit was shut down. Inactive ones are routed
  // to the Closed bucket in buildRemediationPlan via inactiveDeptNames.
  for (const dept of data.canonical) {
    const campusName = data.campusIdToName.get(dept.campusId);
    if (!campusName) {
      continue;
    }
    const set = candidatesByCampus.get(campusName) ?? new Set<string>();
    set.add(dept.name);
    candidatesByCampus.set(campusName, set);
    allCandidates.add(dept.name);
    if (dept.active === false || isClosedName(dept.name)) {
      inactiveDeptNames.add(dept.name);
    }
  }
  // Campus-scoped keys for matching a user's CURRENT department against a
  // shut-down/inactive unit. We add both the full inactive name and its
  // suffix-stripped form (each campus-prefix-preserving) so a user sitting in
  // either "OSL Foo - nedlagt" or its pre-closure "OSL Foo" is caught, while
  // an active "BRG Foo" in another campus is not.
  const closedKeys = new Set<string>();
  for (const name of inactiveDeptNames) {
    closedKeys.add(normalizeWithCampus(name));
    closedKeys.add(normalizeWithCampus(stripClosedSuffix(name)));
  }
  return {
    campusNames,
    tokenToCampus,
    candidatesByCampus,
    allCandidates,
    closedKeys,
    inactiveDeptNames,
  };
}

function batchUsersByCampus(
  listItems: M365UserListItem[],
  tokenToCampus: Map<string, string>
): Map<string, M365UserListItem[]> {
  const batches = new Map<string, M365UserListItem[]>();
  for (const item of listItems) {
    const hint =
      extractCampusHint(
        item.mail ?? item.userPrincipalName,
        item.officeLocation,
        tokenToCampus
      ) ?? NATIONAL_KEY;
    const list = batches.get(hint) ?? [];
    list.push(item);
    batches.set(hint, list);
  }
  return batches;
}

function buildResolutionChunks(
  batches: Map<string, M365UserListItem[]>,
  candidatesByCampus: Map<string, Set<string>>,
  allCandidates: Set<string>
): ResolutionChunk[] {
  const chunks: ResolutionChunk[] = [];
  for (const [hint, batchUsers] of batches) {
    const isNational = hint === NATIONAL_KEY;
    const campusLabel = isNational ? "National/unknown" : hint;
    const candidates = isNational
      ? [...allCandidates]
      : [...(candidatesByCampus.get(hint) ?? new Set<string>())];
    for (let i = 0; i < batchUsers.length; i += AI_CHUNK_SIZE) {
      chunks.push({
        campusLabel,
        candidates,
        users: batchUsers.slice(i, i + AI_CHUNK_SIZE),
      });
    }
  }
  return chunks;
}

async function resolveChunkSafe(
  chunk: ResolutionChunk,
  index: number
): Promise<DepartmentResolution[]> {
  try {
    const result = await resolveDepartments({
      campusLabel: chunk.campusLabel,
      candidates: chunk.candidates,
      users: chunk.users.map((u) => ({
        email: emailLocalPart(u.mail ?? u.userPrincipalName),
        office: u.officeLocation ?? "",
        ref: u.id,
      })),
    });
    console.info(
      `${LOG} chunk #${index + 1} resolved (${chunk.campusLabel}, ${chunk.users.length} users → ${result.length} resolutions)`
    );
    return result;
  } catch (error) {
    // Degrade a failed batch to manual rather than aborting the run — but make
    // the failure visible: a silent catch here looks identical to "nothing
    // happening" when the model name or API key is wrong.
    console.error(
      `${LOG} chunk #${index + 1} (${chunk.campusLabel}, ${chunk.users.length} users) FAILED:`,
      error instanceof Error ? error.message : error
    );
    return chunk.users.map((u) => ({
      ref: u.id,
      classification: "manual" as const,
      department: null,
      campus: null,
      confidence: "low" as const,
      reasoning: "AI resolution failed for this batch",
    }));
  }
}

async function persistSnapshot(snapshot: RemediationSnapshot): Promise<void> {
  const { db } = await createAdminClient();
  const { plan, inactive } = snapshot;
  await db.createRow("app", SNAPSHOT_TABLE, ID.unique(), {
    generated_at: snapshot.generatedAt,
    generated_by: snapshot.generatedBy,
    total_scanned: plan.totalScanned,
    safe_count: plan.safe.length,
    review_count: plan.review.length,
    manual_count: plan.manual.length,
    closed_count: plan.closed.length,
    result: JSON.stringify({ plan, inactive }),
  });
}

function trimGroups(
  groups: RemediationGroup[],
  handledIds: Set<string>
): RemediationGroup[] {
  return groups
    .map((group) => ({
      ...group,
      affectedUsers: group.affectedUsers.filter((u) => !handledIds.has(u.id)),
    }))
    .filter((group) => group.affectedUsers.length > 0);
}

function trimPlan(
  plan: DepartmentRemediationPlan,
  handledIds: Set<string>
): DepartmentRemediationPlan {
  return {
    ...plan,
    closed: trimGroups(plan.closed, handledIds),
    manual: plan.manual.filter((m) => !handledIds.has(m.user.id)),
    review: trimGroups(plan.review, handledIds),
    safe: trimGroups(plan.safe, handledIds),
  };
}

// Removes already-handled users from the persisted snapshot so a page refresh
// never re-offers them. `scope` selects which parts of the snapshot to trim: a
// department apply touches `plan`; a deactivation touches BOTH `inactive` and
// `plan`, since a disabled account must not be re-offered for department
// remediation either.
async function removeUsersFromSnapshot(
  handledIds: Set<string>,
  scope: { inactive: boolean; plan: boolean }
): Promise<void> {
  if (handledIds.size === 0) {
    return;
  }
  const { db } = await createAdminClient();
  const rows = await db.listRows<
    Models.Row & { generated_at: string; result: string | null }
  >("app", SNAPSHOT_TABLE, [Query.orderDesc("generated_at"), Query.limit(1)]);
  const latest = rows.rows[0];
  if (!latest?.result) {
    return;
  }
  const parsed = JSON.parse(latest.result);
  const plan: DepartmentRemediationPlan = parsed.plan ?? parsed;
  const inactive: M365UserListItem[] = parsed.inactive ?? [];

  const nextPlan = scope.plan ? trimPlan(plan, handledIds) : plan;
  const nextInactive = scope.inactive
    ? inactive.filter((u) => !handledIds.has(u.id))
    : inactive;

  await db.updateRow("app", SNAPSHOT_TABLE, latest.$id, {
    safe_count: nextPlan.safe.length,
    review_count: nextPlan.review.length,
    manual_count: nextPlan.manual.length,
    closed_count: nextPlan.closed.length,
    result: JSON.stringify({ plan: nextPlan, inactive: nextInactive }),
  });
}

// Drops resource mailboxes (rooms / equipment / shared) from a user list using
// each account's mailbox userPurpose. Best-effort: unreadable mailboxes are
// kept (treated as real users) rather than silently removed.
async function excludeResourceMailboxes(
  graph: ReturnType<typeof getGraphService>,
  users: M365UserListItem[]
): Promise<M365UserListItem[]> {
  const purposes = await mapWithConcurrency(users, 10, (user) =>
    graph.getMailboxUserPurpose(user.id)
  );
  return users.filter(
    (_, index) => !RESOURCE_PURPOSES.has((purposes[index] ?? "").toLowerCase())
  );
}

async function deactivateOneAccount(
  graph: ReturnType<typeof getGraphService>,
  userId: string
): Promise<void> {
  // Validate the target is a licensed @biso.no tenant user before mutating it —
  // the userId is client-supplied, so never trust it straight to Graph.
  await getAllowedTenantUser(graph, userId);
  // Licenses are inherited from group membership and can't be removed per-user,
  // so just block sign-in by setting the account disabled.
  await graph.updateUser(userId, { accountEnabled: false });
}

export async function runDepartmentAnalysis(): Promise<
  ActionResult<RemediationSnapshot>
> {
  try {
    const ctx = await requireItPermission("it.users.editProfile");
    console.info(
      `${LOG} starting; fetching licensed M365 users + canonical data…`
    );
    const fetchStart = Date.now();
    const graph = getGraphService();
    const [licensed, data] = await Promise.all([
      graph.listLicensedUsers({
        allowedDomain: M365_DOMAIN,
        licensedOnly: true,
      }),
      loadCanonicalData(),
    ]);
    const { users, signInActivityAvailable } = licensed;
    console.info(
      `${LOG} fetched ${users.length} licensed users + ${data.departments.length} departments in ${Date.now() - fetchStart}ms (signInActivity ${signInActivityAvailable ? "available" : "UNAVAILABLE"})`
    );

    // Disabled-but-still-licensed accounts are dropped from the whole scan: they
    // need neither department remediation (don't re-offer Graph profile writes
    // for a blocked account) nor inactive deactivation (already disabled).
    const allListItems = users.map(toListItem);
    const listItems = allListItems.filter(
      (item) => item.accountEnabled !== false
    );
    const disabledExcluded = allListItems.length - listItems.length;
    const {
      campusNames,
      tokenToCampus,
      candidatesByCampus,
      allCandidates,
      closedKeys,
      inactiveDeptNames,
    } = buildCanonicalLookups(data);

    const batches = batchUsersByCampus(listItems, tokenToCampus);
    const chunks = buildResolutionChunks(
      batches,
      candidatesByCampus,
      allCandidates
    );
    console.info(
      `${LOG} prepared ${chunks.length} AI chunk(s) across ${batches.size} campus batch(es) for ${listItems.length} users; resolving (concurrency ${AI_CONCURRENCY})…`
    );

    const chunkResults = await mapWithConcurrency(
      chunks,
      AI_CONCURRENCY,
      resolveChunkSafe
    );

    const resolutions = new Map<string, DepartmentResolution>();
    for (const list of chunkResults) {
      for (const r of list) {
        resolutions.set(r.ref, r);
      }
    }

    const plan = buildRemediationPlan({
      users: listItems,
      resolutions,
      candidatesByCampus,
      closedKeys,
      inactiveDepartments: inactiveDeptNames,
      campusNames,
    });

    // Only compute the inactive list when real sign-in data was available.
    // Without it, every account's last activity falls back to its creation date,
    // which would wrongly flag long-lived but active accounts as inactive.
    const inactiveCandidates = signInActivityAvailable
      ? findInactiveAccounts(listItems, Date.now(), INACTIVE_MONTHS)
      : [];
    const inactive = signInActivityAvailable
      ? await excludeResourceMailboxes(graph, inactiveCandidates)
      : [];
    if (!signInActivityAvailable) {
      console.warn(
        `${LOG} signInActivity unavailable (no Entra ID P1?) — inactive-account detection suppressed`
      );
    }

    console.info(
      `${LOG} plan ready: ${plan.safe.length} safe · ${plan.review.length} review · ${plan.manual.length} manual · ${plan.closed.length} closed · ${plan.compliantCount} compliant · ${inactive.length} inactive (${inactiveCandidates.length - inactive.length} resource mailboxes excluded) (of ${plan.totalScanned}; ${disabledExcluded} disabled excluded)`
    );

    const snapshot: RemediationSnapshot = {
      generatedAt: new Date().toISOString(),
      generatedBy: ctx.email ?? ctx.userId,
      inactive,
      plan,
    };

    await persistSnapshot(snapshot);
    console.info(`${LOG} snapshot persisted; analysis complete`);

    await logAuditEvent(ctx, "it.m365.department.analysis", {
      resourceType: "m365.user",
      payload: {
        totalScanned: plan.totalScanned,
        safe: plan.safe.length,
        review: plan.review.length,
        manual: plan.manual.length,
        closed: plan.closed.length,
        compliant: plan.compliantCount,
        inactive: inactive.length,
      },
    });

    revalidatePath("/it/users/audit");
    return { data: snapshot };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function getLatestRemediationSnapshot(): Promise<
  ActionResult<RemediationSnapshot | null>
> {
  try {
    await requireItPermission("it.users.view");
    const { db } = await createAdminClient();
    const rows = await db.listRows<
      Models.Row & {
        generated_at: string;
        generated_by: string | null;
        result: string | null;
      }
    >("app", SNAPSHOT_TABLE, [Query.orderDesc("generated_at"), Query.limit(1)]);
    const latest = rows.rows[0];
    if (!latest?.result) {
      return { data: null };
    }
    // Newer rows store { plan, inactive }; older rows stored the plan directly.
    const parsed = JSON.parse(latest.result);
    const plan = parsed.plan ?? parsed;
    const inactive = parsed.inactive ?? [];
    return {
      data: {
        generatedAt: latest.generated_at,
        generatedBy: latest.generated_by ?? "unknown",
        inactive,
        plan,
      },
    };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function deactivateM365Account(
  userId: string
): Promise<ActionResult<{ ok: true }>> {
  try {
    const ctx = await requireItPermission("it.users.disable");
    const graph = getGraphService();
    await deactivateOneAccount(graph, userId);

    await removeUsersFromSnapshot(new Set([userId]), {
      inactive: true,
      plan: true,
    });

    await logAuditEvent(ctx, "it.m365.user.deactivate", {
      resourceType: "m365.user",
      resourceId: userId,
      payload: { disabled: true },
    });

    revalidatePath("/it/users/audit");
    return { data: { ok: true } };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function deactivateM365Accounts(
  userIds: string[]
): Promise<ActionResult<{ failed: number; succeeded: number }>> {
  try {
    const ctx = await requireItPermission("it.users.disable");
    const graph = getGraphService();

    const results = await mapWithConcurrency(
      userIds,
      DEACTIVATE_CONCURRENCY,
      async (userId) => {
        try {
          await deactivateOneAccount(graph, userId);
          return true;
        } catch (error) {
          console.error(
            `${LOG} deactivate failed for ${userId}:`,
            error instanceof Error ? error.message : error
          );
          return false;
        }
      }
    );

    const succeeded = results.filter(Boolean).length;
    const failed = results.length - succeeded;

    // Persist progress: drop the disabled users from BOTH the inactive list and
    // the department buckets — a disabled account must not be re-offered anywhere.
    await removeUsersFromSnapshot(
      new Set(userIds.filter((_, index) => results[index])),
      { inactive: true, plan: true }
    );

    await logAuditEvent(ctx, "it.m365.user.deactivate.bulk", {
      resourceType: "m365.user",
      payload: { requested: userIds.length, succeeded, failed },
    });

    revalidatePath("/it/users/audit");
    return { data: { failed, succeeded } };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function applyDepartmentFixes(
  decisions: DepartmentFixDecision[]
): Promise<ActionResult<DepartmentFixSummary>> {
  try {
    const ctx = await requireItPermission("it.users.editProfile");
    const data = await loadCanonicalData();

    // Authoritative department -> campus-name resolution. The campus written to
    // M365 is derived from the department here; the client-supplied campusName
    // is never trusted for the write.
    const prefixToId = buildCampusPrefixToId(data.canonical);
    const activeByName = new Map<string, CanonicalDepartment>();
    for (const dept of data.canonical) {
      // Only active, non-closed departments are valid write targets — a closed
      // (`- nedlagt`) or inactive (`active === false`) unit must never be
      // assigned, even if a client supplies its exact name.
      if (!(isClosedName(dept.name) || dept.active === false)) {
        activeByName.set(dept.name, dept);
      }
    }
    const resolveCampusName = (departmentName: string): string | null => {
      const dept = activeByName.get(departmentName);
      if (!dept) {
        return null;
      }
      const prefix = extractCampusPrefix(dept.name);
      const mappedId = prefix ? prefixToId.get(prefix) : undefined;
      const campusId = mappedId ?? dept.campusId;
      return data.campusIdToName.get(campusId) ?? null;
    };

    const updates: Array<{
      id: string;
      patch: { department: string; officeLocation: string };
    }> = [];
    const applied: Array<{
      department: string;
      campus: string;
      users: number;
    }> = [];
    for (const decision of decisions) {
      const campusName = resolveCampusName(decision.department);
      if (!campusName) {
        throw new Error(`"${decision.department}" is not a valid department.`);
      }
      applied.push({
        department: decision.department,
        campus: campusName,
        users: decision.userIds.length,
      });
      for (const userId of decision.userIds) {
        updates.push({
          id: userId,
          patch: {
            department: decision.department,
            officeLocation: campusName,
          },
        });
      }
    }

    // Validate every target is a licensed @biso.no tenant user before writing —
    // userIds are client-supplied and otherwise go straight to Graph. Re-read
    // each target so a stale snapshot (user disabled after analysis, or one that
    // predates the disabled-user filter) can't push a write to a blocked account.
    const graph = getGraphService();
    const targetIds = [...new Set(updates.map((u) => u.id))];
    const targets = await mapWithConcurrency(targetIds, AI_CONCURRENCY, (id) =>
      getAllowedTenantUser(graph, id)
    );
    const disabledIds = new Set(
      targets.filter((u) => u.accountEnabled === false).map((u) => u.id)
    );
    const writableUpdates = updates.filter((u) => !disabledIds.has(u.id));

    const results = await graph.batchUpdateUsers(writableUpdates);
    const failed = results
      .filter((r): r is { id: string; error: string } => r.error !== undefined)
      .map((r) => ({ userId: r.id, error: r.error }));
    const succeeded = results.length - failed.length;
    // Surface skipped disabled accounts as failures so the operator sees them.
    const allFailed = [
      ...failed,
      ...[...disabledIds].map((userId) => ({
        userId,
        error: "Account is disabled; skipped.",
      })),
    ];

    // Persist progress: drop applied AND skipped-disabled users from the snapshot
    // so neither is re-offered on refresh.
    await removeUsersFromSnapshot(
      new Set([
        ...results.filter((r) => r.error === undefined).map((r) => r.id),
        ...disabledIds,
      ]),
      { inactive: false, plan: true }
    );

    await logAuditEvent(ctx, "it.m365.user.department.bulkFix", {
      resourceType: "m365.user",
      payload: {
        succeeded,
        failedCount: allFailed.length,
        disabledSkipped: disabledIds.size,
        decisionCount: decisions.length,
        userCount: writableUpdates.length,
        applied,
      },
    });

    revalidatePath("/it/users/audit");
    return { data: { succeeded, failed: allFailed } };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

// Departments an operator may assign during remediation: the full canonical set
// (not the 200-capped portal list), excluding closed (`- nedlagt`) and inactive
// (`active === false`) units — the same set the write path accepts, so every
// visible option is applicable.
export async function listAssignableDepartments(): Promise<
  ActionResult<Array<{ campusName: string; name: string }>>
> {
  try {
    await requireItPermission("it.users.view");
    const data = await loadCanonicalData();
    const departments = data.canonical
      .filter((dept) => dept.active !== false && !isClosedName(dept.name))
      .map((dept) => ({
        name: dept.name,
        campusName: data.campusIdToName.get(dept.campusId) ?? "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { data: departments };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function getDepartmentDataHealth(): Promise<
  ActionResult<DepartmentDataHealthEntry[]>
> {
  try {
    await requireItPermission("it.users.view");
    const data = await loadCanonicalData();
    const nameCounts = new Map<string, number>();
    for (const department of data.departments) {
      nameCounts.set(
        department.Name,
        (nameCounts.get(department.Name) ?? 0) + 1
      );
    }

    const entries: DepartmentDataHealthEntry[] = [];
    for (const department of data.departments) {
      const issues: DepartmentDataIssue[] = [];
      if (TRAILING_WHITESPACE_REGEX.test(department.Name)) {
        issues.push("trailingWhitespace");
      }
      if ((nameCounts.get(department.Name) ?? 0) > 1) {
        issues.push("duplicateName");
      }
      if (isClosedName(department.Name) && department.active !== false) {
        issues.push("activeClosed");
      }
      if (issues.length > 0) {
        entries.push({
          id: department.$id,
          name: department.Name,
          campusName: data.campusIdToName.get(department.campus_id) ?? "—",
          issues,
        });
      }
    }
    return { data: entries };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}
