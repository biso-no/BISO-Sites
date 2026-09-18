/**
 * Campus identity constants and approver routing.
 *
 * These mirror `apps/admin/src/lib/campus-constants.ts`. They are duplicated
 * rather than imported because that module lives inside an app, and importing
 * app internals into this runtime is exactly what this package must not do.
 * They are stable identity facts (the numeric campus ids are Appwrite row ids
 * that content rows already store), and the mirror is covered by a test that
 * fails if the two ever disagree.
 */

/** Campus team name → numeric `campus_id` stored on content rows. */
export const CAMPUS_NAME_TO_ID: Readonly<Record<string, string>> =
  Object.freeze({
    Oslo: "1",
    Bergen: "2",
    Trondheim: "3",
    Stavanger: "4",
    National: "5",
  });

export const CAMPUS_ID_TO_NAME: Readonly<Record<string, string>> =
  Object.freeze(
    Object.fromEntries(
      Object.entries(CAMPUS_NAME_TO_ID).map(([name, id]) => [id, name])
    )
  );

/** The campus id national/global content is filed under. */
export const NATIONAL_CAMPUS_ID = "5";

export const OPERATIONS_UNIT_TEAM_ID = "sg-app-dept-operationsunit";
export const HR_TEAM_ID = "sg-app-dept-hr";
export const MEMBERS_TEAM_ID = "biso-members";

export function campusLabel(campusId: string | null | undefined): string {
  if (!campusId) {
    return "no campus";
  }
  const name = CAMPUS_ID_TO_NAME[campusId];
  return name ? `${name} (campus ${campusId})` : `campus ${campusId}`;
}

/**
 * The `Ledelsen{City}` team id for a campus, or null for National.
 *
 * Team ids are the lowercased Azure display name, which is what makes this
 * derivable rather than a lookup.
 */
export function getCampusManagementTeamId(campusId: string): string | null {
  const campusName = CAMPUS_ID_TO_NAME[campusId];
  if (!campusName || campusName === "National") {
    return null;
  }
  return `sg-app-dept-ledelsen${campusName.toLowerCase()}`;
}

/**
 * Which team must approve an action.
 *
 * Mirrors `resolveApproverTeamId` in the admin app so an approval request filed
 * from here lands in the same inbox as one filed from the portal. Recruitment
 * routes to Operations Unit rather than campus management, matching the
 * HR-exclusive recruitment policy.
 */
export function resolveApproverTeamId(
  action: string,
  campusId?: string | null
): string {
  if (action === "jobs.publish" || action === "jobs.create") {
    return OPERATIONS_UNIT_TEAM_ID;
  }
  if (campusId) {
    return getCampusManagementTeamId(campusId) ?? OPERATIONS_UNIT_TEAM_ID;
  }
  return OPERATIONS_UNIT_TEAM_ID;
}
