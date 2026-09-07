/**
 * The campus a page save should be attributed to.
 *
 * An existing page's campus is its own, not the current editor's. Re-deriving
 * it from the author on every save (via `resolvePageCampusId`) is what caused
 * a global admin's autosave of a department page to fail: their own campus
 * context is null when they haven't picked one in the campus switcher, and
 * `assertContentOwnership` rejects a null campus for content that carries a
 * department. The same re-derivation is also what let ANY save silently move
 * — or null out — an existing page's already-correct campus on every
 * autosave.
 *
 * On update, prefer the page's persisted campus. Only fall back to the
 * author-derived value on create (nothing is persisted yet) or when the
 * persisted campus is itself unset (a pre-backfill row).
 */
export function resolvePageSaveCampusId(params: {
  authorCampusId: string | null;
  isUpdate: boolean;
  persistedCampusId: string | null;
}): string | null {
  const { authorCampusId, isUpdate, persistedCampusId } = params;
  if (isUpdate && persistedCampusId) {
    return persistedCampusId;
  }
  return authorCampusId;
}
