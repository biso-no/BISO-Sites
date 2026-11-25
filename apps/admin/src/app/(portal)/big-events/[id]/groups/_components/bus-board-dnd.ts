import {
  type CollisionDetection,
  KeyboardCode,
  type KeyboardCoordinateGetter,
  pointerWithin,
  rectIntersection,
} from "@dnd-kit/core";

/* How dragging on the bus board finds a column, by pointer or keyboard. */

/** The column under the pointer; with the keyboard, the one the chip overlaps most. */
export const columnCollision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

const NEXT = new Set<string>([KeyboardCode.Right, KeyboardCode.Down]);
const PREVIOUS = new Set<string>([KeyboardCode.Left, KeyboardCode.Up]);
/** How far below a column's top edge a keyboard drag lands. */
const LANDING_OFFSET_PX = 12;

/** +1 for the next column, -1 for the previous one, 0 for any other key. */
function stepOf(code: string): number {
  if (NEXT.has(code)) {
    return 1;
  }
  return PREVIOUS.has(code) ? -1 : 0;
}

/**
 * Arrow keys jump a dragged chip from column to column in board order
 * (right/down: next, left/up: previous), so a keyboard user never has to
 * nudge it pixel by pixel. `order` lists the column ids; `startColumn` is
 * the dragged person's own column.
 */
export function columnKeyboardCoordinates(
  order: () => string[],
  startColumn: (activeId: string) => string | undefined
): KeyboardCoordinateGetter {
  return (event, { active, context }) => {
    const step = stepOf(event.code);
    if (step === 0) {
      return;
    }
    event.preventDefault();
    const { collisionRect, droppableRects, over } = context;
    if (!collisionRect) {
      return;
    }
    const ids = order();
    const current = String(over?.id ?? startColumn(String(active)) ?? "");
    const index = ids.indexOf(current);
    const nextId = ids[Math.min(Math.max(index + step, 0), ids.length - 1)];
    const rect = nextId ? droppableRects.get(nextId) : undefined;
    if (!rect) {
      return;
    }
    return {
      x: rect.left + (rect.width - collisionRect.width) / 2,
      y: rect.top + LANDING_OFFSET_PX,
    };
  };
}
