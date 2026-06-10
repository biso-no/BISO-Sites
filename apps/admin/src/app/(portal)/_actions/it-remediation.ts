"use server";

import { resolveDepartments } from "@repo/ai/server/department-resolver";
import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type {
  Campus,
  Departments,
  M365RemediationSnapshot,
} from "@repo/api/types/appwrite";
import type {
  DepartmentDataHealthEntry,
  DepartmentDataIssue,
  DepartmentFixDecision,
  DepartmentFixSummary,
  DepartmentResolution,
  M365UserListItem,
  RemediationSnapshot,
} from "@repo/shared/types/user-management";
import { revalidatePath } from "next/cache";
import { mapWithConcurrency } from "@/lib/it/concurrency";
import {
  buildCampusPrefixToId,
  type CanonicalDepartment,
  extractCampusPrefix,
  isClosedName,
  normalizeForCompare,
  stripClosedSuffix,
} from "@/lib/it/department-matching";
import { emailLocalPart, extractCampusHint } from "@/lib/it/email-classify";
import { getGraphService, M365_DOMAIN, toListItem } from "@/lib/it/graph";
import { buildRemediationPlan } from "@/lib/it/remediation-bucketing";
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

interface CanonicalData {
  campusIdToName: Map<string, string>;
  canonical: CanonicalDepartment[]; // includes closed (nedlagt) entries
  departments: Departments[];
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
  }));

  return { canonical, campusIdToName, departments: departments.rows };
}

export async function runDepartmentAnalysis(): Promise<
  ActionResult<RemediationSnapshot>
> {
  try {
    const ctx = await requireItPermission("it.users.editProfile");
    const graph = getGraphService();
    const [users, data] = await Promise.all([
      graph.listLicensedUsers({
        allowedDomain: M365_DOMAIN,
        licensedOnly: true,
      }),
      loadCanonicalData(),
    ]);

    const listItems = users.map(toListItem);

    // Build canonical lookups.
    const campusNames = new Set(data.campusIdToName.values());
    const tokenToCampus = new Map<string, string>();
    for (const name of campusNames) {
      tokenToCampus.set(name.toLowerCase(), name);
    }
    const candidatesByCampus = new Map<string, Set<string>>();
    const allCandidates = new Set<string>();
    for (const dept of data.canonical) {
      if (isClosedName(dept.name)) {
        continue;
      }
      const campusName = data.campusIdToName.get(dept.campusId);
      if (!campusName) {
        continue;
      }
      const set = candidatesByCampus.get(campusName) ?? new Set<string>();
      set.add(dept.name);
      candidatesByCampus.set(campusName, set);
      allCandidates.add(dept.name);
    }
    const closedBaseNames = new Set(
      data.canonical
        .filter((d) => isClosedName(d.name))
        .map((d) => normalizeForCompare(stripClosedSuffix(d.name)))
    );

    // Batch users by campus hint.
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

    // Chunk every batch and resolve with bounded concurrency.
    interface Chunk {
      campusLabel: string;
      candidates: string[];
      users: M365UserListItem[];
    }
    const chunks: Chunk[] = [];
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

    const chunkResults = await mapWithConcurrency(
      chunks,
      AI_CONCURRENCY,
      async (chunk): Promise<DepartmentResolution[]> => {
        try {
          return await resolveDepartments({
            campusLabel: chunk.campusLabel,
            candidates: chunk.candidates,
            users: chunk.users.map((u) => ({
              department: u.department ?? "",
              email: emailLocalPart(u.mail ?? u.userPrincipalName),
              office: u.officeLocation ?? "",
              ref: u.id,
            })),
          });
        } catch {
          // Degrade a failed batch to manual rather than aborting the run.
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
      closedBaseNames,
      campusNames,
    });

    const snapshot: RemediationSnapshot = {
      generatedAt: new Date().toISOString(),
      generatedBy: ctx.email ?? ctx.userId,
      plan,
    };

    const { db } = await createAdminClient();
    await db.createRow("app", SNAPSHOT_TABLE, ID.unique(), {
      generated_at: snapshot.generatedAt,
      generated_by: snapshot.generatedBy,
      total_scanned: plan.totalScanned,
      safe_count: plan.safe.length,
      review_count: plan.review.length,
      manual_count: plan.manual.length,
      closed_count: plan.closed.length,
      result: JSON.stringify(snapshot.plan),
    });

    await logAuditEvent(ctx, "it.m365.department.analysis", {
      resourceType: "m365.user",
      payload: {
        totalScanned: plan.totalScanned,
        safe: plan.safe.length,
        review: plan.review.length,
        manual: plan.manual.length,
        closed: plan.closed.length,
        compliant: plan.compliantCount,
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
    const rows = await db.listRows<M365RemediationSnapshot>(
      "app",
      SNAPSHOT_TABLE,
      [Query.orderDesc("generated_at"), Query.limit(1)]
    );
    const latest = rows.rows[0];
    if (!latest?.result) {
      return { data: null };
    }
    return {
      data: {
        generatedAt: latest.generated_at,
        generatedBy: latest.generated_by ?? "unknown",
        plan: JSON.parse(latest.result),
      },
    };
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
      if (!isClosedName(dept.name)) {
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

    const results = await getGraphService().batchUpdateUsers(updates);
    const failed = results
      .filter((r): r is { id: string; error: string } => r.error !== undefined)
      .map((r) => ({ userId: r.id, error: r.error }));
    const succeeded = results.length - failed.length;

    await logAuditEvent(ctx, "it.m365.user.department.bulkFix", {
      resourceType: "m365.user",
      payload: {
        succeeded,
        failedCount: failed.length,
        decisionCount: decisions.length,
        userCount: updates.length,
        applied,
      },
    });

    revalidatePath("/it/users/audit");
    return { data: { succeeded, failed } };
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
