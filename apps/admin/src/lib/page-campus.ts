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
  /** A unit page: its URL encodes the campus, so it cannot move. */
  campusLocked?: boolean;
  /** A project hub page is national: its campus is null whatever is posted. */
  hub?: boolean;
  /** The campus chosen in the editor; undefined when the document has none. */
  chosenCampusId?: string | null;
  isUpdate: boolean;
  persistedCampusId: string | null;
}): string | null {
  const {
    authorCampusId,
    campusLocked,
    chosenCampusId,
    hub,
    isUpdate,
    persistedCampusId,
  } = params;
  if (hub) {
    return null;
  }
  if (isUpdate && persistedCampusId && campusLocked) {
    return persistedCampusId;
  }
  if (chosenCampusId !== undefined) {
    return chosenCampusId;
  }
  if (isUpdate && persistedCampusId) {
    return persistedCampusId;
  }
  return authorCampusId;
}

interface CampusAuthCtx {
  activeCampusId?: string;
  managedCampusIds: string[];
  resolvedCampusIds: string[];
  roles: string[];
}

/**
 * The campus an editor is allowed to put a page on, given what they chose.
 * A global admin may choose any campus or none (a national page); a campus
 * admin only one they manage; everyone else gets their own campus whatever
 * the browser sent.
 */
export function requestedPageCampusId(
  chosen: string | undefined,
  ctx: CampusAuthCtx
): string | null {
  if (ctx.roles.includes("globaladmin")) {
    return chosen || null;
  }
  if (ctx.managedCampusIds.length > 0) {
    return chosen && ctx.managedCampusIds.includes(chosen)
      ? chosen
      : ctx.managedCampusIds[0];
  }
  return ctx.resolvedCampusIds[0] ?? null;
}
