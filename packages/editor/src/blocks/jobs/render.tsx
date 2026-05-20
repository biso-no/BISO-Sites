"use client";

import { useEffect, useState } from "react";
import type { PatchFn } from "@/blocks/types";
import { useEditorStore } from "@/editor/store";
import type { JobsBlock } from "@/editor/types";

interface JobItem {
  commitment: string;
  deadline: string;
  department: string;
  title: string;
}

interface Props {
  block: JobsBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function JobsRender({ block, edit, onPatch }: Props) {
  const department = useEditorStore((s) => s.doc.meta.department);
  const [items, setItems] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(false);

  const source = block.source || "auto";
  const dept = source === "auto" ? department : source;
  const isLive = !!dept;
  let emptyMessage = "Set a department to load live roles.";
  if (loading) {
    emptyMessage = "Loading…";
  } else if (isLive) {
    emptyMessage = "No open roles right now.";
  }

  useEffect(() => {
    if (!dept) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/pages/jobs?dept=${encodeURIComponent(dept)}`)
      .then((r) => r.json())
      .then((data: JobItem[]) => {
        if (!cancelled) {
          setItems(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [dept]);

  return (
    <div className="pg-jobs pg-block">
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        {edit ? (
          // biome-ignore lint/a11y/noNoninteractiveElementInteractions: contentEditable and editor preview controls intentionally use custom interaction surfaces.
          <h2
            contentEditable
            data-edit="1"
            onBlur={(e) =>
              onPatch("heading", e.currentTarget.textContent ?? "")
            }
            style={{ margin: 0 }}
            suppressContentEditableWarning
          >
            {block.heading}
          </h2>
        ) : (
          <h2 style={{ margin: 0 }}>{block.heading}</h2>
        )}
        {isLive && (
          <div
            style={{
              fontSize: 11,
              color: "var(--leaf)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 500,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "var(--leaf)",
                display: "inline-block",
              }}
            />
            {loading ? "Loading…" : "Live"}
          </div>
        )}
      </div>
      <div className="pg-jobs__list">
        {items.length > 0 ? (
          items.map((job, i) => (
            <div className="pg-jobs__item" key={i}>
              <div className="pg-jobs__item-title">{job.title}</div>
              <div className="pg-jobs__item-meta">
                {[job.commitment, job.deadline && `Deadline: ${job.deadline}`]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
          ))
        ) : (
          <p style={{ fontSize: 13, color: "var(--ink-3)" }}>{emptyMessage}</p>
        )}
      </div>
    </div>
  );
}
