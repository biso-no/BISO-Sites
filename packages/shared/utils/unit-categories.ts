/**
 * Categories for a BISO unit (`departments.type`).
 *
 * The Appwrite column is a free-text `string(20)`, so these values are the
 * application-level contract rather than a database enum — keep every value at
 * 20 characters or fewer or the write will be rejected.
 */

export const UNIT_CATEGORIES = [
  "society",
  "academic_association",
  "project",
  "staff_function",
  "national",
  "other",
] as const;

export type UnitCategory = (typeof UNIT_CATEGORIES)[number];

const MAX_UNIT_CATEGORY_LENGTH = 20;

/** i18n key under the `jobs.filters` / `units.filters` namespaces. */
export const UNIT_CATEGORY_MESSAGE_KEYS: Record<UnitCategory, string> = {
  society: "societies",
  academic_association: "academicAssociations",
  project: "projects",
  staff_function: "staffFunctions",
  national: "national",
  other: "other",
};

const UNIT_CATEGORY_SET = new Set<string>(UNIT_CATEGORIES);

/**
 * Legacy/free-text values that predate this list, mapped onto a canonical
 * category so existing rows keep rendering while they are migrated.
 */
const LEGACY_ALIASES: Record<string, UnitCategory> = {
  committee: "staff_function",
  service: "staff_function",
  staff: "staff_function",
  team: "society",
  association: "academic_association",
  fagforening: "academic_association",
  forening: "society",
  prosjekt: "project",
  nasjonal: "national",
};

/**
 * Normalises a raw `departments.type` value onto a `UnitCategory`.
 * Returns `null` when the unit has no usable category, so callers can decide
 * between hiding the unit and showing it as uncategorised.
 */
export const parseUnitCategory = (value: unknown): UnitCategory | null => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (normalized.length === 0) {
    return null;
  }
  if (UNIT_CATEGORY_SET.has(normalized)) {
    return normalized as UnitCategory;
  }
  return LEGACY_ALIASES[normalized] ?? null;
};

export const isUnitCategory = (value: unknown): value is UnitCategory =>
  typeof value === "string" && UNIT_CATEGORY_SET.has(value);

/** Guards the Appwrite `string(20)` limit before a write. */
export const assertStorableUnitCategory = (
  value: UnitCategory
): UnitCategory => {
  if (value.length > MAX_UNIT_CATEGORY_LENGTH) {
    throw new Error(
      `Unit category exceeds ${MAX_UNIT_CATEGORY_LENGTH} characters: ${value}`
    );
  }
  return value;
};
