import type {
  DepartmentRemediationPlan,
  DepartmentResolution,
  M365UserListItem,
  ManualRemediationUser,
  RemediationGroup,
} from "@repo/shared/types/user-management";
import { normalizeWithCampus } from "./department-matching";

export interface BucketingInput {
  campusNames: Set<string>;
  candidatesByCampus: Map<string, Set<string>>; // campus name -> canonical dept names
  closedKeys: Set<string>; // campus-scoped normalizeWithCampus keys (full + suffix-stripped) of inactive/closed depts
  inactiveDepartments: Set<string>; // exact names of inactive/closed canonical depts
  resolutions: Map<string, DepartmentResolution>; // keyed by user id
  users: M365UserListItem[];
}

interface Target {
  campus: string;
  department: string;
}

// U+241F (unit separator) joins the "{department}{SEP}{campus}" group key.
// Canonical department names never contain this control char, so key collisions
// are not a practical concern.
const GROUP_SEP = "␟";

// Returns the canonical write target when the AI answer is on-list for a valid
// campus, else null (off-list / unknown campus / no department => manual).
export function validateResolution(
  resolution: DepartmentResolution,
  candidatesByCampus: Map<string, Set<string>>,
  campusNames: Set<string>
): Target | null {
  const campus = resolution.campus;
  if (!(campus && campusNames.has(campus))) {
    return null;
  }
  const candidates = candidatesByCampus.get(campus) ?? new Set<string>();
  if (resolution.classification === "management") {
    const department = `Ledelsen ${campus}`;
    return candidates.has(department) ? { department, campus } : null;
  }
  if (resolution.classification === "department" && resolution.department) {
    return candidates.has(resolution.department)
      ? { department: resolution.department, campus }
      : null;
  }
  return null;
}

function pushGroup(
  map: Map<string, RemediationGroup>,
  key: string,
  meta: Omit<RemediationGroup, "affectedUsers">,
  user: M365UserListItem
): void {
  const existing = map.get(key);
  if (existing) {
    existing.affectedUsers.push(user);
    return;
  }
  map.set(key, { ...meta, affectedUsers: [user] });
}

// True when the user already sits in the resolved target (department + campus),
// trimming both sides so a trailing-whitespace M365 value isn't a needless diff.
function isCompliant(user: M365UserListItem, target: Target): boolean {
  return (
    (user.department ?? "").trim() === target.department &&
    (user.officeLocation ?? "").trim() === target.campus
  );
}

export function buildRemediationPlan(
  input: BucketingInput
): DepartmentRemediationPlan {
  const {
    users,
    resolutions,
    candidatesByCampus,
    closedKeys,
    inactiveDepartments,
    campusNames,
  } = input;

  const safeByTarget = new Map<string, RemediationGroup>();
  const reviewByTarget = new Map<string, RemediationGroup>();
  const closedGroups = new Map<string, RemediationGroup>();
  const manual: ManualRemediationUser[] = [];
  let compliantCount = 0;

  for (const user of users) {
    const currentDept = (user.department ?? "").trim();

    // 1) Closed: current value corresponds to an inactive/closed department in
    //    the SAME campus (matched campus-scoped against both the full closed
    //    name and its pre-closure base).
    if (currentDept && closedKeys.has(normalizeWithCampus(currentDept))) {
      pushGroup(
        closedGroups,
        currentDept,
        {
          classification: "manual",
          confidence: null,
          reasoning: null,
          suggestedCampusName: null,
          suggestedDepartment: null,
          value: currentDept,
        },
        user
      );
      continue;
    }

    const resolution = resolutions.get(user.id);

    // 2) No resolution or explicit manual → manual bucket.
    if (!resolution || resolution.classification === "manual") {
      manual.push({ reasoning: resolution?.reasoning ?? null, user });
      continue;
    }

    const target = validateResolution(
      resolution,
      candidatesByCampus,
      campusNames
    );

    // 3) Off-list / unresolved → manual (cannot bulk-write a single target).
    if (!target) {
      manual.push({ reasoning: resolution.reasoning, user });
      continue;
    }

    const meta: Omit<RemediationGroup, "affectedUsers"> = {
      classification: resolution.classification,
      confidence: resolution.confidence,
      reasoning: resolution.reasoning,
      suggestedCampusName: target.campus,
      suggestedDepartment: target.department,
      value: target.department,
    };
    const key = `${target.department}${GROUP_SEP}${target.campus}`;

    // 4) Target department is inactive/closed → Closed bucket, BEFORE the
    //    compliance check: a user already sitting in a shut-down unit must be
    //    surfaced for reassignment, never silently counted as compliant.
    if (inactiveDepartments.has(target.department)) {
      pushGroup(closedGroups, key, meta, user);
      continue;
    }

    // 5) Already compliant → counted, not shown.
    if (isCompliant(user, target)) {
      compliantCount += 1;
      continue;
    }

    // 6) High confidence → safe, else → review.
    const bucket =
      resolution.confidence === "high" ? safeByTarget : reviewByTarget;
    pushGroup(bucket, key, meta, user);
  }

  const byCount = (a: RemediationGroup, b: RemediationGroup) =>
    b.affectedUsers.length - a.affectedUsers.length;

  return {
    closed: [...closedGroups.values()].sort(byCount),
    compliantCount,
    manual,
    review: [...reviewByTarget.values()].sort(byCount),
    safe: [...safeByTarget.values()].sort(byCount),
    totalScanned: users.length,
  };
}
