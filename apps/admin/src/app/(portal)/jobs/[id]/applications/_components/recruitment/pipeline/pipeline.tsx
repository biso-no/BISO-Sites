"use client";

import { JobApplicationsStatus } from "@repo/api/types/appwrite";
import { canTransitionRecruitmentApplicationStatus } from "@repo/shared/types/recruitment";
import { LayoutGrid, List, Search, Sparkles, Star } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { updateJobApplicationStatus } from "@/app/(portal)/_actions/jobs";
import { useRecruitment } from "../recruitment-context";
import {
  cx,
  RECRUITMENT_STAGES,
  type RecruitmentStageId,
  type WorkspaceCandidate,
} from "../view-model";
import { AiInsights } from "./ai-insights";
import { BulkActionBar } from "./bulk-action-bar";
import { CandidateCard } from "./candidate-card";
import { ListView } from "./list-view";

const STATUS_BY_STAGE: Record<RecruitmentStageId, JobApplicationsStatus> = {
  accepted: JobApplicationsStatus.ACCEPTED,
  interview: JobApplicationsStatus.INTERVIEW,
  rejected: JobApplicationsStatus.REJECTED,
  reviewed: JobApplicationsStatus.REVIEWED,
  submitted: JobApplicationsStatus.SUBMITTED,
};

const STAGE_TOUR_ANCHORS = ["pipeline-stage-first", "pipeline-stage-next"];

export function Pipeline() {
  const { candidates, updateCandidate } = useRecruitment();
  const [mode, setMode] = useState<"kanban" | "list">("kanban");
  const [search, setSearch] = useState("");
  const [sortByMatch, setSortByMatch] = useState(true);
  const [starredOnly, setStarredOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<RecruitmentStageId | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = candidates.filter((candidate) => {
      if (starredOnly && !candidate.starred) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        candidate.name.toLowerCase().includes(q) ||
        candidate.email.toLowerCase().includes(q) ||
        candidate.skills.some((skill) => skill.toLowerCase().includes(q))
      );
    });
    if (sortByMatch) {
      rows = [...rows].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    }
    return rows;
  }, [candidates, search, sortByMatch, starredOnly]);

  const byStage = useMemo(() => {
    const map = new Map<RecruitmentStageId, WorkspaceCandidate[]>();
    for (const stage of RECRUITMENT_STAGES) {
      map.set(stage.id, []);
    }
    for (const candidate of filtered) {
      const list = map.get(candidate.stage as RecruitmentStageId);
      if (list) {
        list.push(candidate);
      }
    }
    return map;
  }, [filtered]);

  const flashToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  };

  const commitStatus = (
    candidate: WorkspaceCandidate,
    target: RecruitmentStageId
  ) => {
    if (candidate.stage === target) {
      return;
    }
    const nextStatus = STATUS_BY_STAGE[target];
    if (
      !canTransitionRecruitmentApplicationStatus(
        candidate.stage as JobApplicationsStatus,
        nextStatus
      )
    ) {
      flashToast(
        `Can't move ${candidate.name.split(" ")[0]} straight to ${target}.`
      );
      return;
    }
    const previous = candidate.stage;
    updateCandidate(candidate.id, { stage: nextStatus });
    startTransition(async () => {
      const result = await updateJobApplicationStatus(candidate.id, {
        status: nextStatus,
      });
      if (result.error) {
        updateCandidate(candidate.id, { stage: previous });
        flashToast(result.error);
      }
    });
  };

  const handleDrop = (stage: RecruitmentStageId) => {
    setDragOver(null);
    if (!draggingId) {
      return;
    }
    const candidate = candidates.find((c) => c.id === draggingId);
    setDraggingId(null);
    if (candidate) {
      commitStatus(candidate, stage);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(filtered.map((c) => c.id)) : new Set());
  };

  const bulkMove = (stage: RecruitmentStageId) => {
    const nextStatus = STATUS_BY_STAGE[stage];
    const toMove = Array.from(selectedIds)
      .map((id) => candidates.find((c) => c.id === id))
      .filter((c): c is WorkspaceCandidate => c !== undefined && c.stage !== stage);

    if (toMove.length === 0) {
      setSelectedIds(new Set());
      return;
    }

    const valid = toMove.filter((c) =>
      canTransitionRecruitmentApplicationStatus(c.stage as JobApplicationsStatus, nextStatus)
    );

    if (valid.length !== toMove.length) {
      flashToast(`Some candidates could not be moved to ${stage}.`);
    }

    if (valid.length === 0) {
      setSelectedIds(new Set());
      return;
    }

    const previousStages = new Map(valid.map((c) => [c.id, c.stage]));
    for (const c of valid) {
      updateCandidate(c.id, { stage: nextStatus });
    }
    
    setSelectedIds(new Set());

    startTransition(async () => {
      const results = await Promise.allSettled(
        valid.map((c) =>
          updateJobApplicationStatus(c.id, { status: nextStatus }).then((res) => {
            if (res.error) throw new Error(res.error);
            return res;
          })
        )
      );

      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        for (let i = 0; i < results.length; i++) {
          if (results[i].status === "rejected") {
            const c = valid[i];
            updateCandidate(c.id, { stage: previousStages.get(c.id)! });
          }
        }
        flashToast(`Moved ${valid.length - failures.length}/${valid.length} candidates. ${failures.length} failed.`);
      } else if (valid.length > 1) {
        flashToast(`Successfully moved ${valid.length} candidates.`);
      }
    });
  };

  return (
    <div className="pipeline rcr-pad" data-tour="workspace-pipeline">
      <AiInsights />

      <div className="pl-toolbar">
        <div className="pl-search">
          <Search size={14} />
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search candidates, skills, email…"
            value={search}
          />
        </div>
        <button
          className={cx("pl-pill", sortByMatch && "on")}
          onClick={() => setSortByMatch((value) => !value)}
          type="button"
        >
          <Sparkles size={12} /> Sort by match
        </button>
        <button
          className={cx("pl-pill", starredOnly && "on")}
          onClick={() => setStarredOnly((value) => !value)}
          type="button"
        >
          <Star size={12} /> Starred only
        </button>
        <div className="pl-viewtoggle">
          <button
            className={mode === "kanban" ? "on" : ""}
            onClick={() => setMode("kanban")}
            title="Board"
            type="button"
          >
            <LayoutGrid size={14} />
          </button>
          <button
            className={mode === "list" ? "on" : ""}
            onClick={() => setMode("list")}
            title="List"
            type="button"
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {mode === "kanban" ? (
        <div className="kanban">
          {RECRUITMENT_STAGES.map((stage, stageIndex) => {
            const cards = byStage.get(stage.id) ?? [];
            const tourAnchor = STAGE_TOUR_ANCHORS[stageIndex];
            return (
              // biome-ignore lint/a11y/noStaticElementInteractions: kanban column is a drag-and-drop drop target
              // biome-ignore lint/a11y/noNoninteractiveElementInteractions: kanban column is a drag-and-drop drop target
              <section
                className={cx("kb-col", dragOver === stage.id && "over")}
                data-tour={tourAnchor}
                key={stage.id}
                onDragLeave={() => setDragOver(null)}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(stage.id);
                }}
                onDrop={() => handleDrop(stage.id)}
              >
                <div className="kb-head">
                  <span className="kb-dot" style={{ background: stage.tint }} />
                  <span className="kb-name">{stage.label}</span>
                  <span className="kb-count">{cards.length}</span>
                </div>
                <p className="kb-sub">{stage.subtitle}</p>
                <div className="kb-cards">
                  {cards.map((candidate) => (
                    <CandidateCard
                      candidate={candidate}
                      key={candidate.id}
                      onDragStart={setDraggingId}
                      onToggleSelect={toggleSelect}
                      selected={selectedIds.has(candidate.id)}
                    />
                  ))}
                  {cards.length === 0 ? (
                    <div className="kb-empty">No candidates</div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <ListView
          candidates={filtered}
          onToggleAll={toggleAll}
          onToggleSelect={toggleSelect}
          selectedIds={selectedIds}
        />
      )}

      <BulkActionBar
        onClear={() => setSelectedIds(new Set())}
        onMoveStage={bulkMove}
        selectedIds={Array.from(selectedIds)}
      />

      {toast ? <div className="pl-toast">{toast}</div> : null}
    </div>
  );
}
