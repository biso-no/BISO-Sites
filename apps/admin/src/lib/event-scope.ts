import type { UserAuthContext } from "./authorization";
import { CAMPUS_NAME_TO_ID } from "./campus-constants";

export const NATIONAL_CAMPUS_ID = CAMPUS_NAME_TO_ID.National as string;

/**
 * Campus admins (campus leadership, which includes each campus's head of PR)
 * also run events hosted at the national level. Within the events surface
 * only, treat the National campus as one of their managed campuses so the
 * shared scope helpers (`applyScopeQueries`, `assertWriteAccess`,
 * `hasRowAccess`, `assertContentOwnership`) let them list, create, edit,
 * publish and delete national events. Every other surface keeps the
 * unmodified context. Global admins and department users are unchanged.
 */
export function withNationalEventScope(ctx: UserAuthContext): UserAuthContext {
  const isCampusAdmin =
    ctx.roles.includes("campusadmin") && ctx.managedCampusIds.length > 0;
  if (
    !isCampusAdmin ||
    ctx.roles.includes("globaladmin") ||
    ctx.managedCampusIds.includes(NATIONAL_CAMPUS_ID)
  ) {
    return ctx;
  }
  return {
    ...ctx,
    managedCampusIds: [...ctx.managedCampusIds, NATIONAL_CAMPUS_ID],
  };
}
