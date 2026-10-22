import type { BenefitDisplayState } from "@repo/shared/utils/benefit-visibility";
import { useTranslations } from "next-intl";
import { STUDIO } from "../../_components/studio";

const QUIET = { background: STUDIO.paper2, color: STUDIO.ink3 };
const LAPSED = { background: "#f6ecd8", color: "#8a6420" };

/** Each pair keeps at least 4.5:1 contrast for the small label. */
const PILL_COLORS: Record<
  BenefitDisplayState,
  { background: string; color: string }
> = {
  draft: QUIET,
  ended: LAPSED,
  expired: LAPSED,
  hidden: QUIET,
  scheduled: { background: "#e8edf5", color: STUDIO.sky },
  visible: { background: "#e6efe7", color: STUDIO.leaf },
};

/** Whether students see a benefit, in words a committee member uses. */
export function BenefitStatePill({ state }: { state: BenefitDisplayState }) {
  const t = useTranslations("adminPortal.benefits.states");
  return (
    <span
      className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 font-semibold text-[11px] leading-5"
      style={PILL_COLORS[state]}
    >
      {t(state)}
    </span>
  );
}
