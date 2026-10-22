"use client";

import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import { BOARD_FOCUS_RING } from "../_lib/board-styles";

export interface SortableHandle {
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  ref: (node: HTMLElement | null) => void;
}

export interface BoardSortable {
  frameRef: (node: HTMLElement | null) => void;
  frameStyle: CSSProperties;
  handle: SortableHandle;
  isDragging: boolean;
}

/** Wires one board item into its section's `SortableContext`. */
export function useBoardSortable(id: string): BoardSortable {
  const t = useTranslations("adminPortal.benefits.board.drag");
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    attributes: { roleDescription: t("roleDescription") },
    id,
  });
  return {
    frameRef: setNodeRef,
    frameStyle: {
      position: "relative",
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: isDragging ? 10 : undefined,
    },
    handle: { attributes, listeners, ref: setActivatorNodeRef },
    isDragging,
  };
}

/**
 * The grip that moves an item, by pointer or keyboard. It sits beside the
 * item's link rather than inside it, so a drag never opens the item.
 */
export function DragHandle({
  handle,
  label,
}: {
  handle: SortableHandle;
  label: string;
}) {
  return (
    <button
      {...handle.attributes}
      {...handle.listeners}
      aria-label={label}
      className={`grid h-8 w-8 shrink-0 cursor-grab touch-none place-items-center rounded-md text-[#6b6357] transition-colors hover:bg-[#f3eee5] hover:text-[#1a1814] active:cursor-grabbing ${BOARD_FOCUS_RING}`}
      ref={handle.ref}
      type="button"
    >
      <GripVertical aria-hidden size={16} />
    </button>
  );
}
