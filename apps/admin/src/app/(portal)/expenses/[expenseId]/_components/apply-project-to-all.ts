/**
 * The receipt editor's "apply to all receipts" button. Clearing every
 * receipt's project takes two clicks in a row; picking in the project picker
 * in between starts over, so the button never says "click again to clear"
 * while the next click would apply a project.
 */
export type ApplyAllEvent =
  | { kind: "click"; projectId: string | null }
  | { kind: "pick" };

export function applyAllStep(
  confirmingClear: boolean,
  event: ApplyAllEvent
): { apply: boolean; confirmingClear: boolean } {
  if (event.kind === "pick") {
    return { apply: false, confirmingClear: false };
  }
  if (event.projectId === null && !confirmingClear) {
    return { apply: false, confirmingClear: true };
  }
  return { apply: true, confirmingClear: false };
}
