import { StudioStatusPill } from "./studio";

interface StatusBadgeProps {
  size?: "sm" | "md";
  status: string;
}

const STATUS_STYLES: Record<
  string,
  { color: string; bg: string; border: string; label: string }
> = {
  published: {
    color: "#4ade80",
    bg: "rgba(74,222,128,0.10)",
    border: "rgba(74,222,128,0.25)",
    label: "Published",
  },
  draft: {
    color: "rgba(255,255,255,0.50)",
    bg: "rgba(255,255,255,0.05)",
    border: "rgba(255,255,255,0.10)",
    label: "Draft",
  },
  archived: {
    color: "rgba(255,255,255,0.35)",
    bg: "rgba(255,255,255,0.04)",
    border: "rgba(255,255,255,0.08)",
    label: "Archived",
  },
  review: {
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.10)",
    border: "rgba(251,191,36,0.25)",
    label: "In Review",
  },
  closed: {
    color: "#f87171",
    bg: "rgba(248,113,113,0.10)",
    border: "rgba(248,113,113,0.25)",
    label: "Closed",
  },
  cancelled: {
    color: "#f87171",
    bg: "rgba(248,113,113,0.10)",
    border: "rgba(248,113,113,0.25)",
    label: "Cancelled",
  },
  pending: {
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.10)",
    border: "rgba(251,191,36,0.25)",
    label: "Pending",
  },
  pending_approval: {
    color: "#fb923c",
    bg: "rgba(251,146,60,0.10)",
    border: "rgba(251,146,60,0.25)",
    label: "Pending Approval",
  },
  submitted: {
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.10)",
    border: "rgba(251,191,36,0.25)",
    label: "Submitted",
  },
  reviewed: {
    color: "#60a5fa",
    bg: "rgba(96,165,250,0.10)",
    border: "rgba(96,165,250,0.25)",
    label: "Reviewed",
  },
  interview: {
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.10)",
    border: "rgba(167,139,250,0.25)",
    label: "Interview",
  },
  accepted: {
    color: "#4ade80",
    bg: "rgba(74,222,128,0.10)",
    border: "rgba(74,222,128,0.25)",
    label: "Accepted",
  },
  rejected: {
    color: "#f87171",
    bg: "rgba(248,113,113,0.10)",
    border: "rgba(248,113,113,0.25)",
    label: "Rejected",
  },
};

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? {
    color: "",
    bg: "",
    border: "",
    label: status,
  };

  return <StudioStatusPill label={style.label} size={size} status={status} />;
}
