"use client";

import { useDraggable } from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { getBlock, paletteGroups } from "@/blocks/registry";
import { useInsertTarget } from "@/editor/hooks";
import { useEditorStore } from "@/editor/store";
import { findColumn } from "@/editor/tree";
import type { BlockType } from "@/editor/types";

const PAGE_HEADER_LABEL = "Page header";
const PAGE_HEADER_DESC = "The band at the top: title, intro and buttons";

export function PalettePane() {
  const [query, setQuery] = useState("");
  const [_showCopilotPrompt, _setShowCopilotPrompt] = useState(false);
  const setCopilotOpen = useEditorStore((s) => s.setCopilotOpen);
  const insertTarget = useInsertTarget();
  const setInsertTarget = useEditorStore((s) => s.setInsertTarget);
  const doc = useEditorStore((s) => s.doc);
  const targetFound = insertTarget
    ? findColumn(doc, insertTarget.columnId)
    : null;

  const groups = useMemo(() => paletteGroups(), []);
  const needle = query.toLowerCase();
  const filtered = query
    ? groups
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (it) =>
              it.label.toLowerCase().includes(needle) ||
              it.desc.toLowerCase().includes(needle)
          ),
        }))
        .filter((group) => group.items.length > 0)
    : groups;
  const showHeaderItem =
    !query || PAGE_HEADER_LABEL.toLowerCase().includes(needle);

  return (
    <aside className="pe-palette">
      <div className="pe-palette-hd">
        <div>
          <div className="pe-palette-hd__ti">Blocks</div>
          <div className="pe-palette-hd__sub">
            Drag onto the page, or click to add
          </div>
        </div>
      </div>

      {insertTarget && targetFound && (
        <div className="pe-palette-target">
          <span>
            Adding to section {doc.sections.indexOf(targetFound.section) + 1},
            column {targetFound.section.columns.indexOf(targetFound.column) + 1}
          </span>
          <button onClick={() => setInsertTarget(null)} type="button">
            Cancel
          </button>
        </div>
      )}

      <div className="pe-palette-hd pe-palette-hd--search">
        <svg
          aria-hidden="true"
          fill="none"
          height="12"
          viewBox="0 0 16 16"
          width="12"
        >
          <circle
            cx="7"
            cy="7"
            r="4.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="m11 11 2.5 2.5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.5"
          />
        </svg>
        <input
          aria-label="Search blocks"
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search blocks…"
          value={query}
        />
        {!query && <span className="pe-palette-kbd">/</span>}
      </div>

      <div className="scroll pe-palette-list">
        {showHeaderItem && <PageOpeningGroup />}
        {filtered.map((cat) => (
          <div key={cat.group}>
            <div className="pe-palette-cat">{cat.label}</div>
            {cat.items.map((item) => (
              <PaletteItem
                desc={item.desc}
                key={item.type}
                label={item.label}
                type={item.type as BlockType}
              />
            ))}
          </div>
        ))}
        {filtered.length === 0 && !showHeaderItem && (
          <p
            style={{
              padding: "12px 16px",
              fontSize: 12,
              color: "var(--ink-3)",
            }}
          >
            No blocks match.
          </p>
        )}
      </div>

      <div className="pe-palette-tpl">
        <div className="pe-palette-tpl__h">
          <span>✦</span> Start from a template
        </div>
        <button
          className="pe-palette-tpl__ai-pill"
          onClick={() => setCopilotOpen(true)}
          type="button"
        >
          <div className="pe-palette-tpl__gem">✦</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500 }}>Build me a section</div>
            <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
              "Add a meet-the-team grid"
            </div>
          </div>
        </button>
      </div>
    </aside>
  );
}

/**
 * The header is not a block: one per page, no dragging. Clicking it gives the
 * page an empty header (or selects the existing one).
 */
function PageOpeningGroup() {
  const addHeader = useEditorStore((s) => s.addHeader);
  return (
    <div>
      <div className="pe-palette-cat">Page opening</div>
      <button
        className="pe-palette-item"
        onClick={() => addHeader()}
        title={PAGE_HEADER_DESC}
        type="button"
      >
        <div className="pe-palette-item__thumb">
          <svg aria-hidden="true" focusable="false" viewBox="0 0 38 30">
            <rect
              fill="var(--ink-3)"
              height="10"
              opacity=".3"
              rx="2"
              width="32"
              x="3"
              y="3"
            />
            <rect
              fill="var(--ink-3)"
              height="2"
              opacity=".15"
              rx="1"
              width="20"
              x="3"
              y="17"
            />
            <rect
              fill="var(--ink-3)"
              height="2"
              opacity=".15"
              rx="1"
              width="14"
              x="3"
              y="22"
            />
          </svg>
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="pe-palette-item__name">{PAGE_HEADER_LABEL}</div>
          <div className="pe-palette-item__desc">{PAGE_HEADER_DESC}</div>
        </div>
      </button>
    </div>
  );
}

function PaletteItem({
  type,
  label,
  desc,
}: {
  type: BlockType;
  label: string;
  desc: string;
}) {
  const insertBlock = useEditorStore((s) => s.insertBlock);
  const select = useEditorStore((s) => s.select);
  const def = getBlock(type);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { source: "palette", type },
  });

  return (
    <button
      className={`pe-palette-item ${isDragging ? "dragging" : ""}`}
      onClick={() => {
        const id = insertBlock(type);
        select(id);
      }}
      ref={setNodeRef}
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
      title={desc}
      type="button"
      {...listeners}
      {...attributes}
    >
      <div className="pe-palette-item__thumb">
        {def?.PaletteThumb ? (
          <def.PaletteThumb />
        ) : (
          <svg aria-hidden="true" focusable="false" viewBox="0 0 38 30">
            <rect
              fill="var(--ink-3)"
              height="24"
              opacity=".15"
              rx="2"
              width="32"
              x="3"
              y="3"
            />
          </svg>
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="pe-palette-item__name">{label}</div>
        <div className="pe-palette-item__desc">{desc}</div>
      </div>
      <svg
        aria-hidden="true"
        className="pe-palette-item__pinhole"
        height="13"
        viewBox="0 0 16 16"
        width="13"
      >
        <circle cx="5" cy="4" fill="currentColor" r="1.5" />
        <circle cx="5" cy="8" fill="currentColor" r="1.5" />
        <circle cx="5" cy="12" fill="currentColor" r="1.5" />
        <circle cx="11" cy="4" fill="currentColor" r="1.5" />
        <circle cx="11" cy="8" fill="currentColor" r="1.5" />
        <circle cx="11" cy="12" fill="currentColor" r="1.5" />
      </svg>
    </button>
  );
}
