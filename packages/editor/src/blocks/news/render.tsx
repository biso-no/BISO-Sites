"use client";

import { useEffect, useState } from "react";
import type { PatchFn } from "@/blocks/types";
import { useEditorStore } from "@/editor/store";
import type { NewsBlock } from "@/editor/types";

interface NewsItem {
  department: string;
  publishedAt: string;
  summary: string;
  title: string;
}

interface Props {
  block: NewsBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function NewsRender({ block, edit, onPatch }: Props) {
  const department = useEditorStore((s) => s.doc.meta.department);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);

  const source = block.source || "auto";
  const dept = source === "auto" ? department : source;
  const isLive = !!dept;

  useEffect(() => {
    if (!dept) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/pages/news?dept=${encodeURIComponent(dept)}`)
      .then((r) => r.json())
      .then((data: NewsItem[]) => {
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
    <div className="pg-news pg-block">
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        {edit ? (
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
      <div className="pg-news__list">
        {items.length > 0 ? (
          items.map((post, i) => (
            <div className="pg-news__item" key={i}>
              <div className="pg-news__item-title">{post.title}</div>
              <div className="pg-news__item-meta">
                {[post.publishedAt, post.summary].filter(Boolean).join(" · ")}
              </div>
            </div>
          ))
        ) : (
          <p style={{ fontSize: 13, color: "var(--ink-3)" }}>
            {loading
              ? "Loading…"
              : isLive
                ? "No news yet."
                : "Set a department to load live news."}
          </p>
        )}
      </div>
    </div>
  );
}
