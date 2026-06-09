"use server";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Campus, Departments } from "@repo/api/types/appwrite";
import type {
  DepartmentDataHealthEntry,
  DepartmentDataIssue,
  DepartmentFixDecision,
  DepartmentFixSummary,
  DepartmentRemediationPlan,
  M365UserListItem,
  RemediationGroup,
} from "@repo/shared/types/user-management";
import { revalidatePath } from "next/cache";
import {
  buildCampusPrefixToId,
  type CanonicalDepartment,
  type ClassifierContext,
  classifyDepartmentValue,
  extractCampusPrefix,
  isClosedName,
} from "@/lib/it/department-matching";
import { requireItPermission } from "@/lib/it-permissions";
import { logAuditEvent } from "./audit-log";
import { getGraphService, M365_DOMAIN, toListItem } from "./it-users";

type ActionResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: string };

const TRAILING_WHITESPACE_REGEX = /\s$/;
const REVIEW_THRESHOLD = 0.8;
const MIN_PREFIX_LENGTH = 20;
const TIE_MARGIN = 0.1;

// Plain variant: bulk department fixes never create users, so the duplicate-UPN
// augmentation in it-users.ts's getErrorMessage is not needed here.
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
      Query.limit(1000), // includes closed (nedlagt) rows, unlike loadItLookupOptions
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

function isCompliant(
  user: M365UserListItem,
  group: {
    suggestedDepartment: string | null;
    suggestedCampusName: string | null;
  }
): boolean {
  return (
    group.suggestedDepartment !== null &&
    user.department === group.suggestedDepartment &&
    user.officeLocation === group.suggestedCampusName
  );
}

export async function getDepartmentRemediationPlan(): Promise<
  ActionResult<DepartmentRemediationPlan>
> {
  try {
    await requireItPermission("it.users.view");
    const graph = getGraphService();
    const [users, data] = await Promise.all([
      graph.listLicensedUsers({
        allowedDomain: M365_DOMAIN,
        licensedOnly: true,
      }),
      loadCanonicalData(),
    ]);

    const context: ClassifierContext = {
      canonical: data.canonical,
      campusPrefixToId: buildCampusPrefixToId(data.canonical),
      reviewThreshold: REVIEW_THRESHOLD,
      minPrefixLength: MIN_PREFIX_LENGTH,
      tieMargin: TIE_MARGIN,
    };

    // Group users by their distinct (trimmed) department string.
    const byValue = new Map<string, M365UserListItem[]>();
    for (const user of users) {
      const value = (user.department ?? "").trim();
      const list = byValue.get(value) ?? [];
      list.push(toListItem(user));
      byValue.set(value, list);
    }

    const safe: RemediationGroup[] = [];
    const review: RemediationGroup[] = [];
    const closed: RemediationGroup[] = [];
    let compliantCount = 0;

    for (const [value, groupUsers] of byValue) {
      const classification = classifyDepartmentValue(value, context);
      const suggestedCampusName = classification.suggestedCampusId
        ? (data.campusIdToName.get(classification.suggestedCampusId) ?? null)
        : null;
      const group: RemediationGroup = {
        value,
        tier: classification.tier,
        suggestedDepartment: classification.suggestedDepartment,
        suggestedCampusName,
        score: classification.score,
        affectedUsers: groupUsers,
      };

      if (classification.tier === "closed") {
        closed.push(group);
        continue;
      }
      if (
        classification.tier === "safe-exact" ||
        classification.tier === "safe-truncation"
      ) {
        // Drop users who are already fully compliant; keep those needing a write.
        const needsFix = groupUsers.filter((user) => !isCompliant(user, group));
        compliantCount += groupUsers.length - needsFix.length;
        if (needsFix.length > 0) {
          safe.push({ ...group, affectedUsers: needsFix });
        }
        continue;
      }
      review.push(group);
    }

    const sortByCount = (a: RemediationGroup, b: RemediationGroup) =>
      b.affectedUsers.length - a.affectedUsers.length;
    safe.sort(sortByCount);
    review.sort(sortByCount);
    closed.sort(sortByCount);

    return {
      data: {
        safe,
        review,
        closed,
        totalScanned: users.length,
        compliantCount,
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

    // The remediation hub lives at /it/users/audit; refresh it after writes.
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
