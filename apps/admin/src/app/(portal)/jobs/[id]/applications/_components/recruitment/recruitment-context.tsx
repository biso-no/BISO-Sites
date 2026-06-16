"use client";

import { createContext, type ReactNode, useContext } from "react";
import type {
  WorkspaceCandidate,
  WorkspaceJob,
  WorkspacePanelMember,
} from "./view-model";

export type EmailIntent = "shortlist" | "schedule" | "reject" | "offer";

export interface RecruitmentActions {
  openAdvance: (candidate: WorkspaceCandidate) => void;
  openAI: () => void;
  openCandidate: (id: string) => void;
  openCompare: (ids: string[]) => void;
  openEmail: (ids: string[], intent?: EmailIntent) => void;
  openSchedule: (candidate: WorkspaceCandidate) => void;
  openScorecard: (candidate: WorkspaceCandidate, round?: number) => void;
}

export interface RecruitmentContextValue {
  actions: RecruitmentActions;
  addToCompare: (id: string) => void;
  allowOtherCampusPanel: boolean;
  candidates: WorkspaceCandidate[];
  clearCompare: () => void;
  compareIds: string[];
  currentUserId: string;
  job: WorkspaceJob;
  jobId: string;
  panel: WorkspacePanelMember[];
  removeFromCompare: (id: string) => void;
  updateCandidate: (id: string, patch: Partial<WorkspaceCandidate>) => void;
}

const RecruitmentContext = createContext<RecruitmentContextValue | null>(null);

export function RecruitmentProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: RecruitmentContextValue;
}) {
  return (
    <RecruitmentContext.Provider value={value}>
      {children}
    </RecruitmentContext.Provider>
  );
}

export function useRecruitment(): RecruitmentContextValue {
  const ctx = useContext(RecruitmentContext);
  if (!ctx) {
    throw new Error("useRecruitment must be used within RecruitmentProvider");
  }
  return ctx;
}

export function candidateById(
  candidates: WorkspaceCandidate[],
  id: string | null
): WorkspaceCandidate | null {
  if (!id) {
    return null;
  }
  return candidates.find((candidate) => candidate.id === id) ?? null;
}
