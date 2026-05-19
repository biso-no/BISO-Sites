"use client";

import { useCallback } from "react";
import { useEditorStore } from "@/editor/store";
import { useSelection, useInspectorTab } from "@/editor/hooks";
import { getBlock } from "@/blocks/registry";
import type { PatchFn } from "@/blocks/types";
import { HUE_COLORS } from "@/theme/presets";
import type { AccentHue } from "@/theme/presets";
import { useEditorCallbacks } from "@/editor/callbacks";

export function InspectorPane() {
  const selection = useSelection();
  const tab = useInspectorTab();
  const setTab = useEditorStore((s) => s.setInspectorTab);
  const doc = useEditorStore((s) => s.doc);
  const block = selection ? doc.blocks.find((b) => b.id === selection) : null;
  const def = block ? getBlock(block.type) : null;
  const setProp = useEditorStore((s) => s.setProp);
  const applyAccent = useEditorStore((s) => s.applyAccent);

  const onPatch = useCallback<PatchFn>(
    (path, value) => { if (selection) setProp(selection, path, value); },
    [selection, setProp]
  );

  return (
    <aside className="pe-inspector">
      <div className="pe-inspector-tabs">
        {(["block", "page", "outline"] as const).map((t) => (
          <button key={t} type="button" className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {t === "block" ? "Block" : t === "page" ? "Page" : "Outline"}
          </button>
        ))}
      </div>

      <div className="pe-inspector-body scroll">
        {tab === "block" && (
          <>
            {block && def ? (
              <>
                <div className="pe-insp-hd">
                  <div className="pe-insp-hd__ic">
                    <def.PaletteThumb />
                  </div>
                  <div>
                    <div className="pe-insp-hd__ti">{def.label}</div>
                    <div className="pe-insp-hd__sub">{block.id}</div>
                  </div>
                </div>
                <def.Inspector block={block as never} doc={doc} onPatch={onPatch} />
              </>
            ) : (
              <p style={{ fontSize: 12, color: "var(--ink-3)", padding: "8px 0" }}>
                Select a block on the canvas to edit its properties.
              </p>
            )}
          </>
        )}

        {tab === "page" && (
          <PageTab doc={doc} applyAccent={applyAccent} />
        )}

        {tab === "outline" && (
          <OutlineTab blocks={doc.blocks} selection={selection} onSelect={(id) => useEditorStore.getState().select(id)} />
        )}
      </div>
    </aside>
  );
}

function PageTab({ doc, applyAccent }: {
  doc: ReturnType<typeof useEditorStore.getState>["doc"];
  applyAccent: (hex: string) => void;
}) {
  const setMeta = useEditorStore((s) => s.setMeta);
  const { departments } = useEditorCallbacks();

  return (
    <div className="pe-insp-section">
      <div className="pe-insp-section__h">Page settings</div>
      <div className="pe-row">
        <label>Title</label>
        <input value={doc.meta.title} onChange={(e) => setMeta("title", e.target.value)} />
      </div>
      <div className="pe-row">
        <label>Slug</label>
        <input value={doc.meta.slug} onChange={(e) => setMeta("slug", e.target.value)} />
      </div>
      <div className="pe-row">
        <label>Dept</label>
        {departments.length > 0 ? (
          <select value={doc.meta.department} onChange={(e) => setMeta("department", e.target.value)}>
            <option value="">— none —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name} · {d.id.slice(0, 8)}</option>
            ))}
          </select>
        ) : (
          <input value={doc.meta.department} onChange={(e) => setMeta("department", e.target.value)} placeholder="loading…" />
        )}
      </div>
      {doc.meta.department && (
        <p style={{ fontSize: 10, color: "var(--ink-3)", margin: "2px 0 0", fontFamily: "var(--mono)" }}>
          {doc.meta.department}
        </p>
      )}

      <div className="pe-insp-section__h" style={{ marginTop: 16 }}>Accent colour</div>
      <div className="pe-color-row">
        {(Object.entries(HUE_COLORS) as [AccentHue, string][]).map(([name, hex]) => (
          <button
            key={name}
            type="button"
            title={name}
            className={doc.meta.accentColor === hex ? "on" : ""}
            style={{ background: hex }}
            onClick={() => applyAccent(hex)}
          />
        ))}
      </div>
    </div>
  );
}

function OutlineTab({ blocks, selection, onSelect }: {
  blocks: { id: string; type: string }[];
  selection: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="pe-outline-list">
      {blocks.map((b, i) => (
        <div
          key={b.id}
          className={`pe-outline-item${selection === b.id ? " on" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(b.id)}
          onKeyDown={(e) => e.key === "Enter" && onSelect(b.id)}
        >
          <span className="pe-outline-item__num">{String(i + 1).padStart(2, "0")}</span>
          <span>{b.type}</span>
          <span className="pe-outline-item__meta">{b.id}</span>
        </div>
      ))}
      {blocks.length === 0 && (
        <p style={{ fontSize: 12, color: "var(--ink-3)" }}>No blocks on this page yet.</p>
      )}
    </div>
  );
}
