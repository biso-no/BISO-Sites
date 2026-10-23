import type { PageDoc } from "@/editor/types";

/**
 * What a change has to touch to be worth an autosave. The publish status is
 * left out: publish and unpublish write it themselves, and a save fired by
 * the mirrored status would bump the page row's `$updatedAt` and make a
 * queued auto-translation give up as stale.
 */
export function autosaveSignature(doc: PageDoc): string {
  return JSON.stringify({
    header: doc.header,
    meta: { ...doc.meta, status: undefined },
    sections: doc.sections,
  });
}

/**
 * Whether the shell should autosave the document now (C11). Nothing saves
 * until the locale is hydrated (`hydratedSignature` undefined), and the
 * hydrated document itself is never written back: opening a page would
 * otherwise overwrite what is stored, and `/pages/new` would create a row
 * before anyone typed. `blocked` (a theme that fails contrast) saves nothing
 * until the colours pass. After the first real change (`changedSinceHydration`)
 * every change saves, including an undo back to the hydrated state.
 */
export function shouldAutosave(
  hydratedSignature: string | undefined,
  currentSignature: string,
  changedSinceHydration: boolean,
  blocked = false
): boolean {
  if (blocked || hydratedSignature === undefined) {
    return false;
  }
  return changedSinceHydration || currentSignature !== hydratedSignature;
}
