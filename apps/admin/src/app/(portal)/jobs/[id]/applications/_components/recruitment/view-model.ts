import type {
  JobApplicationsStatus,
  JobInterviewScorecardsRecommendation,
} from "@repo/api/types/appwrite";
import type {
  RecruitmentCustomQuestion,
  RecruitmentScreeningRubric,
} from "@repo/shared/types/recruitment";

// ---------------------------------------------------------------------------
// View-model contracts shared between the server data loader and the client
// recruitment workspace. Everything here must be JSON-serializable so it can
// cross the server -> client boundary.
// ---------------------------------------------------------------------------

export type RecruitmentStageId =
  | "submitted"
  | "reviewed"
  | "interview"
  | "accepted"
  | "rejected";

export interface RecruitmentStageMeta {
  id: RecruitmentStageId;
  label: string;
  subtitle: string;
  tint: string;
}

// Pipeline columns in display order. Labels follow the Claude design.
export const RECRUITMENT_STAGES: RecruitmentStageMeta[] = [
  {
    id: "submitted",
    label: "Applied",
    tint: "#9c9385",
    subtitle: "New applications awaiting first review",
  },
  {
    id: "reviewed",
    label: "Shortlist",
    tint: "#2a4a7a",
    subtitle: "Strong enough to move forward",
  },
  {
    id: "interview",
    label: "Interview",
    tint: "#b08a3e",
    subtitle: "Scheduled or awaiting a panel",
  },
  {
    id: "accepted",
    label: "Offer",
    tint: "#2f5d3a",
    subtitle: "Offer extended",
  },
  {
    id: "rejected",
    label: "Archived",
    tint: "#9c9385",
    subtitle: "Not moving forward this round",
  },
];

export interface RecruitmentDimensionScore {
  name: string;
  reason: string;
  score: number;
}

export interface CandidateInterviewSummary {
  endsAt: string | null;
  id: string;
  meetingUrl: string | null;
  panel: string[];
  round: number;
  startsAt: string | null;
  status: string;
  teams: boolean;
  title: string;
}

export interface CandidateScorecardSummary {
  count: number;
  overall: number | null;
  recommendation: JobInterviewScorecardsRecommendation | null;
}

export interface WorkspaceCandidate {
  appliedAt: string;
  coverLetter: string | null;
  currentRole: string | null;
  days: number;
  dimensions: RecruitmentDimensionScore[];
  email: string;
  gaps: string[];
  id: string;
  interview: CandidateInterviewSummary | null;
  linkedin: string | null;
  member: boolean | null;
  name: string;
  phone: string | null;
  recommendedStatus: string | null;
  resumeFileId: string | null;
  reviewNotes: string | null;
  /** AI match score, 0-100. Null when not yet screened. */
  score: number | null;
  scorecard: CandidateScorecardSummary | null;
  skills: string[];
  source: string | null;
  stage: JobApplicationsStatus;
  starred: boolean;
  strengths: string[];
  summary: string | null;
  year: string | null;
}

export interface WorkspacePanelMember {
  email: string | null;
  id: string;
  name: string;
  role: string;
}

export interface WorkspaceJob {
  audience: "members" | "public" | null;
  autoScreen: boolean;
  campusColor: string;
  campusName: string | null;
  commitment: string | null;
  customQuestions: RecruitmentCustomQuestion[];
  deadline: string | null;
  departmentCrest: string;
  departmentName: string | null;
  id: string;
  publicUrl: string;
  screeningRubric: RecruitmentScreeningRubric;
  slug: string;
  startDate: string | null;
  status: string;
  term: string | null;
  titleEn: string;
  titleNo: string;
}

export interface FunnelStageDatum {
  label: string;
  n: number;
  pct: number;
  stage: RecruitmentStageId;
  tint: string;
}

export interface SourceDatum {
  hires: number;
  label: string;
  n: number;
  pct: number;
  source: string;
  tint: string;
}

export interface StageDaysDatum {
  days: number;
  label: string;
}

export interface RecruitmentAnalytics {
  aboveNinety: number;
  declineRate: number | null;
  funnel: FunnelStageDatum[];
  medianMatch: number | null;
  memberShare: number | null;
  sources: SourceDatum[];
  stageDays: StageDaysDatum[];
  total: number;
  ttfTrend: number[];
}

export interface WorkspaceKpis {
  aiShortlisted: number;
  applicants: number;
  awaitingConfirm: number;
  daysToClose: number | null;
  inPipeline: number;
  interviewsThisWeek: number;
  newToday: number;
  offersOut: number;
}

export interface WorkspaceInterview {
  applicationId: string;
  candidateName: string;
  endsAt: string | null;
  id: string;
  panel: string[];
  round: number;
  startsAt: string | null;
  status: string;
  teams: boolean;
  title: string;
}

export interface PendingScorecard {
  applicationId: string;
  candidateName: string;
  due: boolean;
  interviewId: string;
  round: number;
}

export interface RecruitmentWorkspaceData {
  analytics: RecruitmentAnalytics;
  candidates: WorkspaceCandidate[];
  currentUserId: string;
  interviews: WorkspaceInterview[];
  job: WorkspaceJob;
  kpis: WorkspaceKpis;
  panel: WorkspacePanelMember[];
  pendingScorecards: PendingScorecard[];
}

// ---------------------------------------------------------------------------
// Source registry — maps stored `source` strings onto display labels + tints.
// ---------------------------------------------------------------------------

const SOURCE_REGISTRY: Record<string, { label: string; tint: string }> = {
  biso: { label: "biso.no", tint: "#6b1e1e" },
  "biso.no": { label: "biso.no", tint: "#6b1e1e" },
  web: { label: "biso.no", tint: "#6b1e1e" },
  linkedin: { label: "LinkedIn", tint: "#2a4a7a" },
  referral: { label: "Referral", tint: "#2f5d3a" },
  inbound: { label: "Direct email", tint: "#b08a3e" },
  email: { label: "Direct email", tint: "#b08a3e" },
  campus: { label: "Campus poster", tint: "#29261b" },
};

export function sourceMeta(source: string | null): {
  id: string;
  label: string;
  tint: string;
} {
  const id = (source ?? "biso").toLowerCase();
  const meta = SOURCE_REGISTRY[id] ?? {
    label: source ?? "Direct",
    tint: "#8e8980",
  };
  return { id, label: meta.label, tint: meta.tint };
}

export function stageMeta(id: RecruitmentStageId): RecruitmentStageMeta {
  return (
    RECRUITMENT_STAGES.find((stage) => stage.id === id) ?? RECRUITMENT_STAGES[0]
  );
}

const WHITESPACE_RE = /\s+/;

export function initials(name: string): string {
  return name
    .split(WHITESPACE_RE)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const AVATAR_HUES = [12, 200, 145, 38, 280, 330, 95, 255];

/** Deterministic gradient avatar background derived from the name hash. */
export function avatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 360;
  }
  const base = AVATAR_HUES[Math.abs(hash) % AVATAR_HUES.length];
  const second = (base + 38) % 360;
  return `linear-gradient(135deg, oklch(0.72 0.09 ${base}), oklch(0.6 0.11 ${second}))`;
}

/** Tier colour for the match ring / score chips. */
export function matchTint(score: number | null): string {
  if (score == null) {
    return "#8e8980";
  }
  if (score >= 90) {
    return "#6b1e1e";
  }
  if (score >= 80) {
    return "#2a4a7a";
  }
  if (score >= 70) {
    return "#b08a3e";
  }
  return "#8e8980";
}

export function daysSince(iso: string, now: Date = new Date()): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return 0;
  }
  return Math.max(0, Math.round((now.getTime() - then) / 86_400_000));
}

export function daysUntil(
  iso: string | null,
  now: Date = new Date()
): number | null {
  if (!iso) {
    return null;
  }
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) {
    return null;
  }
  return Math.round((target - now.getTime()) / 86_400_000);
}

export function formatShortDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Join class names, dropping falsy values. Kept out of className template
 * literals so the class sorter never mangles conditional joins. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export const STAGE_OF_STATUS: Record<string, RecruitmentStageId> = {
  submitted: "submitted",
  reviewed: "reviewed",
  interview: "interview",
  accepted: "accepted",
  rejected: "rejected",
};
