import { Query } from "@repo/api";
import type {
  BigEventParticipantRow,
  BigEventRow,
} from "@repo/shared/big-events/types";
import type { UserAuthContext } from "@/lib/authorization";
import { NATIONAL_CAMPUS_ID } from "@/lib/event-scope";
import { ROLES } from "@/lib/roles";
import { NO_MATCH_FILTER } from "@/lib/utils/authorization";

/**
 * Who may see and manage a big event (spec D2). `full` manages the event and
 * sees every participant; `campus` (a campus admin on a National event) sees
 * only participants from their own campuses; `null` has no access.
 */
export type BigEventAccess =
  | { level: "full" }
  | { level: "campus"; campusIds: string[] }
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
  if (event.campus_id === NATIONAL_CAMPUS_ID) {
    return { campusIds: [...ctx.managedCampusIds], level: "campus" };
  }
  if (ctx.managedCampusIds.includes(event.campus_id)) {
    return { level: "full" };
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
  return access?.level === "full";
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
