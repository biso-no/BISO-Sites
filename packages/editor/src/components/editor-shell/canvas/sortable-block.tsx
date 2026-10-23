"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useMemo } from "react";
import { BlockView } from "@/blocks/block-view";
import { getBlock } from "@/blocks/registry";
import type { PatchFn } from "@/blocks/types";
import { useHoveredId, useMode, useSelection } from "@/editor/hooks";
import { useEditorStore } from "@/editor/store";
import type { Block } from "@/editor/types";
import { handleBlockWrapperKeyDown } from "./block-keys";

export function SortableBlock({ block }: { block: Block }) {
  const mode = useMode();
  const selection = useSelection();
  const hoveredId = useHoveredId();
  const select = useEditorStore((s) => s.select);
  const setHovered = useEditorStore((s) => s.setHovered);
  const removeBlock = useEditorStore((s) => s.removeBlock);
  const duplicateBlock = useEditorStore((s) => s.duplicateBlock);
  const setProp = useEditorStore((s) => s.setProp);

  // Read back by `dragSourceOf` / `dropTargetOf` in ./drop.
  const data = useMemo(
    () => ({ kind: "block", blockId: block.id }) as const,
    [block.id]
  );
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: block.id,
    data,
    disabled: mode !== "edit",
  });

  const def = getBlock(block.type);
  const isSelected = selection === block.id;
  const isHovered = hoveredId === block.id;

  const onPatch = useCallback<PatchFn>(
    (path, value) => setProp(block.id, path, value),
    [block.id, setProp]
  );

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  const cls = [
    "pe-block",
    isSelected ? "selected" : "",
    isHovered ? "hovered" : "",
    isDragging ? "dragging" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!def) {
    return (
      <div ref={setNodeRef} style={style}>
        <p style={{ padding: 24, color: "var(--ink-3)" }}>
          Unknown block: {block.type}
        </p>
      </div>
    );
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: the block wrapper contains nested editor controls, so it cannot be a native button.
    <div
      className={cls}
      data-block-id={block.id}
      onClick={(e) => {
        e.stopPropagation();
        select(block.id);
      }}
      onKeyDown={(e) => handleBlockWrapperKeyDown(e, () => select(block.id))}
      onMouseEnter={() => setHovered(block.id)}
      onMouseLeave={() => setHovered(null)}
      ref={setNodeRef}
      role="button"
      style={style}
      tabIndex={0}
    >
      {isSelected && mode === "edit" && (
        <span className="pe-block__tag">{def.label}</span>
      )}

      {mode === "edit" && (
        <>
          <div className="pe-block__handle">
            <button
              className="pe-block__dragger"
              title="Drag to reorder"
              type="button"
              {...listeners}
              {...attributes}
            >
              ⠿
            </button>
          </div>
          <div className="pe-block__row-actions">
            <button
              onClick={(e) => {
                e.stopPropagation();
                duplicateBlock(block.id);
              }}
              title="Duplicate"
              type="button"
            >
              ⊕
            </button>
            <button
              className="delete"
              onClick={(e) => {
                e.stopPropagation();
                removeBlock(block.id);
              }}
              title="Delete"
              type="button"
            >
              ✕
            </button>
          </div>
        </>
      )}

      <BlockView block={block} edit={mode === "edit"} onPatch={onPatch} />
    </div>
  );
}
