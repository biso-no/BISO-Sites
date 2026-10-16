import type { PageDoc } from "@/editor/types";

/**
 * What a change has to touch to be worth an autosave. The publish status is
 * left out: publish and unpublish write it themselves, and a save fired by
 * the mirrored status would bump the page row's `$updatedAt` and make a
 * queued auto-translation give up as stale.
 */
export function autosaveSignature(doc: PageDoc): string {
  return JSON.stringify({
    blocks: doc.blocks,
    meta: { ...doc.meta, status: undefined },
  });
}
