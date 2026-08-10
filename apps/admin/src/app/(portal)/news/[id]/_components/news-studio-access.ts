export const getNewsAllowedDepartmentIds = (
  isDepartmentUser: boolean,
  memberships: Array<{ department_ref?: { $id?: string | null } | null }>
): string[] | undefined =>
  isDepartmentUser
    ? memberships
        .map((membership) => membership.department_ref?.$id)
        .filter((id): id is string => Boolean(id))
    : undefined;
