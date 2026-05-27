"use client";

import { GitCompare, X } from "lucide-react";
import { candidateById, useRecruitment } from "../recruitment-context";
import { Avatar } from "../shared";

export function CompareTray({ onOpen }: { onOpen: () => void }) {
  const { compareIds, candidates, removeFromCompare, clearCompare } =
    useRecruitment();

  return (
    <div className="compare-tray">
      <span className="ct-label">
        <GitCompare size={14} /> Compare
      </span>
      <div className="ct-avatars">
        {compareIds.map((id) => {
          const candidate = candidateById(candidates, id);
          if (!candidate) {
            return null;
          }
          return (
            <span className="ct-chip" key={id}>
              <Avatar name={candidate.name} size={22} />
              {candidate.name.split(" ")[0]}
              <button
                onClick={() => removeFromCompare(id)}
                title="Remove"
                type="button"
              >
                <X size={11} />
              </button>
            </span>
          );
        })}
      </div>
      <button className="btn-dark" onClick={onOpen} type="button">
        Open compare ({compareIds.length})
      </button>
      <button className="ct-clear" onClick={clearCompare} type="button">
        Clear
      </button>
    </div>
  );
}
