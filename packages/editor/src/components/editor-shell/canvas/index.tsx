"use client";

import { useCallback, Fragment } from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useEditorStore } from "@/editor/store";
import { useBlocks, useMode, useViewport, useSelection, useHoveredId, useCopilotOpen } from "@/editor/hooks";
import { getBlock } from "@/blocks/registry";
import type { Block, BlockType } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { CopilotButton } from "../copilot/floating-button";
import { CopilotPanel } from "../copilot/chat-panel";
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
        background: "var(--accent)",
        boxShadow: active ? "0 0 0 4px color-mix(in srgb, var(--accent) 18%, transparent)" : "none",
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
    <div ref={setNodeRef} style={{ minHeight: 56, display: "flex", alignItems: "flex-start", paddingTop: 1 }}>
      <div style={{ width: "100%" }}>
        <DropLine active={active} />
      </div>
    </div>
  );
}

export function CanvasPane({ activeDragId, activePaletteType, overId }: CanvasPaneProps) {
  const mode = useMode();
  const viewport = useViewport();
  const setMode = useEditorStore((s) => s.setMode);
  const setViewport = useEditorStore((s) => s.setViewport);
  const blocks = useBlocks();
  const insertBlock = useEditorStore((s) => s.insertBlock);
  const copilotOpen = useCopilotOpen();

  const isDragging = activeDragId !== null || activePaletteType !== null;
  const frameClass = `pe-frame ${viewport}`;

  return (
    <div className="pe-canvas-col">
      {/* Toolbar */}
      <div className="pe-canvas-bar">
        <div className="pe-mode-seg">
          <button type="button" className={mode === "edit" ? "on" : ""} onClick={() => setMode("edit")}>Edit</button>
          <button type="button" className={mode === "preview" ? "on" : ""} onClick={() => setMode("preview")}>Preview</button>
        </div>

        <div className="pe-vp-seg">
          {(["desk", "tab", "mob"] as const).map((vp) => (
            <button
              key={vp}
              type="button"
              title={vp === "desk" ? "Desktop" : vp === "tab" ? "Tablet" : "Mobile"}
              className={viewport === vp ? "on" : ""}
              onClick={() => setViewport(vp)}
            >
              {vp === "desk" && <DesktopIcon />}
              {vp === "tab" && <TabletIcon />}
              {vp === "mob" && <MobileIcon />}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas stage */}
      <div className="pe-stage scroll">
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className={frameClass}>
            <span className="pe-frame__breakpoint-tag">
              {viewport === "desk" ? "1180" : viewport === "tab" ? "820" : "390"}px
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
                      type="button"
                      title="Add block"
                      onClick={() => insertBlock("text", blocks[idx - 1].id)}
                    >
                      +
                    </button>
                  </div>
                )}

                <SortableBlock block={block} idx={idx} />
              </Fragment>
            ))}

            {/* End-of-canvas droppable: lets you append after the last block */}
            {isDragging && (
              <CanvasEndZone active={overId === "canvas-end"} />
            )}
          </div>
        </SortableContext>

        <FormatBar />
        <CopilotButton />
        {copilotOpen && <CopilotPanel />}
      </div>
    </div>
  );
}

function SortableBlock({ block, idx }: { block: Block; idx: number }) {
  const mode = useMode();
  const selection = useSelection();
  const hoveredId = useHoveredId();
  const select = useEditorStore((s) => s.select);
  const setHovered = useEditorStore((s) => s.setHovered);
  const removeBlock = useEditorStore((s) => s.removeBlock);
  const duplicateBlock = useEditorStore((s) => s.duplicateBlock);
  const setProp = useEditorStore((s) => s.setProp);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
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
    return <div style={style} ref={setNodeRef}><p style={{ padding: 24, color: "var(--ink-3)" }}>Unknown block: {block.type}</p></div>;
  }

  return (
      <div
        ref={setNodeRef}
        style={style}
        className={cls}
        onMouseEnter={() => setHovered(block.id)}
        onMouseLeave={() => setHovered(null)}
        onClick={(e) => { e.stopPropagation(); select(block.id); }}
        data-block-id={block.id}
      >
        {isSelected && mode === "edit" && (
          <span className="pe-block__tag">{def.label}</span>
        )}

        {mode === "edit" && (
          <>
            <div className="pe-block__handle">
              <button type="button" title="Drag to reorder" className="pe-block__dragger" {...listeners} {...attributes}>
                ⠿
              </button>
            </div>
            <div className="pe-block__row-actions">
              <button type="button" title="Duplicate" onClick={(e) => { e.stopPropagation(); duplicateBlock(block.id); }}>⊕</button>
              <button type="button" title="Delete" className="delete" onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }}>✕</button>
            </div>
          </>
        )}

        <def.Render
          block={block as never}
          edit={mode === "edit"}
          onPatch={onPatch}
        />
      </div>
  );
}

function EmptyState({ onAdd }: { onAdd: (type: BlockType) => void }) {
  return (
    <div style={{
      padding: "64px 48px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 16,
      color: "var(--ink-3)",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 32, opacity: .3 }}>⊕</div>
      <p style={{ fontSize: 14, margin: 0 }}>Start by dragging a block from the palette,<br/>or click a block type below.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {(["hero", "text", "stats", "events"] as BlockType[]).map((type) => (
          <button
            key={type}
            type="button"
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
          >
            {type}
          </button>
        ))}
      </div>
    </div>
  );
}

function DesktopIcon() {
  return <svg width="16" height="12" viewBox="0 0 16 12" fill="none"><rect x=".5" y=".5" width="15" height="9" rx="1.5" stroke="currentColor"/><path d="M5.5 11.5h5M8 9.5v2" stroke="currentColor" strokeLinecap="round"/></svg>;
}
function TabletIcon() {
  return <svg width="10" height="14" viewBox="0 0 10 14" fill="none"><rect x=".5" y=".5" width="9" height="13" rx="1.5" stroke="currentColor"/><circle cx="5" cy="12" r=".75" fill="currentColor"/></svg>;
}
function MobileIcon() {
  return <svg width="8" height="14" viewBox="0 0 8 14" fill="none"><rect x=".5" y=".5" width="7" height="13" rx="1.5" stroke="currentColor"/><circle cx="4" cy="12" r=".75" fill="currentColor"/></svg>;
}
