"use client";

import {
  BarChart3,
  Briefcase,
  CalendarDays,
  FileText,
  Lock,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./recruitment.css";
import { CandidateDrawer } from "./candidate-drawer";
import { AdvanceStageModal } from "./overlays/advance-stage-modal";
import { AiAssistant } from "./overlays/ai-assistant";
import { BulkEmailComposer } from "./overlays/bulk-email-composer";
import { CompareView } from "./overlays/compare-view";
import { ScheduleModal } from "./overlays/schedule-modal";
import { ScorecardModal } from "./overlays/scorecard-modal";
import { CompareTray } from "./pipeline/compare-tray";
import { Pipeline } from "./pipeline/pipeline";
import { RecruitHeader } from "./recruit-header";
import {
  candidateById,
  type EmailIntent,
  RecruitmentProvider,
} from "./recruitment-context";
import { AnalyticsTab } from "./tabs/analytics-tab";
import { FormRubricTab } from "./tabs/form-rubric-tab";
import { InterviewsTab } from "./tabs/interviews-tab";
import { SettingsTab } from "./tabs/settings-tab";
import {
  cx,
  type RecruitmentWorkspaceData,
  type WorkspaceCandidate,
} from "./view-model";

type TabId = "pipeline" | "interviews" | "analytics" | "form" | "settings";

type Action =
  | { type: "schedule"; candidate: WorkspaceCandidate }
  | { type: "advance"; candidate: WorkspaceCandidate }
  | { type: "scorecard"; candidate: WorkspaceCandidate; round: number }
  | { type: "compare"; ids: string[] }
  | { type: "email"; ids: string[]; intent: EmailIntent }
  | { type: "ai" }
  | null;

export function RecruitShell({ data }: { data: RecruitmentWorkspaceData }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [candidates, setCandidates] = useState<WorkspaceCandidate[]>(
    data.candidates
  );
  const [tab, setTab] = useState<TabId>("pipeline");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [action, setAction] = useState<Action>(null);
  const [drawerId, setDrawerId] = useState<string | null>(
    searchParams.get("candidate")
  );

  const syncDrawerUrl = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) {
        params.set("candidate", id);
      } else {
        params.delete("candidate");
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams]
  );

  const openCandidate = useCallback(
    (id: string) => {
      setDrawerId(id);
      syncDrawerUrl(id);
    },
    [syncDrawerUrl]
  );

  const closeDrawer = useCallback(() => {
    setDrawerId(null);
    syncDrawerUrl(null);
  }, [syncDrawerUrl]);

  const updateCandidate = useCallback(
    (id: string, patch: Partial<WorkspaceCandidate>) => {
      setCandidates((prev) =>
        prev.map((candidate) =>
          candidate.id === id ? { ...candidate, ...patch } : candidate
        )
      );
    },
    []
  );

  const addToCompare = useCallback((id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev : [...prev, id].slice(-3)
    );
  }, []);
  const removeFromCompare = useCallback((id: string) => {
    setCompareIds((prev) => prev.filter((existing) => existing !== id));
  }, []);
  const clearCompare = useCallback(() => setCompareIds([]), []);

  const actions = useMemo(
    () => ({
      openAdvance: (candidate: WorkspaceCandidate) =>
        setAction({ candidate, type: "advance" }),
      openAI: () => setAction({ type: "ai" }),
      openCandidate,
      openCompare: (ids: string[]) => setAction({ ids, type: "compare" }),
      openEmail: (ids: string[], intent: EmailIntent = "shortlist") =>
        setAction({ ids, intent, type: "email" }),
      openSchedule: (candidate: WorkspaceCandidate) =>
        setAction({ candidate, type: "schedule" }),
      openScorecard: (candidate: WorkspaceCandidate, round = 1) =>
        setAction({ candidate, round, type: "scorecard" }),
    }),
    [openCandidate]
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAction(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const closeAction = useCallback(() => setAction(null), []);

  const interviewCount = candidates.filter(
    (candidate) => candidate.stage === "interview"
  ).length;
  const pipelineCount = candidates.filter(
    (candidate) =>
      candidate.stage !== "rejected" && candidate.stage !== "accepted"
  ).length;

  const drawerCandidate = candidateById(candidates, drawerId);

  const TABS: {
    id: TabId;
    label: string;
    icon: typeof Briefcase;
    count?: number;
    ai?: boolean;
  }[] = [
    {
      ai: true,
      count: pipelineCount,
      icon: Briefcase,
      id: "pipeline",
      label: "Pipeline",
    },
    {
      count: interviewCount,
      icon: CalendarDays,
      id: "interviews",
      label: "Interviews",
    },
    { icon: BarChart3, id: "analytics", label: "Funnel & sources" },
    { icon: FileText, id: "form", label: "Form & rubric" },
    { icon: Lock, id: "settings", label: "Access & data" },
  ];

  return (
    <RecruitmentProvider
      value={{
        actions,
        addToCompare,
        candidates,
        clearCompare,
        compareIds,
        currentUserId: data.currentUserId,
        job: data.job,
        jobId: data.job.id,
        panel: data.panel,
        removeFromCompare,
        updateCandidate,
      }}
    >
      <div className="recruit-workspace">
        <div className="recruit-shell">
          <RecruitHeader
            analytics={data.analytics}
            job={data.job}
            kpis={{
              ...data.kpis,
              applicants: candidates.length,
              inPipeline: pipelineCount,
            }}
            onBackToList={() => router.push("/jobs")}
            onEditJob={() => router.push(`/jobs/${data.job.id}`)}
            onOpenAI={actions.openAI}
            onPublicView={() => window.open(data.job.publicUrl, "_blank")}
            onShare={() => {
              navigator.clipboard?.writeText(data.job.publicUrl).catch(() => {
                // clipboard may be unavailable; no-op
              });
            }}
          />

          <div className="rcr-tabs">
            {TABS.map((entry) => {
              const Icon = entry.icon;
              return (
                <button
                  className={cx("rcr-tab", tab === entry.id && "on")}
                  key={entry.id}
                  onClick={() => setTab(entry.id)}
                  type="button"
                >
                  <Icon size={14} /> {entry.label}
                  {typeof entry.count === "number" ? (
                    <span className="count">{entry.count}</span>
                  ) : null}
                  {entry.ai ? (
                    <span className="ai-dot" title="AI ranking active" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="rcr-body">
            {tab === "pipeline" ? <Pipeline /> : null}
            {tab === "interviews" ? (
              <InterviewsTab
                interviews={data.interviews}
                pendingScorecards={data.pendingScorecards}
              />
            ) : null}
            {tab === "analytics" ? (
              <AnalyticsTab analytics={data.analytics} />
            ) : null}
            {tab === "form" ? <FormRubricTab /> : null}
            {tab === "settings" ? <SettingsTab /> : null}
          </div>
        </div>

        {drawerCandidate ? (
          <CandidateDrawer
            candidate={drawerCandidate}
            key={drawerCandidate.id}
            onClose={closeDrawer}
          />
        ) : null}

        {compareIds.length >= 2 ? (
          <CompareTray onOpen={() => actions.openCompare(compareIds)} />
        ) : null}

        {action?.type === "schedule" ? (
          <ScheduleModal candidate={action.candidate} onClose={closeAction} />
        ) : null}
        {action?.type === "advance" ? (
          <AdvanceStageModal
            candidate={action.candidate}
            onClose={closeAction}
          />
        ) : null}
        {action?.type === "scorecard" ? (
          <ScorecardModal
            candidate={action.candidate}
            onClose={closeAction}
            round={action.round}
          />
        ) : null}
        {action?.type === "compare" ? (
          <CompareView ids={action.ids} onClose={closeAction} />
        ) : null}
        {action?.type === "email" ? (
          <BulkEmailComposer
            ids={action.ids}
            intent={action.intent}
            onClose={closeAction}
          />
        ) : null}
        {action?.type === "ai" ? <AiAssistant onClose={closeAction} /> : null}
      </div>
    </RecruitmentProvider>
  );
}
