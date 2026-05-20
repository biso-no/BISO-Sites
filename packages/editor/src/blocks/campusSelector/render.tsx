"use client";

import type { PatchFn } from "@/blocks/types";
import type { CampusSelectorBlock } from "@/editor/types";

const CAMPUSES = [
  { id: "oslo", name: "Oslo" },
  { id: "stavanger", name: "Stavanger" },
  { id: "bergen", name: "Bergen" },
  { id: "trondheim", name: "Trondheim" },
];

interface Props {
  block: CampusSelectorBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function CampusSelectorRender({ block, edit }: Props) {
  const mode = block.mode ?? "cards";
  return (
    <div className={`pg-campusselect pg-campusselect--${mode} pg-block`}>
      {block.heading && <h2 className="pg-campusselect__h">{block.heading}</h2>}
      {mode === "switcher" ? (
        <div className="pg-campusselect__switcher">
          <label className="pg-campusselect__label" htmlFor="campus-select">
            Choose your campus
          </label>
          {edit ? (
            <div className="pg-campusselect__select-wrap">
              <select
                className="pg-campusselect__select"
                disabled
                id="campus-select"
              >
                <option>Select campus…</option>
                {CAMPUSES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="pg-campusselect__select-wrap">
              <select className="pg-campusselect__select" id="campus-select">
                <option>Select campus…</option>
                {CAMPUSES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      ) : (
        <div className="pg-campusselect__cards">
          {CAMPUSES.map((c) => (
            <div className="pg-campusselect__card" key={c.id}>
              <span className="pg-campusselect__card-name">{c.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
