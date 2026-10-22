import {
  CAMPUS_IDS,
  NATIONAL_CAMPUS_ID,
} from "@repo/shared/utils/benefit-catalog";

/** Remembers the last board tab. Scoped to `/benefits`, read on the server. */
export const BENEFIT_BOARD_CAMPUS_COOKIE = "benefits_board_campus";

/** Oslo, Bergen, Trondheim, Stavanger, then Hele BISO. */
export const BOARD_CAMPUS_ORDER: readonly string[] = [
  ...CAMPUS_IDS,
  NATIONAL_CAMPUS_ID,
];

export function isBoardCampusId(value: unknown): value is string {
  return typeof value === "string" && BOARD_CAMPUS_ORDER.includes(value);
}

/** The campuses the viewer may open, in the fixed tab order. */
export function orderBoardCampuses(visibleCampusIds: readonly string[]) {
  return BOARD_CAMPUS_ORDER.filter((id) => visibleCampusIds.includes(id));
}

interface BoardCampusChoice {
  editableCampusIds: readonly string[];
  /** The `benefits_board_campus` cookie. */
  remembered?: string | null;
  /** The `campus` search param. */
  requested?: string | null;
  visibleCampusIds: readonly string[];
}

/**
 * The tab to open: the search param, else the remembered tab, else the first
 * campus the viewer can edit, else Hele BISO. A choice the viewer cannot see
 * is skipped; with none left, the first visible tab opens. Null when the
 * viewer sees no campus at all.
 */
export function resolveBoardCampus({
  editableCampusIds,
  remembered,
  requested,
  visibleCampusIds,
}: BoardCampusChoice): string | null {
  const candidates = [
    requested,
    remembered,
    editableCampusIds[0],
    NATIONAL_CAMPUS_ID,
  ];
  const visible = orderBoardCampuses(visibleCampusIds);
  for (const candidate of candidates) {
    if (candidate && visible.includes(candidate)) {
      return candidate;
    }
  }
  return visible[0] ?? null;
}
