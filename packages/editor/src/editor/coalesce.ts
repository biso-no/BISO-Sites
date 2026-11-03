/** Edits sharing a coalesce key within this window are one undo step. */
export const COALESCE_MS = 1000;

/**
 * Whether an edit at `now` opens an undo step of its own: nothing came
 * before it (`lastAt` is `null`), or the last edit was `COALESCE_MS` or more
 * ago. The page's history and a rich text field's own both step here, so
 * neither undo spans two of the other's steps.
 */
export function opensNewStep(lastAt: number | null, now: number): boolean {
  return lastAt === null || now - lastAt >= COALESCE_MS;
}
