import type { ReactNode } from "react";
import { STUDIO } from "../../../../_components/studio";

/** The portal's field look; plain elements, so the caret can be read. */
export const FIELD_CLASS =
  "w-full rounded-lg border-[0.5px] border-[#d8cdb6] bg-white/60 px-3 py-2.5 text-[#1a1814] text-sm outline-none transition-all focus:border-[#6b1e1e]";

export const LABEL_CLASS =
  "font-medium text-[11px] text-[#6b6357] uppercase tracking-[0.06em]";

/** Important messages are shown in red (spec D6). */
export const IMPORTANT_RED = "#b91c1c";

/** A rounded on/off choice: campuses, groups, the trip, now or later. */
export function Pill({
  active,
  children,
  disabled,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className="rounded-full px-3 py-1.5 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      style={{
        background: active ? STUDIO.ink : "rgba(255,255,255,0.7)",
        border: `0.5px solid ${active ? STUDIO.ink : STUDIO.rule2}`,
        color: active ? STUDIO.paper : STUDIO.ink2,
      }}
      type="button"
    >
      {children}
    </button>
  );
}
