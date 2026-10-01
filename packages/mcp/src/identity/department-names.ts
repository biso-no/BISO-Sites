/**
 * Matching a team-derived department name to a `departments` row.
 *
 * This is harder than it looks, and getting it wrong fails *closed* in a way
 * that is invisible: the member simply sees an empty database.
 *
 * The stored name is the 24SevenOffice accounting name, campus-prefixed with a
 * space — `"OSL Fadderullan"`, `"TRD Sosialt Utvalg"` — and sometimes carrying
 * a `"- nedlagt"` closure marker. The team name is derived from it by deleting
 * every space (`apps/admin/src/app/(portal)/_actions/it-users.ts:127`
 * builds `SG-App-Dept-${name.replace(/\s+/g, "")}`), giving
 * `SG-App-Dept-OSLFadderullan`. Reading it back,
 * `expandDepartmentName` re-inserts spaces only at a lower→upper boundary, so:
 *
 * ```
 * "OSL Fadderullan"    → SG-App-Dept-OSLFadderullan    → "OSLFadderullan"
 * "TRD Sosialt Utvalg" → SG-App-Dept-TRDSosialtUtvalg  → "TRDSosialt Utvalg"
 * "Operations Unit"    → SG-App-Dept-OperationsUnit    → "Operations Unit"   ✓
 * ```
 *
 * The round trip is lossy for every campus-prefixed name, because `OSLF` has no
 * lower→upper boundary to split on. An equality match against `Name` therefore
 * resolves nothing for ordinary campus departments — while still working for
 * the handful of unprefixed national ones like `"Operations Unit"`, which is
 * precisely why the gap survives unnoticed: the names that match belong to
 * global admins, who bypass scope entirely.
 *
 * The rule below compares on a whitespace-free, diacritic-folded key. When the
 * team name carries a glued campus prefix, the match additionally requires the
 * candidate row's `campus_id` to be that prefix's campus — so a member of
 * `SG-App-Dept-OSLFadderullan` resolves Oslo's Fadderullan and never
 * Trondheim's. A name that cannot be matched resolves to nothing, which the
 * scope engine treats as no membership: a failed match never widens access.
 *
 * The campus prefix and closure suffix themselves come from
 * `@repo/shared/utils/unit-names`, the repo's single definition of both.
 */

import {
  CAMPUS_PREFIXES,
  type CampusPrefix,
  extractCampusPrefix,
  stripCampusPrefix,
  stripClosedSuffix,
} from "@repo/shared/utils/unit-names";

/**
 * Campus prefix to the numeric `campus_id` stored on department rows.
 *
 * `apps/admin`'s `buildCampusPrefixToId` derives this from the data by majority
 * vote, which is the right call for a sync that must tolerate a mislabelled
 * row. Here the mapping is static: it gates authorization, so it must be
 * predictable and not depend on what happens to be in the table.
 *
 * The `satisfies` clause makes this a compile error if `CampusPrefix` ever
 * gains a member — BISO opening a fifth campus must not silently produce a
 * prefix that maps to nothing and fails every member of it closed.
 */
export const CAMPUS_PREFIX_TO_ID = {
  OSL: "1",
  BRG: "2",
  TRD: "3",
  STV: "4",
} as const satisfies Record<CampusPrefix, string>;

const DIACRITIC_MAP: Record<string, string> = {
  ø: "o",
  æ: "ae",
  å: "a",
};
const DIACRITIC_REGEX = /[øæå]/g;
const WHITESPACE_REGEX = /\s+/g;

/**
 * A campus prefix with the separating whitespace already deleted.
 *
 * Deliberately case-sensitive and anchored, matching the shared
 * `CAMPUS_PREFIX_REGEX` it complements: 24SevenOffice writes the prefix in
 * caps, and a case-insensitive form would strip the first three letters off any
 * unit whose name merely begins with "osl".
 */
const GLUED_CAMPUS_PREFIX_REGEX = new RegExp(
  `^(${CAMPUS_PREFIXES.join("|")})(?=.)`
);

/**
 * Whitespace-free comparison form, preserving case.
 *
 * Case is kept because deleting whitespace makes distinct names collide:
 * `"Oslo Noe"` and `"OSL O Noe"` both yield `OsloNoe`/`OSLONoe`, which differ
 * only in case. The derivation preserves that difference, so the strict key
 * must too.
 */
function strictKey(name: string): string {
  return stripClosedSuffix(name).replace(WHITESPACE_REGEX, "").trim();
}

/**
 * Whitespace-free, lowercase, diacritic-folded form.
 *
 * Tolerates casing and diacritic drift between 24SevenOffice and Azure AD, at
 * the cost of the collision described above — which is why a folded match is
 * only ever accepted when it is unambiguous.
 */
function foldedKey(name: string): string {
  return strictKey(name)
    .toLowerCase()
    .replace(DIACRITIC_REGEX, (char) => DIACRITIC_MAP[char] ?? char);
}

/** How confidently a team name identified a department row. */
export type MatchStrength = "strict" | "folded";

export interface DepartmentNameMatcher {
  /** `campus_id` implied by that prefix; null when the name carries none. */
  readonly campusId: string | null;
  /** Case-folded key with any campus prefix left in place. */
  readonly folded: string;
  /** Case-folded key with a glued campus prefix removed, when one was found. */
  readonly foldedWithoutPrefix: string | null;
  /** Case-preserving key with any campus prefix left in place. */
  readonly strict: string;
}

/**
 * Build the match candidates for a team-derived department name.
 *
 * Both a prefixed and an unprefixed key are produced because the team name may
 * legitimately be either: `"Operations Unit"` carries no prefix and must match
 * a row named exactly that, while `"OSLFadderullan"` must match `"OSL
 * Fadderullan"` — whose own prefixed key is `"oslfadderullan"` and so already
 * matches on `key` alone. The unprefixed key exists for rows whose stored name
 * omits the prefix even though the team name carries it.
 */
export function departmentNameMatcher(
  teamDerivedName: string
): DepartmentNameMatcher {
  const trimmed = stripClosedSuffix(teamDerivedName.trim());
  const spacedPrefix = extractCampusPrefix(trimmed);
  const withoutSpaced = spacedPrefix ? stripCampusPrefix(trimmed) : null;

  if (spacedPrefix && withoutSpaced) {
    return {
      strict: strictKey(trimmed),
      folded: foldedKey(trimmed),
      foldedWithoutPrefix: foldedKey(withoutSpaced),
      campusId: CAMPUS_PREFIX_TO_ID[spacedPrefix],
    };
  }

  const glued = trimmed.match(GLUED_CAMPUS_PREFIX_REGEX);
  if (glued) {
    const prefix = glued[1] as CampusPrefix;
    const remainder = trimmed.slice(prefix.length);
    return {
      strict: strictKey(trimmed),
      folded: foldedKey(trimmed),
      foldedWithoutPrefix: foldedKey(remainder),
      campusId: CAMPUS_PREFIX_TO_ID[prefix],
    };
  }

  return {
    strict: strictKey(trimmed),
    folded: foldedKey(trimmed),
    foldedWithoutPrefix: null,
    campusId: null,
  };
}

/** Comparison keys for a stored `departments.Name`. */
export function departmentRowKeys(storedName: string): {
  strict: string;
  folded: string;
  foldedWithoutPrefix: string;
  /** `campus_id` implied by the stored name's own prefix, if it has one. */
  prefixCampusId: string | null;
} {
  const trimmed = stripClosedSuffix(storedName.trim());
  const prefix = extractCampusPrefix(trimmed);
  return {
    strict: strictKey(trimmed),
    folded: foldedKey(trimmed),
    foldedWithoutPrefix: foldedKey(stripCampusPrefix(trimmed)),
    prefixCampusId: prefix ? CAMPUS_PREFIX_TO_ID[prefix] : null,
  };
}

/**
 * How well, if at all, this team-derived name identifies this department row.
 *
 * A match on the *unprefixed* key is only accepted when the campus agrees,
 * because `"Fadderullan"` exists once per campus. A match on the full key needs
 * no campus check — it already contains the prefix that distinguishes them.
 *
 * Returns `null` for no match. The caller must prefer `"strict"` hits and treat
 * an ambiguous set of `"folded"` hits as no match at all; see
 * `resolveDepartmentIds`.
 */
export function departmentNameMatch(
  matcher: DepartmentNameMatcher,
  row: { Name?: string | null; campus_id?: string | null }
): MatchStrength | null {
  const storedName = row.Name?.trim();
  if (!storedName) {
    return null;
  }
  const rowKeys = departmentRowKeys(storedName);

  if (matcher.strict && matcher.strict === rowKeys.strict) {
    return "strict";
  }
  // A folded match tolerates casing and diacritic drift, but folding also
  // collapses distinctions that whitespace deletion has already blurred:
  // "Oslo Noe" and "OSL O Noe" both fold to "oslonoe". Requiring the two names
  // to agree on whether they carry a campus prefix separates them again —
  // a prefixed name and an unprefixed one are not the same unit, and if they
  // really were spelled identically the strict rule above would have fired.
  if (
    matcher.folded &&
    matcher.folded === rowKeys.folded &&
    matcher.campusId === rowKeys.prefixCampusId
  ) {
    return "folded";
  }
  if (!matcher.foldedWithoutPrefix) {
    return null;
  }
  if (matcher.foldedWithoutPrefix !== rowKeys.foldedWithoutPrefix) {
    return null;
  }
  // Unprefixed keys collide across campuses by design, so the prefix's campus
  // has to agree with the row's. A row with no campus_id cannot be confirmed
  // and is refused.
  if (Boolean(row.campus_id) && matcher.campusId === row.campus_id) {
    return "folded";
  }
  return null;
}
