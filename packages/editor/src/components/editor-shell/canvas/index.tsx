"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Fragment, useMemo } from "react";
import { useEditorCallbacks } from "@/editor/callbacks";
import { canvasThemeStyle, effectiveTheme } from "@/editor/effective-theme";
import {
  useCopilotOpen,
  useHeader,
  useMeta,
  useMode,
  useSections,
  useViewport,
} from "@/editor/hooks";
import { useEditorStore } from "@/editor/store";
import { CopilotPanel } from "../copilot/chat-panel";
import { CopilotButton } from "../copilot/floating-button";
import { AddSection, FirstSectionPicker } from "./add-section";
import type { CanvasDrag } from "./drop";
import { DropSlot } from "./drop-line";
import { FormatBar } from "./format-bar";
import { HeaderSlot } from "./header-slot";
import { SectionFrame } from "./section-frame";

interface CanvasPaneProps {
  /** The drag in progress, or null. */
  drag: CanvasDrag | null;
}

const newSectionData = (index: number) =>
  ({ kind: "new-section", index }) as const;

/**
 * The boundary before section `index` (or after the last one, `end`). While
 * dragging it is the `new-section:<index>` drop zone; otherwise it holds
 * "+ Add section". `top` marks the boundary at the top of the page, where a
 * centred button would be clipped; below a page header it is centred again.
 */
function SectionGap({
  drag,
  end = false,
  index,
  top = false,
}: {
  drag: CanvasDrag | null;
  end?: boolean;
  index: number;
  top?: boolean;
}) {
  const data = useMemo(() => newSectionData(index), [index]);
  const { setNodeRef } = useDroppable({ id: `new-section:${index}`, data });
  const active =
    drag?.indicator?.kind === "new-section" && drag.indicator.index === index;

  return (
    <div
      className="pe-add-section"
      data-end={end ? "" : undefined}
      data-first={top ? "" : undefined}
      ref={setNodeRef}
    >
      {drag && <DropSlot active={active} />}
      <AddSection index={index} placement={end ? "end" : "between"} />
    </div>
  );
}

/** The empty page: pick a first layout, or drop a block to start a section. */
function EmptyCanvas({ drag }: { drag: CanvasDrag | null }) {
  const data = useMemo(() => newSectionData(0), []);
  const { setNodeRef } = useDroppable({ id: "new-section:0", data });
  const over = drag?.indicator?.kind === "new-section";

  return (
    <div
      className="pe-add-section pe-add-section--first"
      data-over={over ? "" : undefined}
      ref={setNodeRef}
    >
      <FirstSectionPicker />
    </div>
  );
}

function getViewportLabel(viewport: "desk" | "tab" | "mob") {
  if (viewport === "desk") {
    return "Desktop";
  }
  if (viewport === "tab") {
    return "Tablet";
  }
  return "Mobile";
}

function getViewportWidth(viewport: "desk" | "tab" | "mob") {
  if (viewport === "desk") {
    return "1180";
  }
  if (viewport === "tab") {
    return "820";
  }
  return "390";
}

export function CanvasPane({ drag }: CanvasPaneProps) {
  const mode = useMode();
  const viewport = useViewport();
  const setMode = useEditorStore((s) => s.setMode);
  const setViewport = useEditorStore((s) => s.setViewport);
  const sections = useSections();
  const hasHeader = useHeader() !== undefined;
  const copilotOpen = useCopilotOpen();
  const {
    activeLocale,
    locales,
    onLocaleChange,
    onTranslateLocale,
    translatingLocale,
    departments,
  } = useEditorCallbacks();
  const meta = useMeta();
  // Edits made while the theme blocks saving exist only in the store, and a
  // locale switch rehydrates over them. Hold the switch until they can save.
  const switchBlocked = useEditorStore((s) => s.saving) === "blocked";
  const switchHint = "Fix the theme colours before switching language";
  // On the frame itself: `.biso-surface-v2` re-declares these tokens there,
  // so a value set on an ancestor would be shadowed.
  const themeStyle = useMemo(
    () => canvasThemeStyle(effectiveTheme(meta, departments)),
    [meta, departments]
  );

  const edit = mode === "edit";
  // `biso-surface-v2` gives the sections the redesign's aliases, as <html>
  // does on the site. In the admin's dark theme it turns the canvas navy, as
  // the site's dark theme does.
  const frameClass = `biso-surface biso-surface-v2 pe-frame ${viewport}`;
  const sectionIds = useMemo(
    () => sections.map((section) => `sec:${section.id}`),
    [sections]
  );
  let dragging: "block" | "section" | undefined;
  if (drag) {
    dragging = drag.source.source === "section" ? "section" : "block";
  }
  const missingLocales = locales.filter(
    (option) => option.locale !== activeLocale
  );
  const translateTarget =
    missingLocales.find((option) => !option.hasDraft) ?? missingLocales[0];

  return (
    <div className="pe-canvas-col">
      {/* Toolbar */}
      <div className="pe-canvas-bar">
        <div className="pe-mode-seg">
          <button
            className={mode === "edit" ? "on" : ""}
            onClick={() => setMode("edit")}
            type="button"
          >
            Edit
          </button>
          <button
            className={mode === "preview" ? "on" : ""}
            onClick={() => setMode("preview")}
            type="button"
          >
            Preview
          </button>
        </div>

        <div className="pe-vp-seg">
          {(["desk", "tab", "mob"] as const).map((vp) => (
            <button
              className={viewport === vp ? "on" : ""}
              key={vp}
              onClick={() => setViewport(vp)}
              title={getViewportLabel(vp)}
              type="button"
            >
              {vp === "desk" && <DesktopIcon />}
              {vp === "tab" && <TabletIcon />}
              {vp === "mob" && <MobileIcon />}
            </button>
          ))}
        </div>

        <div className="pe-locale-seg">
          {locales.map((option) => (
            <button
              className={activeLocale === option.locale ? "on" : ""}
              disabled={switchBlocked}
              key={option.locale}
              onClick={() => onLocaleChange(option.locale)}
              title={
                switchBlocked
                  ? switchHint
                  : option.hasDraft
                    ? option.label
                    : `${option.label} (empty)`
              }
              type="button"
            >
              {option.locale.toUpperCase()}
              {!option.hasDraft && <span aria-hidden="true">+</span>}
            </button>
          ))}
        </div>

        {onTranslateLocale && translateTarget && (
          <button
            className="pe-translate"
            disabled={
              switchBlocked ||
              (translatingLocale !== null && translatingLocale !== undefined)
            }
            onClick={() => onTranslateLocale(translateTarget.locale)}
            title={switchBlocked ? switchHint : undefined}
            type="button"
          >
            {translatingLocale === translateTarget.locale
              ? "Translating…"
              : `Translate to ${translateTarget.locale.toUpperCase()}`}
          </button>
        )}
      </div>

      {/* Canvas stage */}
      <div className="scroll pe-stage">
        <div
          className={frameClass}
          data-dragging={dragging}
          data-editing={edit ? "" : undefined}
          style={themeStyle}
        >
          <span className="pe-frame__breakpoint-tag">
            {getViewportWidth(viewport)}px
          </span>

          <HeaderSlot />

          {sections.length === 0 ? (
            <EmptyCanvas drag={drag} />
          ) : (
            <SortableContext
              items={sectionIds}
              strategy={verticalListSortingStrategy}
            >
              {sections.map((section, index) => (
                <Fragment key={section.id}>
                  {edit && (
                    <SectionGap
                      drag={drag}
                      index={index}
                      top={index === 0 && !hasHeader}
                    />
                  )}
                  <SectionFrame
                    drag={drag}
                    first={index === 0 && !hasHeader}
                    index={index}
                    section={section}
                  />
                </Fragment>
              ))}
              {edit && <SectionGap drag={drag} end index={sections.length} />}
            </SortableContext>
          )}
        </div>

        <FormatBar />
        <CopilotButton />
        {copilotOpen && <CopilotPanel />}
      </div>
    </div>
  );
}

function DesktopIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="12"
      viewBox="0 0 16 12"
      width="16"
    >
      <rect
        height="9"
        rx="1.5"
        stroke="currentColor"
        width="15"
        x=".5"
        y=".5"
      />
      <path
        d="M5.5 11.5h5M8 9.5v2"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  );
}
function TabletIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="14"
      viewBox="0 0 10 14"
      width="10"
    >
      <rect
        height="13"
        rx="1.5"
        stroke="currentColor"
        width="9"
        x=".5"
        y=".5"
      />
      <circle cx="5" cy="12" fill="currentColor" r=".75" />
    </svg>
  );
}
function MobileIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="14"
      viewBox="0 0 8 14"
      width="8"
    >
      <rect
        height="13"
        rx="1.5"
        stroke="currentColor"
        width="7"
        x=".5"
        y=".5"
      />
      <circle cx="4" cy="12" fill="currentColor" r=".75" />
    </svg>
  );
}
