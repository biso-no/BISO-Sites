"use client";

import { useRef } from "react";
import { useHeader, useHeaderSelected, useMode } from "@/editor/hooks";
import { useEditorStore } from "@/editor/store";
import { PageHeaderView } from "@/header/page-header-view";
import { clickSelectsSection } from "./section-click";

/**
 * The page header's place above the sections. With a header it is the
 * header in the section chrome (`.pe-section`: hover and selection outline,
 * tag, remove), selected by a click. Without one, the editor offers a slim
 * "+ Add page header" in the look of "+ Add section".
 */
export function HeaderSlot() {
  const header = useHeader();
  const edit = useMode() === "edit";
  const selected = useHeaderSelected();
  const addHeader = useEditorStore((s) => s.addHeader);
  const removeHeader = useEditorStore((s) => s.removeHeader);
  const selectHeader = useEditorStore((s) => s.selectHeader);
  const setHeaderProp = useEditorStore((s) => s.setHeaderProp);
  const pageTitle = useEditorStore((s) => s.doc.meta.title);
  // Where the press that led to a click started; see clickSelectsSection.
  const pressTarget = useRef<EventTarget | null>(null);

  if (!header) {
    return edit ? (
      <div className="pe-add-section pe-add-section--header">
        <button
          className="pe-add-section__btn"
          onClick={addHeader}
          title="Add a navy header with the page title at the top"
          type="button"
        >
          + Add page header
        </button>
      </div>
    ) : null;
  }

  return (
    // As with a section: a click is a pointer shortcut, and keyboard users
    // select the header from the outline.
    // biome-ignore lint/a11y/noStaticElementInteractions: pointer shortcut, see above.
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: pointer shortcut, see above.
    // biome-ignore lint/a11y/useKeyWithClickEvents: pointer shortcut, see above.
    <div
      className={["pe-section", "pe-header", selected ? "selected" : ""]
        .filter(Boolean)
        .join(" ")}
      onClick={(e) => {
        e.stopPropagation();
        const target = pressTarget.current;
        pressTarget.current = null;
        if (clickSelectsSection(target, window.getSelection())) {
          selectHeader();
        }
      }}
      onPointerDown={(e) => {
        pressTarget.current = e.target;
      }}
    >
      {edit && selected && (
        <div className="pe-section__bar">
          <span className="pe-section__tag">Page header</span>
          <div className="pe-section__actions">
            <button
              aria-label="Remove page header"
              className="delete"
              onClick={(e) => {
                e.stopPropagation();
                removeHeader();
              }}
              title="Remove page header"
              type="button"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      <PageHeaderView
        edit={edit}
        fallbackTitle={pageTitle}
        header={header}
        onPatch={setHeaderProp}
      />
    </div>
  );
}
