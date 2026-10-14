"use client";

import { useCallback } from "react";
import { getBlock } from "@/blocks/registry";
import type { PatchFn } from "@/blocks/types";
import { useEditorCallbacks } from "@/editor/callbacks";
import { useInspectorTab, useSelection } from "@/editor/hooks";
import {
  departmentsForCampus,
  metaAfterCampusChange,
} from "@/editor/page-scope";
import { useEditorStore } from "@/editor/store";
import type { EditorCampus, EditorDepartment } from "@/editor/types";
import type { AccentHue } from "@/theme/presets";
import { HUE_COLORS } from "@/theme/presets";
import { DesignPanel } from "./design-panel";

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
    (path, value) => {
      if (selection) {
        setProp(selection, path, value);
      }
    },
    [selection, setProp]
  );

  return (
    <aside className="pe-inspector">
      <div className="pe-inspector-tabs">
        {(["block", "page", "outline"] as const).map((t) => (
          <button
            className={tab === t ? "on" : ""}
            key={t}
            onClick={() => setTab(t)}
            type="button"
          >
            {getTabLabel(t)}
          </button>
        ))}
      </div>

      <div className="scroll pe-inspector-body">
        {tab === "block" &&
          (block && def ? (
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
              <def.Inspector
                block={block as never}
                doc={doc}
                onPatch={onPatch}
              />
              <DesignPanel layout={block.layout} onPatch={onPatch} />
            </>
          ) : (
            <p
              style={{
                fontSize: 12,
                color: "var(--ink-3)",
                padding: "8px 0",
              }}
            >
              Select a block on the canvas to edit its properties.
            </p>
          ))}

        {tab === "page" && <PageTab applyAccent={applyAccent} doc={doc} />}

        {tab === "outline" && (
          <OutlineTab
            blocks={doc.blocks}
            onSelect={(id) => useEditorStore.getState().select(id)}
            selection={selection}
          />
        )}
      </div>
    </aside>
  );
}

function getTabLabel(tab: "block" | "page" | "outline") {
  if (tab === "block") {
    return "Block";
  }
  if (tab === "page") {
    return "Page";
  }
  return "Outline";
}

function PageTab({
  doc,
  applyAccent,
}: {
  doc: ReturnType<typeof useEditorStore.getState>["doc"];
  applyAccent: (hex: string) => void;
}) {
  const setMeta = useEditorStore((s) => s.setMeta);
  const setDoc = useEditorStore((s) => s.setDoc);
  const { campuses, departments, lockedMeta } = useEditorCallbacks();
  const campusId = doc.meta.campus ?? "";

  return (
    <div className="pe-insp-section">
      <div className="pe-insp-section__h">Page settings</div>
      <div className="pe-row">
        <label htmlFor="pe-page-title">Title</label>
        <input
          id="pe-page-title"
          onChange={(e) => setMeta("title", e.target.value)}
          value={doc.meta.title}
        />
      </div>
      <div className="pe-row">
        <label htmlFor="pe-page-description">Description</label>
        <input
          id="pe-page-description"
          onChange={(e) => setMeta("description", e.target.value)}
          value={doc.meta.description ?? ""}
        />
      </div>
      <div className="pe-row">
        <label htmlFor="pe-page-slug">Shared slug</label>
        <input
          disabled={lockedMeta?.slug}
          id="pe-page-slug"
          onChange={(e) => setMeta("slug", e.target.value)}
          readOnly={lockedMeta?.slug}
          value={doc.meta.slug}
        />
      </div>
      <div className="pe-row">
        <label htmlFor="pe-page-campus">Campus</label>
        <CampusField
          campuses={campuses}
          locked={lockedMeta?.campus}
          onChange={(value) =>
            setDoc({
              ...doc,
              meta: metaAfterCampusChange(doc.meta, value, departments),
            })
          }
          value={campusId}
        />
      </div>
      <div className="pe-row">
        <label htmlFor="pe-page-department">Dept</label>
        <DepartmentField
          departments={departmentsForCampus(departments, campusId)}
          doc={doc}
          locked={lockedMeta?.department}
          onChange={(value) => setMeta("department", value)}
          waitingForCampus={!campusId}
        />
      </div>
      {(lockedMeta?.slug || lockedMeta?.department) && (
        <p
          style={{
            fontSize: 10,
            color: "var(--ink-3)",
            margin: "2px 0 0",
          }}
        >
          Managed by the department — this page is published at its unit URL.
        </p>
      )}
      {doc.meta.department && (
        <p
          style={{
            fontSize: 10,
            color: "var(--ink-3)",
            margin: "2px 0 0",
            fontFamily: "var(--mono)",
          }}
        >
          {doc.meta.department}
        </p>
      )}

      <div className="pe-insp-section__h" style={{ marginTop: 16 }}>
        Accent colour
      </div>
      <div className="pe-color-row">
        {(Object.entries(HUE_COLORS) as [AccentHue, string][]).map(
          ([name, hex]) => (
            <button
              className={doc.meta.accentColor === hex ? "on" : ""}
              key={name}
              onClick={() => applyAccent(hex)}
              style={{ background: hex }}
              title={name}
              type="button"
            />
          )
        )}
      </div>
    </div>
  );
}

/**
 * Campus selector. Read-only for editors bound to one campus; otherwise the
 * campuses the host allows, with "National" meaning no campus at all.
 */
function CampusField({
  campuses,
  locked,
  onChange,
  value,
}: {
  campuses: EditorCampus[];
  locked?: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  const name = campuses.find((c) => c.id === value)?.name ?? value;
  if (locked || campuses.length === 0) {
    return (
      <input disabled id="pe-page-campus" readOnly value={name || "National"} />
    );
  }
  return (
    <select
      id="pe-page-campus"
      onChange={(e) => onChange(e.target.value)}
      value={value}
    >
      <option value="">— National (no campus) —</option>
      {campuses.map((campus) => (
        <option key={campus.id} value={campus.id}>
          {campus.name}
        </option>
      ))}
    </select>
  );
}

/**
 * Department selector for the page-settings tab, limited to the chosen
 * campus's departments. Sequential early returns rather than a nested
 * ternary (disallowed by this repo's lint config).
 */
function DepartmentField({
  departments,
  doc,
  locked,
  onChange,
  waitingForCampus,
}: {
  departments: EditorDepartment[];
  doc: ReturnType<typeof useEditorStore.getState>["doc"];
  locked?: boolean;
  onChange: (value: string) => void;
  waitingForCampus: boolean;
}) {
  if (locked) {
    return (
      <input
        disabled
        id="pe-page-department"
        readOnly
        value={
          departments.find((d) => d.id === doc.meta.department)?.name ??
          doc.meta.department
        }
      />
    );
  }

  if (waitingForCampus) {
    return (
      <input
        disabled
        id="pe-page-department"
        placeholder="Choose a campus first"
        readOnly
        value=""
      />
    );
  }

  if (departments.length > 0) {
    return (
      <select
        id="pe-page-department"
        onChange={(e) => onChange(e.target.value)}
        value={doc.meta.department}
      >
        <option value="">— none —</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name} · {d.id.slice(0, 8)}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      id="pe-page-department"
      onChange={(e) => onChange(e.target.value)}
      placeholder="loading…"
      value={doc.meta.department}
    />
  );
}

function OutlineTab({
  blocks,
  selection,
  onSelect,
}: {
  blocks: { id: string; type: string }[];
  selection: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="pe-outline-list">
      {blocks.map((b, i) => (
        <button
          className={`pe-outline-item${selection === b.id ? "on" : ""}`}
          key={b.id}
          onClick={() => onSelect(b.id)}
          type="button"
        >
          <span className="pe-outline-item__num">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span>{b.type}</span>
          <span className="pe-outline-item__meta">{b.id}</span>
        </button>
      ))}
      {blocks.length === 0 && (
        <p style={{ fontSize: 12, color: "var(--ink-3)" }}>
          No blocks on this page yet.
        </p>
      )}
    </div>
  );
}
