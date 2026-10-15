interface WrapperKeyEvent {
  currentTarget: unknown;
  key: string;
  preventDefault: () => void;
  target: unknown;
}

/**
 * Keyboard selection for a block wrapper. Only a key press on the wrapper
 * itself counts: contentEditable text and inputs inside the block bubble
 * their keys up here too, and claiming those made Space untypeable.
 */
export function handleBlockWrapperKeyDown(
  event: WrapperKeyEvent,
  select: () => void
): void {
  if (event.target !== event.currentTarget) {
    return;
  }
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    select();
  }
}
