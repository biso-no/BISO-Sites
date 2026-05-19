"use client";

import { useEffect, useState } from "react";
import type { JobsBlock } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { useEditorStore } from "@/editor/store";

interface JobItem { title: string; department: string; deadline: string; commitment: string; }

interface Props { block: JobsBlock; edit: boolean; onPatch: PatchFn; }

export function JobsRender({ block, edit, onPatch }: Props) {
  const department = useEditorStore((s) => s.doc.meta.department);
  const [items, setItems] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(false);

  const source = block.source || "auto";
  const dept = source === "auto" ? department : source;
  const isLive = !!dept;

  useEffect(() => {
    if (!dept) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/pages/jobs?dept=${encodeURIComponent(dept)}`)
      .then((r) => r.json())
      .then((data: JobItem[]) => { if (!cancelled) setItems(data); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [dept]);

  return (
    <div className="pg-jobs pg-block">
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}>
        {edit ? (
          <h2
            contentEditable suppressContentEditableWarning data-edit="1"
            style={{ margin: 0 }}
            onBlur={(e) => onPatch("heading", e.currentTarget.textContent ?? "")}
          >{block.heading}</h2>
        ) : (
          <h2 style={{ margin: 0 }}>{block.heading}</h2>
        )}
        {isLive && (
          <div style={{ fontSize: 11, color: "var(--leaf)", display: "flex", alignItems: "center", gap: 6, fontWeight: 500 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--leaf)", display: "inline-block" }}/>
            {loading ? "Loading…" : "Live"}
          </div>
        )}
      </div>
      <div className="pg-jobs__list">
        {items.length > 0 ? items.map((job, i) => (
          <div key={i} className="pg-jobs__item">
            <div className="pg-jobs__item-title">{job.title}</div>
            <div className="pg-jobs__item-meta">
              {[job.commitment, job.deadline && `Deadline: ${job.deadline}`].filter(Boolean).join(" · ")}
            </div>
          </div>
        )) : (
          <p style={{ fontSize: 13, color: "var(--ink-3)" }}>
            {loading ? "Loading…" : isLive ? "No open roles right now." : "Set a department to load live roles."}
          </p>
        )}
      </div>
    </div>
  );
}
