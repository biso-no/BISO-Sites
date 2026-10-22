"use client";

import Link from "next/link";
import { rememberBenefitBoardCampus } from "../../_actions/benefit-board-prefs";
import { STUDIO } from "../../_components/studio";
import { BOARD_FOCUS_RING_INSET } from "../_lib/board-styles";

export interface BoardCampusTab {
  id: string;
  label: string;
}

/**
 * One link per campus the viewer can see. Opening a tab also remembers it,
 * so the board opens there next time.
 */
export function BenefitCampusTabs({
  current,
  label,
  tabs,
}: {
  current: string;
  label: string;
  tabs: BoardCampusTab[];
}) {
  const remember = (campusId: string) => {
    rememberBenefitBoardCampus(campusId).catch(() => {
      // Only a convenience: the tab opens either way.
    });
  };

  return (
    <nav
      aria-label={label}
      className="mb-7 border-b"
      style={{ borderColor: STUDIO.rule }}
    >
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const active = tab.id === current;
          return (
            <li className="shrink-0" key={tab.id}>
              <Link
                aria-current={active ? "page" : undefined}
                className={`inline-flex rounded-t-md border-b-2 px-4 py-2.5 text-[15px] transition-colors ${
                  active
                    ? "font-semibold text-[#1a1814]"
                    : "border-transparent text-[#6b6357] hover:border-[#d8cdb6] hover:text-[#1a1814]"
                } ${BOARD_FOCUS_RING_INSET}`}
                href={`/benefits?${new URLSearchParams({ campus: tab.id })}`}
                onClick={() => remember(tab.id)}
                style={active ? { borderColor: STUDIO.gold } : undefined}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
