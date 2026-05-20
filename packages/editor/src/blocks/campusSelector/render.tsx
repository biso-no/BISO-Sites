"use client";

import type { CampusSelectorBlock } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";

const CAMPUSES = [
  { id: "oslo",  name: "Oslo" },
  { id: "stavanger", name: "Stavanger" },
  { id: "bergen", name: "Bergen" },
  { id: "trondheim", name: "Trondheim" },
];

interface Props { block: CampusSelectorBlock; edit: boolean; onPatch: PatchFn; }

export function CampusSelectorRender({ block, edit }: Props) {
  const mode = block.mode ?? "cards";
  return (
    <div className={`pg-campusselect pg-campusselect--${mode} pg-block`}>
      {block.heading && <h2 className="pg-campusselect__h">{block.heading}</h2>}
      {mode === "switcher" ? (
        <div className="pg-campusselect__switcher">
          <label className="pg-campusselect__label" htmlFor="campus-select">Choose your campus</label>
          {edit ? (
            <div className="pg-campusselect__select-wrap">
              <select id="campus-select" className="pg-campusselect__select" disabled>
                <option>Select campus…</option>
                {CAMPUSES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          ) : (
            <div className="pg-campusselect__select-wrap">
              <select id="campus-select" className="pg-campusselect__select">
                <option>Select campus…</option>
                {CAMPUSES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </div>
      ) : (
        <div className="pg-campusselect__cards">
          {CAMPUSES.map((c) => (
            <div key={c.id} className="pg-campusselect__card">
              <span className="pg-campusselect__card-name">{c.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
