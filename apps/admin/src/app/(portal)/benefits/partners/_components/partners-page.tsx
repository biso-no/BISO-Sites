"use client";

import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ReactNode, useMemo, useRef, useState } from "react";
import type { PartnerWithDeals } from "../../../_actions/benefit-partners";
import {
  STUDIO,
  StudioButton,
  StudioPageHeader,
} from "../../../_components/studio";
import { Pill } from "../../../communications/_components/composer/ui";
import type { AdminLocale } from "../../_lib/board-display";
import {
  BOARD_FOCUS_RING,
  BOARD_FOCUS_RING_INSET,
} from "../../_lib/board-styles";
import {
  ALL_CAMPUSES,
  buildPartnerCards,
  type EmptyPartnersReason,
  emptyPartnersReason,
  type PartnerCard,
  type PartnerFilter,
  parsePartnerFilter,
} from "../_lib/partners-state";
import { PartnerCardView } from "./partner-card";
import { PartnerSheet } from "./partner-sheet";

export type PartnersTab = "deals" | "logos";

const PARTNERS_PATH = "/benefits/partners";

const TAB_HREF: Record<PartnersTab, string> = {
  deals: PARTNERS_PATH,
  logos: `${PARTNERS_PATH}?tab=logos`,
};

export interface DealPartnersProps {
  /** Every campus's name, Hele BISO included. */
  campusLabels: Record<string, string>;
  /** In tab order. */
  editableCampusIds: string[];
  /** From the address, so a reload or a shared link opens the same view. */
  filter: PartnerFilter;
  locale: AdminLocale;
  /** The page's clock (ISO), so states agree between server and browser. */
  now: string;
  partners: PartnerWithDeals[];
  /** In tab order, Hele BISO last. */
  visibleCampusIds: string[];
}

export interface PartnersPageProps {
  deals: DealPartnersProps;
  tab: PartnersTab;
}

/** `/benefits/partners`: the companies behind student deals, and the logos. */
export function PartnersPage({ deals }: PartnersPageProps) {
  // The website logos tab is not built yet, so every tab shows the deal
  // partners; its link is already in the header.
  return <DealPartners {...deals} />;
}

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

/**
 * Keeps the address in step with the chips without asking the server again;
 * Next.js reads a `replaceState` like its own navigation.
 */
function rememberFilter(filter: PartnerFilter) {
  const params = new URLSearchParams();
  if (filter.campusId !== ALL_CAMPUSES) {
    params.set("campus", filter.campusId);
  }
  if (filter.showEnded) {
    params.set("ended", "1");
  }
  const query = params.toString();
  window.history.replaceState(
    null,
    "",
    query ? `${PARTNERS_PATH}?${query}` : PARTNERS_PATH
  );
}

const filterKey = (filter: PartnerFilter): string =>
  `${filter.campusId}|${filter.showEnded}`;

/** Said in place of the cards, matched to why there are none. */
function EmptyPartners({ reason }: { reason: EmptyPartnersReason }) {
  const t = useTranslations("adminPortal.benefits.partnersPage");
  const tBoard = useTranslations("adminPortal.benefits.board");
  const messages: Record<EmptyPartnersReason, string> = {
    noAccess: tBoard("emptySectionReadOnly"),
    noneYet: t("emptyDeals"),
    onlyEnded: t("emptyOnlyEnded"),
    readOnly: t("readOnly"),
  };
  return (
    <p
      className="rounded-xl border border-dashed px-5 py-5 text-sm leading-6"
      style={{
        background: "rgba(255,255,255,0.32)",
        borderColor: STUDIO.rule2,
        color: STUDIO.ink3,
      }}
    >
      {messages[reason]}
    </p>
  );
}

interface SheetState {
  /** The partner as it was when the sheet opened; null for a new one. */
  card: PartnerCard | null;
  open: boolean;
  /** A fresh form each time the sheet opens. */
  version: number;
}

/** Tilbudspartnere: a card per partner, filtered by campus, and its sheet. */
function DealPartners({
  campusLabels,
  editableCampusIds,
  filter: initialFilter,
  locale,
  now: nowIso,
  partners,
  visibleCampusIds,
}: DealPartnersProps) {
  const t = useTranslations("adminPortal.benefits.partnersPage");
  const searchParams = useSearchParams();
  const urlFilter = parsePartnerFilter(
    { campus: searchParams.get("campus"), ended: searchParams.get("ended") },
    visibleCampusIds
  );
  const [filter, setFilter] = useState(initialFilter);
  const [seenUrl, setSeenUrl] = useState(() => filterKey(urlFilter));
  if (filterKey(urlFilter) !== seenUrl) {
    // The address changed without the chips (a tab or another link): the
    // chips follow it, so what they show always matches the address.
    setSeenUrl(filterKey(urlFilter));
    setFilter(urlFilter);
  }
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const cards = useMemo(
    () => buildPartnerCards(partners, filter, now),
    [partners, filter, now]
  );
  const canCreate = editableCampusIds.length > 0;
  // Under a campus the viewer cannot change, a new partner would land
  // elsewhere, so that view does not offer one.
  const canCreateHere =
    canCreate &&
    (filter.campusId === ALL_CAMPUSES ||
      editableCampusIds.includes(filter.campusId));
  const campusLabel = (campusId: string): string =>
    campusLabels[campusId] ?? "";
  const newPartnerCampus =
    filter.campusId !== ALL_CAMPUSES &&
    editableCampusIds.includes(filter.campusId)
      ? filter.campusId
      : (editableCampusIds[0] ?? "");

  const changeFilter = (next: PartnerFilter) => {
    setFilter(next);
    rememberFilter(next);
  };

  const openSheet = (card: PartnerCard | null) => {
    const active = document.activeElement;
    opener.current = active instanceof HTMLElement ? active : null;
    setSheet((current) => ({
      card,
      open: true,
      version: (current?.version ?? 0) + 1,
    }));
  };

  const newPartnerButton = canCreate ? (
    <StudioButton
      className={BOARD_FOCUS_RING}
      onClick={() => openSheet(null)}
      variant="accent"
    >
      {t("newPartner")}
    </StudioButton>
  ) : null;

  return (
    <div className="pb-16">
      <PartnersPageHeader action={newPartnerButton} tab="deals" />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <fieldset className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0">
          <legend className="sr-only">{t("campus")}</legend>
          <Pill
            active={filter.campusId === ALL_CAMPUSES}
            className={BOARD_FOCUS_RING}
            onClick={() => changeFilter({ ...filter, campusId: ALL_CAMPUSES })}
          >
            {t("filterAll")}
          </Pill>
          {visibleCampusIds.map((campusId) => (
            <Pill
              active={filter.campusId === campusId}
              className={BOARD_FOCUS_RING}
              key={campusId}
              onClick={() => changeFilter({ ...filter, campusId })}
            >
              {campusLabel(campusId)}
            </Pill>
          ))}
        </fieldset>
        <span aria-hidden className="flex-1" />
        <Pill
          active={filter.showEnded}
          className={BOARD_FOCUS_RING}
          onClick={() =>
            changeFilter({ ...filter, showEnded: !filter.showEnded })
          }
        >
          {t("showEnded")}
        </Pill>
      </div>

      {cards.length === 0 ? (
        <EmptyPartners
          reason={emptyPartnersReason(partners, filter, editableCampusIds)}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <PartnerCardView
              campusLabel={campusLabel}
              card={card}
              key={card.partner.id}
              locale={locale}
              onOpen={() => openSheet(card)}
              visibleCampusIds={visibleCampusIds}
            />
          ))}
          {canCreateHere ? (
            <li className="h-full">
              <button
                className={`flex h-full min-h-[9.5rem] w-full flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] border-dashed font-medium text-sm transition-colors hover:border-[#d8cdb6] hover:bg-[rgba(255,255,255,0.5)] ${BOARD_FOCUS_RING}`}
                onClick={() => openSheet(null)}
                style={{ borderColor: STUDIO.rule, color: STUDIO.ink3 }}
                type="button"
              >
                <Plus aria-hidden size={22} />
                {t("partnerPanelNew")}
              </button>
            </li>
          ) : null}
        </ul>
      )}

      {sheet ? (
        <PartnerSheet
          campusLabel={campusLabel}
          card={sheet.card}
          defaultCampusId={newPartnerCampus}
          editableCampusIds={editableCampusIds}
          key={sheet.version}
          locale={locale}
          onClose={() =>
            setSheet((current) => current && { ...current, open: false })
          }
          onCloseAutoFocus={(event) => {
            // Back to the button that opened it, if that is still there.
            if (opener.current?.isConnected) {
              event.preventDefault();
              opener.current.focus();
            }
          }}
          open={sheet.open}
        />
      ) : null}
    </div>
  );
}
