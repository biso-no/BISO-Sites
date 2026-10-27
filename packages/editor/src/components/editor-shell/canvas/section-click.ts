interface MaybeElement {
  closest?: (selector: string) => unknown;
}

/**
 * Whether a click on a section frame selects the section. Not when it ends a
 * text selection (a drag that started in a block and was let go over the
 * padding fires its click on the section), and not when the press started
 * inside a block. `pressTarget` is the pointerdown target, or null when there
 * was none.
 */
export function clickSelectsSection(
  pressTarget: unknown,
  selection: { isCollapsed: boolean } | null
): boolean {
  if (selection && !selection.isCollapsed) {
    return false;
  }
  const closest = (pressTarget as MaybeElement | null)?.closest;
  if (typeof closest !== "function") {
    return true;
  }
  return closest.call(pressTarget, ".pe-block") === null;
}
