"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useRef } from "react";
import type { ResolvedBackground } from "@/blocks/_primitives/layout-types";
import { useInsertTarget, useMode, useSelectedSectionId } from "@/editor/hooks";
import { legacyBackground } from "@/editor/sections";
import { useEditorStore } from "@/editor/store";
import { targetAfterBlock } from "@/editor/tree";
import type { Block, Column, Section } from "@/editor/types";
import { SectionView } from "@/sections/section-view";
import type { CanvasDrag } from "./drop";
import { DropSlot } from "./drop-line";
import { clickSelectsSection } from "./section-click";
import { SortableBlock } from "./sortable-block";

export function sectionLabel(section: Section): string {
  const count = section.columns.length;
  return `Section · ${count} ${count === 1 ? "column" : "columns"}`;
}

/** A block's column, that column's sortable ids and the block above it. */
interface BlockPlace {
  columnId: string;
  items: string[];
  previousId: string | null;
}

function placesOf(section: Section): Map<string, BlockPlace> {
  const places = new Map<string, BlockPlace>();
  for (const column of section.columns) {
    const items = column.blocks.map((b) => b.id);
    for (const [i, id] of items.entries()) {
      places.set(id, {
        columnId: column.id,
        items,
        previousId: i > 0 ? items[i - 1] : null,
      });
    }
  }
  return places;
}

interface SectionFrameProps {
  drag: CanvasDrag | null;
  index: number;
  section: Section;
}

/**
 * The editor chrome around one `SectionView`: the section is sortable by its
 * handle, a click on its padding selects it, and in edit mode every column
 * ends in a drop zone with "+ Add block".
 */
export function SectionFrame({ drag, index, section }: SectionFrameProps) {
  const mode = useMode();
  const edit = mode === "edit";
  const selectedSectionId = useSelectedSectionId();
  const selectSection = useEditorStore((s) => s.selectSection);
  const duplicateSection = useEditorStore((s) => s.duplicateSection);
  const removeSection = useEditorStore((s) => s.removeSection);
  // Where the press that led to a click started; see clickSelectsSection.
  const pressTarget = useRef<EventTarget | null>(null);

  const data = useMemo(
    () => ({ kind: "section", sectionId: section.id }) as const,
    [section.id]
  );
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `sec:${section.id}`, data, disabled: !edit });

  const places = useMemo(() => placesOf(section), [section]);
  const background = legacyBackground(section.layout.background);
  const selected = selectedSectionId === section.id;
  const label = sectionLabel(section);

  const cls = [
    "pe-section",
    selected ? "selected" : "",
    isDragging ? "dragging" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    // A click on a section's padding is a pointer shortcut; keyboard users
    // select sections from the outline. The wrapper holds the page content,
    // so it must not become one big button.
    // biome-ignore lint/a11y/noStaticElementInteractions: pointer shortcut, see above.
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: pointer shortcut, see above.
    // biome-ignore lint/a11y/useKeyWithClickEvents: pointer shortcut, see above.
    <div
      className={cls}
      data-section-id={section.id}
      onClick={(e) => {
        e.stopPropagation();
        const target = pressTarget.current;
        pressTarget.current = null;
        if (clickSelectsSection(target, window.getSelection())) {
          selectSection(section.id);
        }
      }}
      onPointerDown={(e) => {
        pressTarget.current = e.target;
      }}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      }}
    >
      {edit && selected && (
        <div className="pe-section__bar">
          <button
            aria-label={`Move section ${index + 1}`}
            className="pe-section__dragger"
            title="Drag to reorder"
            type="button"
            {...listeners}
            {...attributes}
          >
            ⠿
          </button>
          <span className="pe-section__tag">{label}</span>
          <div className="pe-section__actions">
            <button
              onClick={(e) => {
                e.stopPropagation();
                duplicateSection(section.id);
              }}
              title="Duplicate section"
              type="button"
            >
              ⊕
            </button>
            <button
              className="delete"
              onClick={(e) => {
                e.stopPropagation();
                removeSection(section.id);
              }}
              title="Delete section"
              type="button"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <SectionView
        edit={edit}
        renderBlock={(block) => (
          <ColumnBlock
            background={background}
            block={block}
            drag={drag}
            edit={edit}
            place={places.get(block.id)}
          />
        )}
        renderColumnEnd={
          edit
            ? (column, columnIndex) => (
                <ColumnEnd
                  column={column}
                  columnIndex={columnIndex}
                  drag={drag}
                />
              )
            : undefined
        }
        section={section}
      />
    </div>
  );
}

/**
 * One block in its column. `SectionView` owns the column markup, so each block
 * opens its column's `SortableContext` itself: same id, same items, so every
 * block of a column shares one sortable list (a context renders no DOM).
 */
function ColumnBlock({
  background,
  block,
  drag,
  edit,
  place,
}: {
  background: ResolvedBackground;
  block: Block;
  drag: CanvasDrag | null;
  edit: boolean;
  place: BlockPlace | undefined;
}) {
  const insertBlock = useEditorStore((s) => s.insertBlock);
  if (!place) {
    return null;
  }
  const previousId = place.previousId;
  const lineHere =
    drag?.indicator?.kind === "before-block" &&
    drag.indicator.blockId === block.id;

  return (
    <SortableContext
      id={place.columnId}
      items={place.items}
      strategy={verticalListSortingStrategy}
    >
      {edit && drag && <DropSlot active={lineHere} />}

      {/* Between-block zipper (hidden while dragging) */}
      {edit && !drag && previousId && (
        <div className="pe-zipper">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const target = targetAfterBlock(
                useEditorStore.getState().doc,
                previousId
              );
              if (target) {
                insertBlock("text", target);
              }
            }}
            title="Add block"
            type="button"
          >
            +
          </button>
        </div>
      )}

      <SortableBlock background={background} block={block} />
    </SortableContext>
  );
}

/**
 * The end of a column: its `col:` drop zone, the drop line for "append here",
 * a dashed outline of the whole column and "+ Add block", which points the
 * palette at this column.
 */
function ColumnEnd({
  column,
  columnIndex,
  drag,
}: {
  column: Column;
  columnIndex: number;
  drag: CanvasDrag | null;
}) {
  const insertTarget = useInsertTarget();
  const setInsertTarget = useEditorStore((s) => s.setInsertTarget);
  const data = useMemo(
    () => ({ kind: "column", columnId: column.id }) as const,
    [column.id]
  );
  const { setNodeRef } = useDroppable({ id: `col:${column.id}`, data });

  const empty = column.blocks.length === 0;
  const isTarget = insertTarget?.columnId === column.id;
  const over =
    drag?.indicator?.kind === "column-end" &&
    drag.indicator.columnId === column.id;

  return (
    <>
      <span
        aria-hidden="true"
        className="pe-col"
        data-target={isTarget ? "" : undefined}
      />
      <div
        className="pe-col__end"
        data-empty={empty ? "" : undefined}
        data-over={over ? "" : undefined}
        ref={setNodeRef}
      >
        {drag && !empty && <DropSlot active={over} />}
        <button
          aria-label={`Add block to column ${columnIndex + 1}`}
          aria-pressed={isTarget}
          className="pe-col__add"
          onClick={(e) => {
            e.stopPropagation();
            setInsertTarget(isTarget ? null : { columnId: column.id });
          }}
          title={
            isTarget
              ? "Pick a block in the palette, or click to cancel"
              : "Add a block to this column"
          }
          type="button"
        >
          + Add block
        </button>
      </div>
    </>
  );
}
