"use client";

import {
  CalendarClock,
  Eye,
  GripVertical,
  Lock,
  PencilLine,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useMemo } from "react";
import type { BenefitAccess } from "@/lib/benefit-access";
import type { BenefitBoardData } from "../../_actions/benefits";
import { STUDIO, StudioKpi, StudioKpiStrip } from "../../_components/studio";
import { buildBoardSections, canMoveItem, summarizeBoard } from "../_lib/board";
import type { AdminLocale } from "../_lib/board-display";
import { BenefitBoardSection } from "./benefit-board-section";

export interface BenefitBoardProps {
  access: BenefitAccess;
  data: BenefitBoardData;
  locale: AdminLocale;
  /** The page's clock (ISO), so states agree between server and browser. */
  now: string;
  /** The side panel for the item being opened or created, if any. */
  open?: ReactNode;
}

/**
 * One campus tab: the summary, then every website section in order. A tab
 * the viewer cannot edit shows the same board without add links or dragging.
 */
export function BenefitBoard({
  access,
  data,
  locale,
  now: nowIso,
  open,
}: BenefitBoardProps) {
  const t = useTranslations("adminPortal.benefits.board");
  // One clock for the whole board, so states and the summary agree.
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const editable =
    data.editable && access.editableCampusIds.includes(data.campusId);

  const sections = useMemo(
    () => buildBoardSections(data.benefits, data.partners, data.campusId, now),
    [data.benefits, data.partners, data.campusId, now]
  );
  const summary = useMemo(() => summarizeBoard(sections, now), [sections, now]);
  const canReorderAny =
    editable &&
    sections.some((section) => section.own.filter(canMoveItem).length > 1);

  return (
    <>
      <StudioKpiStrip columns={3}>
        <StudioKpi
          icon={<Eye aria-hidden size={13} />}
          label={t("kpiVisible")}
          value={summary.visible}
        />
        <StudioKpi
          icon={<PencilLine aria-hidden size={13} />}
          label={t("kpiDrafts")}
          value={summary.drafts}
        />
        <StudioKpi
          alert={summary.endingSoon > 0}
          icon={<CalendarClock aria-hidden size={13} />}
          label={t("kpiEndingSoon")}
          value={summary.endingSoon}
        />
      </StudioKpiStrip>

      {editable ? null : (
        <p
          className="mt-6 flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm leading-6"
          style={{
            background: STUDIO.paper2,
            borderColor: STUDIO.rule2,
            color: STUDIO.ink2,
          }}
        >
          <Lock
            aria-hidden
            className="mt-1 shrink-0"
            size={15}
            style={{ color: STUDIO.ink3 }}
          />
          {t("readOnlyNational")}
        </p>
      )}

      {canReorderAny ? (
        <p
          className="mt-6 flex items-center gap-2 text-sm"
          style={{ color: STUDIO.ink3 }}
        >
          <GripVertical aria-hidden className="shrink-0" size={15} />
          {t("dragHint")}
        </p>
      ) : null}

      <div className="mt-10 space-y-12">
        {sections.map((section) => (
          <BenefitBoardSection
            campusId={data.campusId}
            editable={editable}
            key={section.section}
            locale={locale}
            section={section}
          />
        ))}
      </div>

      {open}
    </>
  );
}
