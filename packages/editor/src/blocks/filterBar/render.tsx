"use client";

import type { FilterBarBlock } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";

interface Props { block: FilterBarBlock; edit: boolean; onPatch: PatchFn; }

const LABELS: Record<FilterBarBlock["target"], string> = {
  news: "Search news…",
  jobs: "Search roles…",
  units: "Search units…",
};

export function FilterBarRender({ block, edit }: Props) {
  return (
    <div className="pg-filterbar pg-block">
      <div className="pg-filterbar__row">
        <input
          className="pg-filterbar__input"
          type="search"
          placeholder={LABELS[block.target]}
          readOnly={edit}
          aria-label={LABELS[block.target]}
        />
        {edit && (
          <span className="pg-filterbar__hint">
            Filters the {block.target} feed on this page
          </span>
        )}
      </div>
    </div>
  );
}
