const NON_KEY_CHARACTERS_RE = /[^a-z0-9]/g;

/**
 * A department name reduced to lowercase a–z and 0–9. Microsoft group names
 * hold no spaces, punctuation or letters like Ø, so the team for the
 * department "OSL SIVØK - BI Siviløkonomer" is named "OSLSIVKBISivilkonomer";
 * both reduce to "oslsivkbisivilkonomer".
 */
export function departmentNameKey(name: string): string {
  return name.toLowerCase().replace(NON_KEY_CHARACTERS_RE, "");
}

/**
 * Department ids for team-derived names, matched by {@link departmentNameKey}.
 * A key counts only when exactly one department has it: a key two
 * departments share resolves to neither, so a match never makes a
 * department's campus ambiguous (see `isOnlyDepartmentNamed`).
 */
export function matchDepartmentIdsByKey(
  names: readonly string[],
  departments: readonly { $id: string; Name: string }[]
): string[] {
  const idsByKey = new Map<string, string[]>();
  for (const department of departments) {
    const key = departmentNameKey(department.Name);
    const ids = idsByKey.get(key);
    if (ids) {
      ids.push(department.$id);
    } else {
      idsByKey.set(key, [department.$id]);
    }
  }

  const matched: string[] = [];
  for (const name of names) {
    const key = departmentNameKey(name);
    const ids = key ? idsByKey.get(key) : undefined;
    if (ids?.length === 1) {
      matched.push(ids[0]);
    }
  }
  return matched;
}
