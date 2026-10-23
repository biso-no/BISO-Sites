// Drag-and-drop rules for the canvas: what is being dragged, what it is over,
// and what the drop does to the page. Pure, so the rules are testable without
// dnd-kit or the DOM.
import {
  findBlock,
  findColumn,
  findSection,
  targetAfterBlock,
} from "@/editor/tree";
import type { BlockType, InsertTarget, PageDoc } from "@/editor/types";

export type DragSource =
  | { source: "palette"; type: BlockType }
  | { source: "block"; blockId: string }
  | { source: "section"; sectionId: string };

export type DropTarget =
  | { kind: "block"; blockId: string }
  | { kind: "column"; columnId: string }
  | { kind: "section"; sectionId: string }
  | { kind: "new-section"; index: number };

export type DropAction =
  | { kind: "insert-block"; type: BlockType; target: InsertTarget }
  | { kind: "insert-block-new-section"; type: BlockType; index: number }
  | { kind: "move-block"; blockId: string; target: InsertTarget }
  | { kind: "move-block-new-section"; blockId: string; index: number }
  | { kind: "move-section"; sectionId: string; beforeSectionId?: string }
  | { kind: "none" };

/** Where the canvas draws its drop line for a pending drop. */
export type DropIndicator =
  | { kind: "before-block"; blockId: string }
  | { kind: "column-end"; columnId: string }
  | { kind: "new-section"; index: number }
  | null;

/** The drag in progress, as the canvas needs it to draw. */
export interface CanvasDrag {
  indicator: DropIndicator;
  source: DragSource;
}

const NONE: DropAction = { kind: "none" };

const ACCEPTS: Record<DragSource["source"], readonly DropTarget["kind"][]> = {
  block: ["block", "column", "new-section"],
  palette: ["block", "column", "new-section"],
  section: ["section", "new-section"],
};

export function acceptsDrop(
  source: DragSource["source"],
  target: DropTarget["kind"]
): boolean {
  return ACCEPTS[source].includes(target);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

/** Reads a droppable's `data.current` (dnd-kit adds its own `sortable` key). */
export function dropTargetOf(data: unknown): DropTarget | null {
  if (!isRecord(data)) {
    return null;
  }
  switch (data.kind) {
    case "block":
      return isString(data.blockId)
        ? { kind: "block", blockId: data.blockId }
        : null;
    case "column":
      return isString(data.columnId)
        ? { kind: "column", columnId: data.columnId }
        : null;
    case "section":
      return isString(data.sectionId)
        ? { kind: "section", sectionId: data.sectionId }
        : null;
    case "new-section":
      return typeof data.index === "number"
        ? { kind: "new-section", index: data.index }
        : null;
    default:
      return null;
  }
}

/**
 * Reads the active draggable's `data.current`: palette items carry
 * `{ source: "palette", type }`; block and section sortables carry the same
 * data they expose as drop targets.
 */
export function dragSourceOf(data: unknown): DragSource | null {
  if (!isRecord(data)) {
    return null;
  }
  if (data.source === "palette" && isString(data.type)) {
    return { source: "palette", type: data.type as BlockType };
  }
  const target = dropTargetOf(data);
  if (target?.kind === "block") {
    return { source: "block", blockId: target.blockId };
  }
  if (target?.kind === "section") {
    return { source: "section", sectionId: target.sectionId };
  }
  return null;
}

/** Where a block lands when dropped on `target`, or null for no move. */
function blockLanding(
  doc: PageDoc,
  blockId: string | null,
  target:
    | { kind: "block"; blockId: string }
    | { kind: "column"; columnId: string }
): InsertTarget | null {
  const source = blockId ? findBlock(doc, blockId) : null;
  if (blockId && !source) {
    return null;
  }

  if (target.kind === "column") {
    const column = findColumn(doc, target.columnId)?.column;
    if (!column) {
      return null;
    }
    const alreadyLast =
      source?.column.id === column.id &&
      source.blockIndex === column.blocks.length - 1;
    return alreadyLast ? null : { columnId: column.id };
  }

  if (target.blockId === blockId) {
    return null;
  }
  const over = findBlock(doc, target.blockId);
  if (!over) {
    return null;
  }
  // Moving down within a column lands after the block it is over, which is
  // where the sortable animation has already shown it (array-move).
  const movingDown =
    source?.column.id === over.column.id && source.blockIndex < over.blockIndex;
  return movingDown
    ? targetAfterBlock(doc, target.blockId)
    : { beforeBlockId: target.blockId, columnId: over.column.id };
}

function resolveSectionDrop(
  doc: PageDoc,
  sectionId: string,
  target: DropTarget
): DropAction {
  const from = findSection(doc, sectionId)?.index;
  if (from === undefined) {
    return NONE;
  }

  let beforeIndex: number;
  if (target.kind === "section") {
    const to = findSection(doc, target.sectionId)?.index;
    if (to === undefined || to === from) {
      return NONE;
    }
    // Array-move: downward lands after the target, upward before it.
    beforeIndex = to > from ? to + 1 : to;
  } else if (target.kind === "new-section") {
    // The zones directly above and below the section leave it where it is.
    if (target.index === from || target.index === from + 1) {
      return NONE;
    }
    beforeIndex = target.index;
  } else {
    return NONE;
  }

  const before = doc.sections[beforeIndex];
  return before
    ? { kind: "move-section", sectionId, beforeSectionId: before.id }
    : { kind: "move-section", sectionId };
}

export function resolveDrop(
  doc: PageDoc,
  source: DragSource,
  target: DropTarget | null
): DropAction {
  if (!(target && acceptsDrop(source.source, target.kind))) {
    return NONE;
  }

  if (source.source === "section") {
    return resolveSectionDrop(doc, source.sectionId, target);
  }

  if (target.kind === "new-section") {
    if (source.source === "palette") {
      return {
        kind: "insert-block-new-section",
        type: source.type,
        index: target.index,
      };
    }
    return findBlock(doc, source.blockId)
      ? {
          kind: "move-block-new-section",
          blockId: source.blockId,
          index: target.index,
        }
      : NONE;
  }

  if (target.kind === "section") {
    return NONE;
  }

  const blockId = source.source === "block" ? source.blockId : null;
  const landing = blockLanding(doc, blockId, target);
  if (!landing) {
    return NONE;
  }
  return source.source === "palette"
    ? { kind: "insert-block", type: source.type, target: landing }
    : { kind: "move-block", blockId: source.blockId, target: landing };
}

export function dropIndicator(doc: PageDoc, action: DropAction): DropIndicator {
  switch (action.kind) {
    case "insert-block":
    case "move-block":
      return action.target.beforeBlockId
        ? { kind: "before-block", blockId: action.target.beforeBlockId }
        : { kind: "column-end", columnId: action.target.columnId };
    case "insert-block-new-section":
    case "move-block-new-section":
      return { kind: "new-section", index: action.index };
    case "move-section": {
      const before = action.beforeSectionId
        ? findSection(doc, action.beforeSectionId)
        : null;
      return {
        kind: "new-section",
        index: before?.index ?? doc.sections.length,
      };
    }
    default:
      return null;
  }
}

/** The store actions a drop can call. */
export interface DropStore {
  insertBlock: (type: BlockType, target?: InsertTarget) => string;
  insertBlockInNewSection: (type: BlockType, sectionIndex: number) => string;
  moveBlock: (blockId: string, target: InsertTarget) => void;
  moveBlockToNewSection: (blockId: string, sectionIndex: number) => void;
  moveSection: (id: string, beforeSectionId?: string) => void;
  select: (id: string | null) => void;
}

export function applyDrop(action: DropAction, store: DropStore): void {
  switch (action.kind) {
    case "insert-block":
      // insertBlock selects the new block itself.
      store.insertBlock(action.type, action.target);
      return;
    case "insert-block-new-section":
      store.select(store.insertBlockInNewSection(action.type, action.index));
      return;
    case "move-block":
      store.moveBlock(action.blockId, action.target);
      return;
    case "move-block-new-section":
      store.moveBlockToNewSection(action.blockId, action.index);
      return;
    case "move-section":
      store.moveSection(action.sectionId, action.beforeSectionId);
      return;
    default:
      return;
  }
}
