"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { STUDIO, StudioPageHeader } from "../../../_components/studio";
import {
  BOARD_FOCUS_RING,
  BOARD_FOCUS_RING_INSET,
} from "../../_lib/board-styles";

export type PartnersTab = "deals" | "logos";

export const PARTNERS_PATH = "/benefits/partners";

const TAB_HREF: Record<PartnersTab, string> = {
  deals: PARTNERS_PATH,
  logos: `${PARTNERS_PATH}?tab=logos`,
};

/** Eyebrow, title, the tab's main action and the two tabs. */
export function PartnersPageHeader({
  action,
  tab,
}: {
  action?: ReactNode;
  tab: PartnersTab;
}) {
  const t = useTranslations("adminPortal.benefits.partnersPage");
  const tabs: { id: PartnersTab; label: string }[] = [
    { id: "deals", label: t("tabDeals") },
    { id: "logos", label: t("tabLogos") },
  ];
  return (
    <>
      <StudioPageHeader
        eyebrow={
          <Link
            className={`-mx-1 inline-flex items-center gap-1.5 rounded-sm px-1 hover:underline ${BOARD_FOCUS_RING}`}
            href="/benefits"
          >
            <ArrowLeft aria-hidden size={12} />
            {t("eyebrow")}
          </Link>
        }
        title={t("title")}
      >
        {action}
      </StudioPageHeader>
      <nav
        aria-label={t("title")}
        className="mb-6 border-b"
        style={{ borderColor: STUDIO.rule }}
      >
        <ul className="-mb-px flex gap-1 overflow-x-auto">
          {tabs.map((item) => {
            const active = item.id === tab;
            return (
              <li className="shrink-0" key={item.id}>
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex rounded-t-md border-b-2 px-4 py-2.5 text-[15px] transition-colors ${
                    active
                      ? "font-semibold text-[#1a1814]"
                      : "border-transparent text-[#6b6357] hover:border-[#d8cdb6] hover:text-[#1a1814]"
                  } ${BOARD_FOCUS_RING_INSET}`}
                  href={TAB_HREF[item.id]}
                  style={active ? { borderColor: STUDIO.gold } : undefined}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
