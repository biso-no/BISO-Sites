/**
 * Which `departments` rows a student is allowed to see.
 *
 * The `departments` table is a mirror of the 24SevenOffice chart of accounts,
 * not a directory of student units. Alongside the ~125 real units it carries
 * bookkeeping ledgers and national governance bodies that exist only so a cost
 * can be booked against them. Those rows are `active: true` — they are live
 * accounts — so `active` alone is NOT a publication signal, and every public
 * surface must run its listing through `isPublicUnit` as well.
 *
 * `apps/admin` deliberately does NOT apply this filter: staff manage the whole
 * chart of accounts, including the ledgers.
 *
 * Two rules, both matched against the RAW stored name:
 *
 * 1. `Drift *` — the operating ledger of each campus plus `Drift BISO`. A
 *    prefix rule rather than a list, because a new campus brings a new one.
 * 2. An explicit denylist of national accounting and governance rows. Matched
 *    WITHOUT stripping the campus prefix on purpose: a campus unit legitimately
 *    named "OSL Board" or "BRG HR" must keep its page, and only the bare
 *    national row is meant to disappear.
 *
 * The governance bodies are not hidden because they are secret — they are
 * already presented, with live Microsoft 365 board data, under National
 * leadership on `/campus`. Listing them again as "units" duplicated them.
 */

const WHITESPACE_REGEX = /\s+/g;

/** Operating-ledger prefix. `Drift BISO`, `Drift Campus Oslo`, … */
const OPERATING_LEDGER_PREFIX = "drift";

/**
 * National rows that are accounting entities or governance bodies rather than
 * student units. Lowercased, whitespace-collapsed; see `normalize` below.
 */
const NON_PUBLIC_UNIT_NAMES: ReadonlySet<string> = new Set([
  // Accounting / ledger entities
  "accounting departement", // 24SO's own spelling
  "accounting department",
  "national - accounting",
  "student groups outside biso (gift fund)",
  "samlinger - cl",
  "investment committee",
  "finance committee",
  // Governance bodies, already on /campus under National leadership
  "board",
  "operations unit",
  "operations unit / administration",
  "control committee",
  "hr",
  "administration",
  "national administration",
  "organisasjonsstrukturkomiteen",
  "academic/political forum",
  "branding committee",
]);

const normalize = (name: string): string =>
  name.trim().toLowerCase().replace(WHITESPACE_REGEX, " ");

/**
 * Is this unit's *name* one a student should see listed?
 *
 * Says nothing about `active` — callers must check that too. Kept separate so
 * the two reasons a unit is absent stay distinguishable in a query plan:
 * `active` is an Appwrite filter, this one is not expressible as a query and
 * runs in JS over the loaded page.
 */
export function isPublicUnitName(name: string | null | undefined): boolean {
  if (typeof name !== "string") {
    return false;
  }
  const normalized = normalize(name);
  if (normalized.length === 0) {
    return false;
  }
  if (
    normalized === OPERATING_LEDGER_PREFIX ||
    normalized.startsWith(`${OPERATING_LEDGER_PREFIX} `)
  ) {
    return false;
  }
  return !NON_PUBLIC_UNIT_NAMES.has(normalized);
}

/** Both halves of the public-visibility rule for a loaded department row. */
export function isPublicUnit(unit: {
  Name?: string | null;
  active?: boolean | null;
}): boolean {
  // `active` is nullable: legacy rows predating the 24SO sync carry no value
  // and are treated as active, matching `departmentScopeQueries` in
  // apps/admin/src/app/(portal)/_actions/departments.ts.
  if (unit.active === false) {
    return false;
  }
  return isPublicUnitName(unit.Name);
}
