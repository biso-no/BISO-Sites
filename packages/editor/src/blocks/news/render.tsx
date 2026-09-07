"use client";

import type { PatchFn } from "@/blocks/types";
import { usePageFeedSource } from "@/editor/page-feed-context";
import { pageFeedKey, resolveFeedDepartment } from "@/editor/page-feeds";
import type { NewsBlock } from "@/editor/types";
import { useAutoFeed } from "@/editor/use-auto-feed";

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
  const { department, locale } = usePageFeedSource();
  const dept = resolveFeedDepartment(block.source, department);
  const isLive = !!dept;

  const { items: liveItems, loading } = useAutoFeed<NewsItem>({
    enabled: isLive,
    key: pageFeedKey("news", dept, locale),
    url: `/api/pages/news?dept=${encodeURIComponent(dept)}&locale=${locale}`,
  });

  const items = liveItems ?? [];
  let emptyMessage = "Set a department to load live news.";
  if (loading) {
    emptyMessage = "Loading…";
  } else if (isLive) {
    emptyMessage = "No news yet.";
  }

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
          <p style={{ fontSize: 13, color: "var(--ink-3)" }}>{emptyMessage}</p>
        )}
      </div>
    </div>
  );
}
