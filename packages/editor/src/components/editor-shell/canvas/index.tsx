"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Fragment, useCallback } from "react";
import type { ResolvedBackground } from "@/blocks/_primitives/layout-types";
import { resolveBackgrounds } from "@/blocks/_primitives/resolve-layout";
import { getBlock } from "@/blocks/registry";
import type { PatchFn } from "@/blocks/types";
import { useEditorCallbacks } from "@/editor/callbacks";
import {
  useBlocks,
  useCopilotOpen,
  useHoveredId,
  useMode,
  useSelection,
  useViewport,
} from "@/editor/hooks";
import { useEditorStore } from "@/editor/store";
import type { Block, BlockType } from "@/editor/types";
import { CopilotPanel } from "../copilot/chat-panel";
import { CopilotButton } from "../copilot/floating-button";
import { FormatBar } from "./format-bar";

interface CanvasPaneProps {
  activeDragId: string | null;
  activePaletteType: BlockType | null;
  overId: string | null;
}

function DropLine({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden="true"
      style={{
        height: 2,
        margin: "1px 0",
        borderRadius: 999,
        flexShrink: 0,
        background: "var(--page-accent)",
        boxShadow: active
          ? "0 0 0 4px color-mix(in srgb, var(--page-accent) 18%, transparent)"
          : "none",
        opacity: active ? 1 : 0,
        transition: "opacity .12s, box-shadow .12s",
        pointerEvents: "none",
      }}
    />
  );
}

function CanvasEndZone({ active }: { active: boolean }) {
  const { setNodeRef } = useDroppable({ id: "canvas-end" });
  return (
    <div
      ref={setNodeRef}
      style={{
        minHeight: 56,
        display: "flex",
        alignItems: "flex-start",
        paddingTop: 1,
      }}
    >
      <div style={{ width: "100%" }}>
        <DropLine active={active} />
      </div>
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

export function CanvasPane({
  activeDragId,
  activePaletteType,
  overId,
}: CanvasPaneProps) {
  const mode = useMode();
  const viewport = useViewport();
  const setMode = useEditorStore((s) => s.setMode);
  const setViewport = useEditorStore((s) => s.setViewport);
  const blocks = useBlocks();
  const insertBlock = useEditorStore((s) => s.insertBlock);
  const copilotOpen = useCopilotOpen();
  const {
    activeLocale,
    locales,
    onLocaleChange,
    onTranslateLocale,
    translatingLocale,
  } = useEditorCallbacks();

  const isDragging = activeDragId !== null || activePaletteType !== null;
  const frameClass = `biso-surface pe-frame ${viewport}`;
  const backgrounds = resolveBackgrounds(blocks);
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
              key={option.locale}
              onClick={() => onLocaleChange(option.locale)}
              title={option.hasDraft ? option.label : `${option.label} (empty)`}
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
              translatingLocale !== null && translatingLocale !== undefined
            }
            onClick={() => onTranslateLocale(translateTarget.locale)}
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
        <SortableContext
          items={blocks.map((b) => b.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className={frameClass}>
            <span className="pe-frame__breakpoint-tag">
              {getViewportWidth(viewport)}px
            </span>

            {blocks.length === 0 && !isDragging && (
              <EmptyState onAdd={(type) => insertBlock(type)} />
            )}

            {blocks.map((block, idx) => (
              <Fragment key={block.id}>
                {/* Drop indicator — shown before this block when it's the drag target */}
                {isDragging && <DropLine active={overId === block.id} />}

                {/* Between-block zipper (hidden while dragging) */}
                {!isDragging && idx > 0 && mode === "edit" && (
                  <div className="pe-zipper">
                    <button
                      onClick={() => insertBlock("text", blocks[idx - 1].id)}
                      title="Add block"
                      type="button"
                    >
                      +
                    </button>
                  </div>
                )}

                <SortableBlock
                  background={backgrounds[idx] ?? "default"}
                  block={block}
                />
              </Fragment>
            ))}

            {/* End-of-canvas droppable: lets you append after the last block */}
            {isDragging && <CanvasEndZone active={overId === "canvas-end"} />}
          </div>
        </SortableContext>

        <FormatBar />
        <CopilotButton />
        {copilotOpen && <CopilotPanel />}
      </div>
    </div>
  );
}

function SortableBlock({
  background,
  block,
}: {
  background: ResolvedBackground;
  block: Block;
}) {
  const mode = useMode();
  const selection = useSelection();
  const hoveredId = useHoveredId();
  const select = useEditorStore((s) => s.select);
  const setHovered = useEditorStore((s) => s.setHovered);
  const removeBlock = useEditorStore((s) => s.removeBlock);
  const duplicateBlock = useEditorStore((s) => s.duplicateBlock);
  const setProp = useEditorStore((s) => s.setProp);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: block.id,
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
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          select(block.id);
        }
      }}
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

      <def.Render
        background={background}
        block={block as never}
        edit={mode === "edit"}
        onPatch={onPatch}
      />
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: (type: BlockType) => void }) {
  return (
    <div
      style={{
        padding: "64px 48px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        color: "var(--ink-3)",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 32, opacity: 0.3 }}>⊕</div>
      <p style={{ fontSize: 14, margin: 0 }}>
        Start by dragging a block from the palette,
        <br />
        or click a block type below.
      </p>
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {(["hero", "text", "stats", "events"] as BlockType[]).map((type) => (
          <button
            key={type}
            onClick={() => onAdd(type)}
            style={{
              padding: "6px 12px",
              border: "0.5px solid var(--rule-2)",
              borderRadius: 8,
              background: "rgba(255,255,255,.5)",
              fontSize: 12,
              cursor: "pointer",
              color: "var(--ink)",
            }}
            type="button"
          >
            {type}
          </button>
        ))}
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
