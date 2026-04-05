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
};

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? {
    color: "rgba(255,255,255,0.50)",
    bg: "rgba(255,255,255,0.05)",
    border: "rgba(255,255,255,0.10)",
    label: status,
  };

  const padding =
    size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium font-mono uppercase tracking-wide ${padding}`}
      style={{
        color: style.color,
        background: style.bg,
        border: `1px solid ${style.border}`,
      }}
    >
      {style.label}
    </span>
  );
}
