"use client";

import type { PatchFn } from "@/blocks/types";
import { pageFeedKey } from "@/editor/page-feeds";
import type { PartnerItem, PartnersBlock } from "@/editor/types";
import { useAutoFeed } from "@/editor/use-auto-feed";

interface Props {
  block: PartnersBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function PartnersRender({ block }: Props) {
  const isAuto = block.source === "auto";

  // An auto feed that legitimately returns no partners is *done*, not still
  // loading. `useAutoFeed` distinguishes "resolved to zero rows" from
  // "unresolved", so an empty partners table no longer renders
  // "Loading partners…" forever on a published page.
  const { items: liveItems, loading } = useAutoFeed<PartnerItem>({
    enabled: isAuto,
    key: pageFeedKey("partners"),
    url: "/api/pages/partners",
  });

  const items = isAuto ? (liveItems ?? []) : (block.items ?? []);

  let emptyMessage = "No partners added yet.";
  if (loading) {
    emptyMessage = "Loading partners…";
  } else if (isAuto) {
    emptyMessage = "No partners to show yet.";
  }

  return (
    <div className="pg-partners pg-block">
      {block.heading && <h2 className="pg-partners__h">{block.heading}</h2>}
      <div className="pg-partners__grid">
        {items.map((p, i) => (
          <div className="pg-partners__logo" key={i}>
            {p.logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={p.name} height={120} src={p.logoSrc} width={240} />
            ) : (
              <span className="pg-partners__name">{p.name}</span>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <p
            style={{ fontSize: 13, color: "var(--ink-3)", gridColumn: "1/-1" }}
          >
            {emptyMessage}
          </p>
        )}
      </div>
    </div>
  );
}
