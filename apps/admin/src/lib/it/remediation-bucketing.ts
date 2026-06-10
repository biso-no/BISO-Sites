import type {
  DepartmentRemediationPlan,
  DepartmentResolution,
  M365UserListItem,
  ManualRemediationUser,
  RemediationGroup,
} from "@repo/shared/types/user-management";
import { normalizeForCompare } from "./department-matching";

export interface BucketingInput {
  campusNames: Set<string>;
  candidatesByCampus: Map<string, Set<string>>; // campus name -> canonical active dept names
  closedBaseNames: Set<string>; // normalizeForCompare(stripClosedSuffix(name)) of nedlagt depts
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

export function buildRemediationPlan(
  input: BucketingInput
): DepartmentRemediationPlan {
  const { users, resolutions, candidatesByCampus, closedBaseNames, campusNames } =
    input;

  const safeByTarget = new Map<string, RemediationGroup>();
  const reviewByTarget = new Map<string, RemediationGroup>();
  const closedByValue = new Map<string, RemediationGroup>();
  const manual: ManualRemediationUser[] = [];
  let compliantCount = 0;

  for (const user of users) {
    const currentDept = (user.department ?? "").trim();

    // 1) Closed: current value corresponds to a "- nedlagt" department.
    if (currentDept && closedBaseNames.has(normalizeForCompare(currentDept))) {
      pushGroup(
        closedByValue,
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

    // 4) Already compliant → counted, not shown. Trim both sides so a
    // trailing-whitespace M365 value doesn't trigger a needless re-write.
    if (
      (user.department ?? "").trim() === target.department &&
      (user.officeLocation ?? "").trim() === target.campus
    ) {
      compliantCount += 1;
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

    if (resolution.confidence === "high") {
      pushGroup(safeByTarget, key, meta, user);
    } else {
      pushGroup(reviewByTarget, key, meta, user);
    }
  }

  const byCount = (a: RemediationGroup, b: RemediationGroup) =>
    b.affectedUsers.length - a.affectedUsers.length;

  return {
    closed: [...closedByValue.values()].sort(byCount),
    compliantCount,
    manual,
    review: [...reviewByTarget.values()].sort(byCount),
    safe: [...safeByTarget.values()].sort(byCount),
    totalScanned: users.length,
  };
}
