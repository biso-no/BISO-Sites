import type { UserAuthContext } from "@/lib/authorization";
import { ROLES } from "@/lib/roles";

/**
 * Appwrite team synced from the Azure AD group `SG-App-Dept-ControlCommittee`.
 * The sync derives the id from the group's display name, so the id (unlike a
 * team's editable name) identifies the group.
 */
const CONTROL_COMMITTEE_TEAM_ID = "sg-app-dept-controlcommittee";

/** The control committee maintains the statutes and local laws. */
export function isControlCommittee(ctx: UserAuthContext): boolean {
  return ctx.departmentTeamIds.includes(CONTROL_COMMITTEE_TEAM_ID);
}

/** Who may manage every governing document, national and on any campus. */
export function canManageAllDocuments(ctx: UserAuthContext): boolean {
  return ctx.roles.includes(ROLES.GLOBAL_ADMIN) || isControlCommittee(ctx);
}

/**
 * The context to authorize document actions with. A control committee member
 * gets a global admin's reach here, whatever campus they belong to, so the
 * shared scope checks let them list, create, edit, publish and delete any
 * document. Use it ONLY for document authorization: the caller's real context
 * still governs every other surface, the audit log and nav access.
 */
export function documentAccessContext(ctx: UserAuthContext): UserAuthContext {
  if (ctx.roles.includes(ROLES.GLOBAL_ADMIN) || !isControlCommittee(ctx)) {
    return ctx;
  }
  return {
    ...ctx,
    activeCampusId: undefined,
    roles: [...ctx.roles, ROLES.GLOBAL_ADMIN],
  };
}
