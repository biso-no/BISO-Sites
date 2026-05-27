"use client";

import { Archive, CalendarPlus, Mail, MoveRight, X } from "lucide-react";
import { useRecruitment } from "../recruitment-context";
import { RECRUITMENT_STAGES, type RecruitmentStageId } from "../view-model";

export function BulkActionBar({
  selectedIds,
  onClear,
  onMoveStage,
}: {
  onClear: () => void;
  onMoveStage: (stage: RecruitmentStageId) => void;
  selectedIds: string[];
}) {
  const { actions } = useRecruitment();
  const count = selectedIds.length;
  if (count === 0) {
    return null;
  }

  return (
    <div className="bulk-bar">
      <span className="bb-count">{count} selected</span>
      <button
        className="bb-act"
        onClick={() => actions.openEmail(selectedIds, "schedule")}
        type="button"
      >
        <CalendarPlus size={13} /> Schedule
      </button>
      <label className="bb-move">
        <MoveRight size={13} /> Move stage
        <select
          aria-label="Move to stage"
          defaultValue=""
          onChange={(event) => {
            const value = event.target.value as RecruitmentStageId;
            if (value) {
              onMoveStage(value);
              event.target.value = "";
            }
          }}
        >
          <option disabled value="">
            Choose
          </option>
          {RECRUITMENT_STAGES.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.label}
            </option>
          ))}
        </select>
      </label>
      <button
        className="bb-act accent"
        onClick={() => actions.openEmail(selectedIds, "shortlist")}
        type="button"
      >
        <Mail size={13} /> AI-personalize email ★
      </button>
      <button
        className="bb-act"
        onClick={() => actions.openEmail(selectedIds, "reject")}
        type="button"
      >
        <Archive size={13} /> Archive
      </button>
      <button
        className="bb-close"
        onClick={onClear}
        title="Clear"
        type="button"
      >
        <X size={14} />
      </button>
    </div>
  );
}
