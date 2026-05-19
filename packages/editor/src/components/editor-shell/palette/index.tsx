"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { BLOCK_LIBRARY, getBlock } from "@/blocks/registry";
import { useEditorStore } from "@/editor/store";
import type { BlockType } from "@/editor/types";

export function PalettePane() {
  const [query, setQuery] = useState("");
  const [showCopilotPrompt, setShowCopilotPrompt] = useState(false);
  const setCopilotOpen = useEditorStore((s) => s.setCopilotOpen);

  const filtered = query
    ? BLOCK_LIBRARY.map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (it) =>
            it.label.toLowerCase().includes(query.toLowerCase()) ||
            it.desc.toLowerCase().includes(query.toLowerCase())
        ),
      })).filter((cat) => cat.items.length > 0)
    : BLOCK_LIBRARY;

  return (
    <aside className="pe-palette">
      <div className="pe-palette-hd">
        <div>
          <div className="pe-palette-hd__ti">Blocks</div>
          <div className="pe-palette-hd__sub">Drag onto the page, or click to add</div>
        </div>
      </div>

      <div className="pe-palette-hd pe-palette-hd--search">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="m11 11 2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          placeholder="Search blocks…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search blocks"
        />
        {!query && <span className="pe-palette-kbd">/</span>}
      </div>

      <div className="pe-palette-list scroll">
        {filtered.map((cat) => (
          <div key={cat.category}>
            <div className="pe-palette-cat">{cat.category}</div>
            {cat.items.map((item) => (
              <PaletteItem key={item.type} type={item.type as BlockType} label={item.label} desc={item.desc} />
            ))}
          </div>
        ))}
        {filtered.length === 0 && (
          <p style={{ padding: "12px 16px", fontSize: 12, color: "var(--ink-3)" }}>No blocks match.</p>
        )}
      </div>

      <div className="pe-palette-tpl">
        <div className="pe-palette-tpl__h">
          <span>✦</span> Start from a template
        </div>
        <button
          type="button"
          className="pe-palette-tpl__ai-pill"
          onClick={() => setCopilotOpen(true)}
        >
          <div className="pe-palette-tpl__gem">✦</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500 }}>Build me a section</div>
            <div style={{ fontSize: 11, color: "var(--ink-3)" }}>"Add a meet-the-team grid"</div>
          </div>
        </button>
      </div>
    </aside>
  );
}

function PaletteItem({ type, label, desc }: { type: BlockType; label: string; desc: string }) {
  const insertBlock = useEditorStore((s) => s.insertBlock);
  const select = useEditorStore((s) => s.select);
  const def = getBlock(type);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { source: "palette", type },
  });

  return (
    <div
      ref={setNodeRef}
      className={`pe-palette-item${isDragging ? " dragging" : ""}`}
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
      onClick={() => {
        const id = insertBlock(type);
        select(id);
      }}
      title={desc}
      {...listeners}
      {...attributes}
    >
      <div className="pe-palette-item__thumb">
        {def?.PaletteThumb ? <def.PaletteThumb /> : (
          <svg viewBox="0 0 38 30"><rect x="3" y="3" width="32" height="24" rx="2" fill="var(--ink-3)" opacity=".15"/></svg>
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="pe-palette-item__name">{label}</div>
        <div className="pe-palette-item__desc">{desc}</div>
      </div>
      <svg width="13" height="13" viewBox="0 0 16 16" className="pe-palette-item__pinhole" aria-hidden="true">
        <circle cx="5" cy="4" r="1.5" fill="currentColor"/>
        <circle cx="5" cy="8" r="1.5" fill="currentColor"/>
        <circle cx="5" cy="12" r="1.5" fill="currentColor"/>
        <circle cx="11" cy="4" r="1.5" fill="currentColor"/>
        <circle cx="11" cy="8" r="1.5" fill="currentColor"/>
        <circle cx="11" cy="12" r="1.5" fill="currentColor"/>
      </svg>
    </div>
  );
}
