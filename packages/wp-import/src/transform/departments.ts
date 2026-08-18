export const AUTO_ACCEPT_CONFIDENCE = 0.85;

export interface DepartmentRecord {
  campus_id: string;
  Id: string;
  Name: string;
}

export interface DepartmentMatch {
  confidence: number;
  departmentId: string | null;
  matchedName: string | null;
}

const CAMPUS_PREFIX = /^(osl|brg|trd|stv)\s+/i;
const STATUS_SUFFIX =
  /\s*[-–]\s*(nedlagt|lagt ned|inaktiv|overf(?:ø|o)rt til .*|flyttet til .*|bruk .*|n(?:å|a) et prosjekt.*|kan brukes.*|sl(?:å|a)tt sammen.*|engangsprosjekt.*)$/i;
const PARENTHESISED = /\([^)]*\)/g;
const NON_ALPHANUMERIC = /[^a-z0-9]+/g;

const CHARACTER_FOLDS: [RegExp, string][] = [
  [/æ/g, "ae"],
  [/ø/g, "oe"],
  [/å/g, "aa"],
];

export function normalizeDepartmentName(name: string): string {
  let value = name.toLowerCase().trim();
  value = value.replace(STATUS_SUFFIX, "");
  value = value.replace(CAMPUS_PREFIX, "");
  value = value.replace(PARENTHESISED, " ");
  for (const [pattern, replacement] of CHARACTER_FOLDS) {
    value = value.replace(pattern, replacement);
  }
  value = value.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return value.replace(NON_ALPHANUMERIC, " ").trim().replace(/\s+/g, " ");
}

function tokens(value: string): Set<string> {
  return new Set(value.split(" ").filter((token) => token.length > 0));
}

/** Sørensen–Dice coefficient over token sets. */
function tokenSimilarity(left: string, right: string): number {
  const a = tokens(left);
  const b = tokens(right);
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  let shared = 0;
  for (const token of a) {
    if (b.has(token)) {
      shared += 1;
    }
  }
  return (2 * shared) / (a.size + b.size);
}

export type DepartmentMappingRow = Record<string, string>;

/**
 * Appends any previously-reviewed mapping row whose (campus, name) pair is
 * absent from the current snapshot. `resolved_id` is hand-entered review
 * work — silently dropping it because a narrower/newer snapshot no longer
 * surfaces that pair is the worst failure mappings/departments.csv can have,
 * so every row a human has already resolved is carried forward untouched.
 * Unresolved rows that drop out of the snapshot are not preserved; they
 * carry no human work and would otherwise bloat the file with stale
 * suggestions forever.
 */
export function preserveUnseenResolvedRows(
  currentRows: DepartmentMappingRow[],
  previousRows: Map<string, DepartmentMappingRow>,
  seenKeys: Set<string>
): DepartmentMappingRow[] {
  const preserved: DepartmentMappingRow[] = [];
  for (const [key, row] of previousRows) {
    if (row.resolved_id && !seenKeys.has(key)) {
      preserved.push(row);
    }
  }
  return [...currentRows, ...preserved];
}

export function matchDepartment(
  wpName: string,
  campusId: string,
  departments: DepartmentRecord[]
): DepartmentMatch {
  const needle = normalizeDepartmentName(wpName);
  const candidates = departments.filter(
    (department) => department.campus_id === campusId
  );

  let best: DepartmentMatch = {
    confidence: 0,
    departmentId: null,
    matchedName: null,
  };

  for (const candidate of candidates) {
    const normalized = normalizeDepartmentName(candidate.Name);
    let score = 0;

    if (normalized === needle && needle.length > 0) {
      score = 1;
    } else if (
      needle.length > 0 &&
      (normalized.startsWith(`${needle} `) || normalized.endsWith(` ${needle}`))
    ) {
      score = 0.9;
    } else {
      score = tokenSimilarity(needle, normalized);
    }

    if (score > best.confidence) {
      best = {
        confidence: score,
        departmentId: null,
        matchedName: candidate.Name,
      };
      if (score >= AUTO_ACCEPT_CONFIDENCE) {
        best.departmentId = candidate.Id;
      }
    }
  }

  return best;
}
