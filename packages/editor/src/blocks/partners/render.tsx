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

  useEffect(() => {
    if (block.source !== "auto") {
      setLiveItems(null);
      return;
    }
    let cancelled = false;
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
      });
    return () => {
      cancelled = true;
    };
  }, [block.source]);

  const items =
    (block.source === "auto" ? liveItems : null) ?? block.items ?? [];

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
            {block.source === "auto"
              ? "Loading partners…"
              : "No partners added yet."}
          </p>
        )}
      </div>
    </div>
  );
}
