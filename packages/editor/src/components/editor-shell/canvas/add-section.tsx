"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/editor/store";
import type { SectionColumns } from "@/editor/types";

interface LayoutOption {
  columns: SectionColumns;
  label: string;
  /** Relative column widths, for the little schematic. */
  widths: number[];
}

export const SECTION_LAYOUTS: readonly LayoutOption[] = [
  { columns: "1", label: "One column", widths: [1] },
  { columns: "1-1", label: "Two equal columns", widths: [1, 1] },
  { columns: "2-1", label: "Wide left", widths: [2, 1] },
  { columns: "1-2", label: "Wide right", widths: [1, 2] },
  { columns: "1-1-1", label: "Three columns", widths: [1, 1, 1] },
  { columns: "1-1-1-1", label: "Four columns", widths: [1, 1, 1, 1] },
];

/** The six column layouts as variant tiles, the inspector's picker style. */
export function SectionLayoutPicker({
  onPick,
}: {
  onPick: (columns: SectionColumns) => void;
}) {
  return (
    <div className="pe-add-section__grid pe-variant-grid">
      {SECTION_LAYOUTS.map((layout) => (
        <button
          aria-label={layout.label}
          className="pe-variant"
          key={layout.columns}
          onClick={(e) => {
            e.stopPropagation();
            onPick(layout.columns);
          }}
          title={layout.label}
          type="button"
        >
          <span aria-hidden="true" className="pe-add-section__cols">
            {layout.widths.map((width, i) => (
              <span key={i} style={{ flexGrow: width }} />
            ))}
          </span>
          <span aria-hidden="true" className="v-name">
            {layout.columns.replaceAll("-", ":")}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Insert an empty section at `index` and select it, so its columns show. */
function useAddSection(index: number) {
  const insertSection = useEditorStore((s) => s.insertSection);
  const selectSection = useEditorStore((s) => s.selectSection);
  return (columns: SectionColumns) =>
    selectSection(insertSection(columns, index));
}

/**
 * "+ Add section": a slim control that opens the layout picker in place.
 * Between sections it sits on the boundary and shows on hover; at the end of
 * the page it is always visible.
 */
export function AddSection({
  index,
  placement,
}: {
  index: number;
  placement: "between" | "end";
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const add = useAddSection(index);

  useEffect(() => {
    if (!open) {
      return;
    }
    panelRef.current?.querySelector<HTMLButtonElement>(".pe-variant")?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (open) {
    return (
      <div className="pe-add-section__panel" ref={panelRef}>
        <div className="pe-add-section__hd">
          <span>Choose a layout</span>
          <button onClick={() => setOpen(false)} type="button">
            Cancel
          </button>
        </div>
        <SectionLayoutPicker
          onPick={(columns) => {
            add(columns);
            setOpen(false);
          }}
        />
      </div>
    );
  }

  return (
    <button
      className="pe-add-section__btn"
      data-placement={placement}
      onClick={() => setOpen(true)}
      title="Add a section here"
      type="button"
    >
      + Add section
    </button>
  );
}

/** The empty page: the picker, always open. */
export function FirstSectionPicker() {
  const add = useAddSection(0);
  return (
    <>
      <div aria-hidden="true" className="pe-add-section__icon">
        ⊕
      </div>
      <p className="pe-add-section__title">Add your first section</p>
      <p className="pe-add-section__hint">
        Pick a layout, or drag a block here from the palette.
      </p>
      <SectionLayoutPicker onPick={add} />
    </>
  );
}
