import { Query } from "@repo/api";
import type {
  BigEventGroupRow,
  BigEventMessageRow,
  BigEventParticipantRow,
  BigEventRow,
} from "@repo/shared/big-events/types";
import type { UserAuthContext } from "@/lib/authorization";
import { NATIONAL_CAMPUS_ID } from "@/lib/event-scope";
import { ROLES } from "@/lib/roles";
import { NO_MATCH_FILTER } from "@/lib/utils/authorization";
import { BIG_EVENT_CAMPUS_IDS } from "./form-schema";

/**
 * Who may see and manage a big event (spec D2). `full` (global admins and the
 * owning department) manages the event and sees every participant; `campus`
 * (campus admins) sees only participants from their own campuses and edits
 * settings only when `canEditSettings`; `null` has no access. Callers decide
 * permissions only through the helpers in this module, never by comparing
 * `level`.
 */
export type BigEventAccess =
  | { level: "full" }
  | { level: "campus"; campusIds: string[]; canEditSettings: boolean }
  | null;

const isGlobalAdmin = (ctx: UserAuthContext): boolean =>
  ctx.roles.includes(ROLES.GLOBAL_ADMIN);

const isCampusAdmin = (ctx: UserAuthContext): boolean =>
  ctx.roles.includes(ROLES.CAMPUS_ADMIN);

export function bigEventAccess(
  ctx: UserAuthContext,
  event: Pick<BigEventRow, "campus_id" | "department_id">
): BigEventAccess {
  if (isGlobalAdmin(ctx)) {
    return { level: "full" };
  }
  if (
    event.department_id !== null &&
    ctx.resolvedDepartmentIds.includes(event.department_id)
  ) {
    return { level: "full" };
  }
  if (!isCampusAdmin(ctx)) {
    return null;
  }
  const campusIds = ctx.managedCampusIds.filter(
    (id) => id !== NATIONAL_CAMPUS_ID
  );
  if (campusIds.length === 0) {
    return null;
  }
  if (event.campus_id === NATIONAL_CAMPUS_ID) {
    return { campusIds, canEditSettings: false, level: "campus" };
  }
  if (campusIds.includes(event.campus_id)) {
    return { campusIds, canEditSettings: true, level: "campus" };
  }
  return null;
}

export function canCreateBigEvent(
  ctx: UserAuthContext,
  campusId: string
): boolean {
  if (isGlobalAdmin(ctx)) {
    return true;
  }
  return (
    isCampusAdmin(ctx) &&
    campusId !== NATIONAL_CAMPUS_ID &&
    ctx.managedCampusIds.includes(campusId)
  );
}

export function canEditBigEventSettings(access: BigEventAccess): boolean {
  if (access === null) {
    return false;
  }
  return access.level === "full" || access.canEditSettings;
}

/** Query strings scoping a `listRows` on big_events to what the user may see. */
export function visibleBigEventFilters(ctx: UserAuthContext): string[] {
  if (isGlobalAdmin(ctx)) {
    return ctx.activeCampusId
      ? [Query.equal("campus_id", [ctx.activeCampusId])]
      : [];
  }
  const alternatives: string[] = [];
  if (isCampusAdmin(ctx) && ctx.managedCampusIds.length > 0) {
    alternatives.push(
      Query.equal("campus_id", [...ctx.managedCampusIds, NATIONAL_CAMPUS_ID])
    );
  }
  if (ctx.resolvedDepartmentIds.length > 0) {
    alternatives.push(
      Query.equal("department_id", [...ctx.resolvedDepartmentIds])
    );
  }
  const [only, ...rest] = alternatives;
  if (only === undefined) {
    return [NO_MATCH_FILTER];
  }
  return rest.length === 0 ? [only] : [Query.or(alternatives)];
}

/** Query strings restricting participants: none for full, campus-limited otherwise. */
export function participantCampusFilter(access: BigEventAccess): string[] {
  if (access === null) {
    return [NO_MATCH_FILTER];
  }
  if (access.level === "full") {
    return [];
  }
  if (access.campusIds.length === 0) {
    return [NO_MATCH_FILTER];
  }
  return [Query.equal("campus_id", access.campusIds)];
}

export function canSeeParticipant(
  access: BigEventAccess,
  participant: Pick<BigEventParticipantRow, "campus_id">
): boolean {
  if (access === null) {
    return false;
  }
  if (access.level === "full") {
    return true;
  }
  return (
    participant.campus_id !== null &&
    access.campusIds.includes(participant.campus_id)
  );
}

/**
 * Whether the caller may create, edit, fill or delete a group (N8): full
 * access manages every group; campus access only groups on its campuses, so a
 * group with no campus is for full access only (same rule as participants).
 */
export function canManageGroup(
  access: BigEventAccess,
  group: Pick<BigEventGroupRow, "campus_id">
): boolean {
  if (access === null) {
    return false;
  }
  if (access.level === "full") {
    return true;
  }
  return group.campus_id !== null && access.campusIds.includes(group.campus_id);
}

/**
 * Campuses the caller may create groups on (ruling R6), also before the big
 * event has any groups or people: campus access → its own campuses (never
 * National); full access → the big event's campus, or on a National big
 * event every campus with National last (the dialog drops it for buses).
 */
export function manageableGroupCampuses(
  access: BigEventAccess,
  event: Pick<BigEventRow, "campus_id">
): string[] {
  if (access === null) {
    return [];
  }
  if (access.level === "campus") {
    return [...access.campusIds];
  }
  if (event.campus_id !== NATIONAL_CAMPUS_ID) {
    return [event.campus_id];
  }
  return [
    ...BIG_EVENT_CAMPUS_IDS.filter((id) => id !== NATIONAL_CAMPUS_ID),
    NATIONAL_CAMPUS_ID,
  ];
}

/**
 * The campuses a message from the caller is limited to (ruling R22), stored
 * as its `campus_ids`: none for full access (every campus), the caller's own
 * campuses for campus access (spec D2: they reach only their campus).
 */
export function messageCampusIds(
  access: NonNullable<BigEventAccess>
): string[] {
  if (access.level === "full") {
    return [];
  }
  // An empty list would mean every campus; campus access always has one.
  if (access.campusIds.length === 0) {
    throw new Error("Campus access without a campus can't send messages");
  }
  return [...access.campusIds];
}

/**
 * Whether a message shows in the caller's history (ruling R22): full access
 * sees every message; campus access sees messages for any of its campuses
 * and organisation-wide ones (no campus).
 */
export function canSeeMessage(
  access: BigEventAccess,
  message: Pick<BigEventMessageRow, "campus_ids">
): boolean {
  if (access === null) {
    return false;
  }
  if (access.level === "full") {
    return true;
  }
  const campuses = message.campus_ids ?? [];
  return (
    campuses.length === 0 ||
    campuses.some((id) => access.campusIds.includes(id))
  );
}

/**
 * Whether the caller may cancel, try again or unpin a message: full access
 * any message; campus access only one limited to its own campuses, the
 * messages it could have sent itself.
 */
export function canManageMessage(
  access: BigEventAccess,
  message: Pick<BigEventMessageRow, "campus_ids">
): boolean {
  if (access === null) {
    return false;
  }
  if (access.level === "full") {
    return true;
  }
  const campuses = message.campus_ids ?? [];
  return (
    campuses.length > 0 && campuses.every((id) => access.campusIds.includes(id))
  );
}
