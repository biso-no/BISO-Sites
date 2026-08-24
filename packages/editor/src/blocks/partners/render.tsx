"use client";

import { useEffect, useState } from "react";
import type { PatchFn } from "@/blocks/types";
import type { PartnerItem, PartnersBlock } from "@/editor/types";

interface Props {
  block: PartnersBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function PartnersRender({ block }: Props) {
  const [liveItems, setLiveItems] = useState<PartnerItem[] | null>(null);
  const isAuto = block.source === "auto";
  // An auto feed that legitimately returns no partners is *done*, not still
  // loading. Without tracking completion separately, an empty partners table
  // rendered "Loading partners…" forever on a published page.
  const [loading, setLoading] = useState(isAuto);

  useEffect(() => {
    if (!isAuto) {
      setLiveItems(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch("/api/pages/partners")
      .then((r) => r.json())
      .then((data: PartnerItem[]) => {
        if (!cancelled) {
          setLiveItems(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLiveItems(null);
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
  }, [isAuto]);

  const items =
    (isAuto ? liveItems : null) ?? (isAuto ? [] : (block.items ?? []));

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
