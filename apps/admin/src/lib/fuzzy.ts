const START_BONUS = 10;
const WORD_BOUNDARY_BONUS = 8;
const CONSECUTIVE_BONUS = 4;
const GAP_PENALTY = 1;
// Cap the gap penalty so a long skip to a later word can't drown out
// stronger signals like start/boundary bonuses.
const MAX_GAP_PENALTY = 3;
const ALNUM = /[a-z0-9]/;

/**
 * Subsequence fuzzy match. Returns null when `query` is not a subsequence of
 * `target` (case-insensitive); otherwise a score where higher is better.
 */
export function fuzzyScore(query: string, target: string): number | null {
  const q = query.trim().toLowerCase();
  if (q.length === 0) {
    return 0;
  }
  const t = target.toLowerCase();
  let score = 0;
  let searchFrom = 0;
  let prevIndex = -1;
  for (const char of q) {
    const index = t.indexOf(char, searchFrom);
    if (index === -1) {
      return null;
    }
    if (index === 0) {
      score += START_BONUS;
    } else if (!ALNUM.test(t[index - 1] ?? "")) {
      score += WORD_BOUNDARY_BONUS;
    }
    if (prevIndex !== -1 && index === prevIndex + 1) {
      score += CONSECUTIVE_BONUS;
    }
    score -= Math.min((index - searchFrom) * GAP_PENALTY, MAX_GAP_PENALTY);
    prevIndex = index;
    searchFrom = index + 1;
  }
  return score;
}
