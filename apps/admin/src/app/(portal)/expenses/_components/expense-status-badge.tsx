import { useTranslations } from "next-intl";
import { MONO_STACK, STUDIO } from "../../_components/studio";

const TONES: Record<string, { bg: string; border: string; color: string }> = {
  approved: {
    bg: "rgba(47,93,58,0.09)",
    border: "rgba(47,93,58,0.24)",
    color: STUDIO.leaf,
  },
  failed: {
    bg: "rgba(107,30,30,0.09)",
    border: "rgba(107,30,30,0.24)",
    color: STUDIO.claret,
  },
  pending: {
    bg: "rgba(176,138,62,0.09)",
    border: "rgba(176,138,62,0.24)",
    color: "#6a5118",
  },
  rejected: {
    bg: "rgba(107,30,30,0.09)",
    border: "rgba(107,30,30,0.24)",
    color: STUDIO.claret,
  },
  submitted: {
    bg: "rgba(42,74,122,0.09)",
    border: "rgba(42,74,122,0.24)",
    color: STUDIO.sky,
  },
  success: {
    bg: "rgba(47,93,58,0.09)",
    border: "rgba(47,93,58,0.24)",
    color: STUDIO.leaf,
  },
};

const NEUTRAL = { bg: STUDIO.paper2, border: STUDIO.rule2, color: STUDIO.ink3 };

export function ExpenseStatusBadge({ status }: { status: string }) {
  const t = useTranslations("adminPortal.expenses.status");
  const tone = TONES[status] ?? NEUTRAL;
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 font-medium text-[11px] uppercase tracking-[0.05em]"
      style={{
        background: tone.bg,
        borderColor: tone.border,
        color: tone.color,
        fontFamily: MONO_STACK,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: tone.color }}
      />
      {TONES[status] ? t(status) : status}
    </span>
  );
}
