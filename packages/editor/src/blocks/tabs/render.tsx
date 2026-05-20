"use client";

import { useState } from "react";
import type { TabsBlock } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";

interface Props { block: TabsBlock; edit: boolean; onPatch: PatchFn; }

export function TabsRender({ block }: Props) {
  const [active, setActive] = useState(0);
  const variant = block.variant ?? "underline";
  const tabs = block.tabs ?? [];
  return (
    <div className={`pg-tabs pg-tabs--${variant} pg-block`}>
      <div className="pg-tabs__bar" role="tablist">
        {tabs.map((tab, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={active === i}
            className={`pg-tabs__tab${active === i ? " active" : ""}`}
            onClick={() => setActive(i)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="pg-tabs__panel" role="tabpanel">
        {tabs[active] && (
          <p className="pg-tabs__body">{tabs[active].body}</p>
        )}
      </div>
    </div>
  );
}
