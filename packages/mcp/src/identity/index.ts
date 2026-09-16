/**
 * The identity layer, for callers that need the policy without the server.
 *
 * An app integrating this package later can reuse the scope engine and the
 * principal derivation directly rather than reimplementing them a third time
 * (the repo already has two: `apps/admin`'s `getUserAuthContext` and
 * `apps/api`'s `getAdminScope`, which disagree — see `principal.ts`).
 */

export {
  CAMPUS_ID_TO_NAME,
  CAMPUS_NAME_TO_ID,
  campusLabel,
  getCampusManagementTeamId,
  HR_TEAM_ID,
  MEMBERS_TEAM_ID,
  NATIONAL_CAMPUS_ID,
  OPERATIONS_UNIT_TEAM_ID,
  resolveApproverTeamId,
} from "./campus";
export {
  ANONYMOUS_PRINCIPAL,
  describePrincipal,
  hasDepartmentMembership,
  isAnonymous,
  isCampusAdmin,
  isGlobalAdmin,
  isHr,
  POLICY_PROFILES,
  type PolicyProfile,
  type Principal,
  ROLE_CAMPUS_ADMIN,
  ROLE_DEPARTMENT,
  ROLE_GLOBAL_ADMIN,
  ROLE_HR,
  type TeamLike,
} from "./principal";
export {
  deriveRoles,
  isHrDepartment,
  parseTeamMemberships,
  resolvePrincipal,
  resolveProfile,
  type TeamParseResult,
} from "./resolve";
export {
  approverTeamsFor,
  assertPublishAccess,
  assertWriteAccess,
  canPublish,
  canReadRow,
  describeScope,
  RELATIONSHIP_SCOPE_FIELDS,
  relationId,
  rowOwnership,
  type ScopeFields,
  scopeQueries,
} from "./scope";
