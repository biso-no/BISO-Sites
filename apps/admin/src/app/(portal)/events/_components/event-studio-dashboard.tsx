"use client";

import type { EventsStatus } from "@repo/api/types/appwrite";
import type { EventRecord } from "@repo/shared/types/events";
import {
  Bell,
  CalendarDays,
  Copy,
  Filter,
  MapPin,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteEvent } from "../../_actions/events";
import { PaginationBar } from "../../_components/pagination-bar";

interface EventStudioDashboardProps {
  initialEvents: EventRecord[];
  labels: {
    all: string;
    cancelled: string;
    compose: string;
    delete: string;
    deleteConfirm: string;
    drafts: string;
    edit: string;
    empty: string;
    emptyDescription: string;
    past: string;
    searchPlaceholder: string;
    upcoming: string;
  };
  page: number;
  total: number;
}

type FilterKey = "all" | "cancelled" | "drafts" | "past" | "upcoming";

const BRAND = {
  claret: "#6b1e1e",
  gold: "#b08a3e",
  ink: "#1a1814",
  ink2: "#3a342a",
  ink3: "#6b6357",
  ink4: "#9c9385",
  leaf: "#2f5d3a",
  paper: "#faf7f2",
  paper2: "#f3eee5",
  paper3: "#ede6d8",
  rule: "#e5dcca",
  rule2: "#d8cdb6",
  sky: "#2a4a7a",
} as const;

const SERIF_STACK =
  '"Cormorant Garamond", "EB Garamond", "Times New Roman", Georgia, serif';
const MONO_STACK =
  '"IBM Plex Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

const NOK_FORMATTER = new Intl.NumberFormat("nb-NO", {
  currency: "NOK",
  maximumFractionDigits: 0,
  style: "currency",
});

function normalizeLocale(locale: string): "en" | "no" {
  return locale === "no" ? "no" : "en";
}

function formatterLocale(locale: "en" | "no"): string {
  return locale === "no" ? "nb-NO" : "en-GB";
}

function getTitle(event: EventRecord, locale: "en" | "no"): string {
  return (
    event.translation_refs.find((translation) => translation.locale === locale)
      ?.title ??
    event.translation_refs[0]?.title ??
    ""
  );
}

function getDescription(event: EventRecord, locale: "en" | "no"): string {
  return (
    event.translation_refs.find((translation) => translation.locale === locale)
      ?.description ??
    event.translation_refs[0]?.description ??
    ""
  );
}

function fmtDate(
  iso: string | null | undefined,
  locale: "en" | "no",
  labels: { invalid: string; tbd: string }
): string {
  if (!iso) {
    return labels.tbd;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return labels.invalid;
  }
  return new Intl.DateTimeFormat(formatterLocale(locale), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function fmtTime(iso: string | null | undefined, locale: "en" | "no"): string {
  if (!iso) {
    return "—";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat(formatterLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function fmtDay(iso: string | null | undefined, locale: "en" | "no"): string {
  if (!iso) {
    return "—";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat(formatterLocale(locale), {
    weekday: "short",
  }).format(d);
}

function fmtMonth(iso: string, locale: "en" | "no"): string {
  return new Intl.DateTimeFormat(formatterLocale(locale), { month: "short" })
    .format(new Date(iso))
    .toUpperCase();
}

function fmtDayNum(iso: string, locale: "en" | "no"): string {
  return new Intl.DateTimeFormat(formatterLocale(locale), {
    day: "numeric",
  }).format(new Date(iso));
}

function durationHrs(
  start: string | null | undefined,
  end: string | null | undefined
): string {
  if (!(start && end)) {
    return "—";
  }
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (Number.isNaN(diff) || diff <= 0) {
    return "—";
  }
  const hrs = diff / 3_600_000;
  if (hrs < 1) {
    return `${Math.round(diff / 60_000)}m`;
  }
  return `${hrs.toFixed(1).replace(".0", "")}h`;
}

function fmtNOK(amount: number | null | undefined, freeLabel: string): string {
  if (amount == null || amount === 0) {
    return freeLabel;
  }
  return NOK_FORMATTER.format(amount);
}

function isUpcoming(event: EventRecord, now: number): boolean {
  if (event.status !== "published") {
    return false;
  }
  if (!event.start_date) {
    return true;
  }
  const t = new Date(event.start_date).getTime();
  return Number.isNaN(t) ? false : t >= now;
}

function isPast(event: EventRecord, now: number): boolean {
  if (event.status === "draft") {
    return false;
  }
  if (!event.start_date) {
    return false;
  }
  const t = new Date(event.start_date).getTime();
  return Number.isNaN(t) ? false : t < now;
}

function matchesEventFilter(
  event: EventRecord,
  filter: FilterKey,
  now: number
): boolean {
  if (filter === "upcoming") {
    return isUpcoming(event, now);
  }
  if (filter === "drafts") {
    return event.status === "draft";
  }
  if (filter === "past") {
    return isPast(event, now);
  }
  if (filter === "cancelled") {
    return event.status === "cancelled";
  }
  return true;
}

function buildEventHaystack(event: EventRecord): string {
  return [
    getTitle(event, "en"),
    getTitle(event, "no"),
    event.slug ?? "",
    event.location ?? "",
    event.campus?.name ?? "",
    event.department?.Name ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function EvSpark({
  color = "currentColor",
  data,
}: {
  color?: string;
  data: number[];
}) {
  if (data.length < 2) {
    return null;
  }
  const max = Math.max(...data, 1);
  const w = 64;
  const h = 22;
  const step = w / (data.length - 1);
  const points = data
    .map((v, i) => `${i * step},${h - (v / max) * h}`)
    .join(" ");
  return (
    <svg
      aria-hidden="true"
      preserveAspectRatio="none"
      style={{
        bottom: 18,
        height: 22,
        opacity: 0.55,
        position: "absolute",
        right: 18,
        width: 64,
      }}
      viewBox={`0 0 ${w} ${h}`}
    >
      <polyline
        fill="none"
        points={points}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.25"
      />
    </svg>
  );
}

function KpiCard({
  alert,
  delta,
  icon,
  label,
  spark,
  value,
}: {
  alert?: boolean;
  delta?: string;
  icon?: React.ReactNode;
  label: string;
  spark?: number[];
  value: string;
}) {
  return (
    <div
      style={{
        borderRight: `0.5px solid ${BRAND.rule}`,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "18px 22px",
        position: "relative",
      }}
    >
      <div
        style={{
          alignItems: "center",
          color: BRAND.ink3,
          display: "flex",
          fontSize: 11.5,
          gap: 6,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {icon}
        {label}
      </div>
      <div
        style={{
          color: alert ? BRAND.claret : BRAND.ink,
          fontFamily: SERIF_STACK,
          fontSize: 42,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {delta && (
        <div
          style={{
            color: alert ? BRAND.claret : BRAND.leaf,
            fontFamily: MONO_STACK,
            fontSize: 11.5,
          }}
        >
          {delta}
        </div>
      )}
      {spark && (
        <EvSpark color={alert ? BRAND.claret : BRAND.ink3} data={spark} />
      )}
    </div>
  );
}

function DateBlock({ iso }: { iso: string | null | undefined }) {
  const locale = normalizeLocale(useLocale());
  const t = useTranslations("adminPortal.events.studio");
  const isTbd = !iso;
  const containerStyle: React.CSSProperties = {
    alignItems: "center",
    background: BRAND.paper,
    border: `0.5px solid ${BRAND.rule2}`,
    borderRadius: 10,
    display: "flex",
    flexDirection: "column",
    fontFamily: SERIF_STACK,
    justifyContent: "center",
    minHeight: 60,
    overflow: "hidden",
    position: "relative",
    width: 56,
  };
  return (
    <div style={containerStyle}>
      <div
        style={{
          background: isTbd ? BRAND.ink4 : BRAND.claret,
          color: BRAND.paper,
          fontFamily: "inherit",
          fontSize: 9.5,
          letterSpacing: "0.08em",
          padding: "2px 0",
          textAlign: "center",
          textTransform: "uppercase",
          width: "100%",
        }}
      >
        {isTbd ? t("fallback.tbd") : fmtMonth(iso as string, locale)}
      </div>
      <div
        style={
          isTbd
            ? {
                color: BRAND.ink3,
                fontSize: 14,
                fontStyle: "italic",
                lineHeight: 1,
                padding: "8px 0",
              }
            : {
                fontSize: 26,
                letterSpacing: "-0.02em",
                lineHeight: 1,
                padding: "4px 0 6px",
              }
        }
      >
        {isTbd ? "—" : fmtDayNum(iso as string, locale)}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: EventsStatus }) {
  const commonStatus = useTranslations("adminPortal.common.status");
  const statusKey = String(status);
  let color: string = BRAND.ink3;
  let background: string = BRAND.paper2;
  let borderColor: string = BRAND.rule2;
  let pulse: string = BRAND.ink4;
  let extraStyle: React.CSSProperties = {};
  if (statusKey === "published") {
    color = BRAND.leaf;
    background = "rgba(47,93,58,.06)";
    borderColor = "rgba(47,93,58,.18)";
    pulse = BRAND.leaf;
  } else if (statusKey === "draft") {
    color = "#6a5118";
    background = "rgba(176,138,62,.08)";
    borderColor = "rgba(176,138,62,.22)";
    pulse = BRAND.gold;
  } else if (statusKey === "cancelled") {
    color = BRAND.claret;
    background = "rgba(107,30,30,.06)";
    borderColor = "rgba(107,30,30,.2)";
    pulse = BRAND.claret;
    extraStyle = { textDecoration: "line-through" };
  }
  return (
    <span
      style={{
        alignItems: "center",
        background,
        border: `0.5px solid ${borderColor}`,
        borderRadius: 999,
        color,
        display: "inline-flex",
        fontSize: 11.5,
        gap: 6,
        padding: "3px 9px",
        textTransform: "capitalize",
        ...extraStyle,
      }}
    >
      <span
        style={{
          background: pulse,
          borderRadius: "50%",
          height: 6,
          width: 6,
        }}
      />
      {commonStatus(statusKey)}
    </span>
  );
}

function getDraftCompletion(event: EventRecord): {
  complete: number;
  filled: number;
  total: number;
} {
  const titleEn = getTitle(event, "en");
  const titleNo = getTitle(event, "no");
  const description = getDescription(event, "en");
  const checks = [
    Boolean(titleEn),
    Boolean(titleNo),
    Boolean(description && description.trim().length > 0),
    Boolean(event.category),
    Boolean(event.start_date),
    Boolean(event.location),
    event.capacity > 0,
  ];
  const filled = checks.filter(Boolean).length;
  const total = checks.length;
  return { complete: filled / total, filled, total };
}

function pickFeaturedDraft(events: EventRecord[]): EventRecord | null {
  const drafts = events.filter((event) => event.status === "draft");
  if (drafts.length === 0) {
    return null;
  }
  let best = drafts[0];
  let bestFilled = -1;
  for (const draft of drafts) {
    const { filled } = getDraftCompletion(draft);
    if (filled > bestFilled) {
      bestFilled = filled;
      best = draft;
    }
  }
  return best;
}

function FeaturedEventDraft({ events }: { events: EventRecord[] }) {
  const locale = normalizeLocale(useLocale());
  const t = useTranslations("adminPortal.events.studio");
  const draft = useMemo(() => pickFeaturedDraft(events), [events]);
  if (!draft) {
    return null;
  }

  const titleEn = getTitle(draft, locale);
  const { complete, filled, total } = getDraftCompletion(draft);
  const percent = Math.round(complete * 100);
  const fieldsLeft = total - filled;

  const titleDone = Boolean(titleEn && draft.category);
  const descriptionDone = Boolean(
    getDescription(draft, locale).trim().length > 0
  );
  const dateDone = Boolean(draft.start_date);
  const venueDone = Boolean(draft.location) && draft.capacity > 0;
  const ticketsDone = Boolean(draft.price != null || draft.ticket_url);

  const checklist: { done: boolean; label: string; now: boolean }[] = [
    { done: titleDone, label: t("checklist.titleCategory"), now: !titleDone },
    {
      done: descriptionDone,
      label: t("checklist.descriptionBoth"),
      now: titleDone && !descriptionDone,
    },
    {
      done: dateDone,
      label: t("checklist.dateTimeDoors"),
      now: descriptionDone && !dateDone,
    },
    {
      done: venueDone,
      label: t("checklist.venueCapacity"),
      now: dateDone && !venueDone,
    },
    {
      done: ticketsDone,
      label: t("checklist.ticketsAudience"),
      now: venueDone && !ticketsDone,
    },
  ];

  return (
    <section
      style={{
        background: "linear-gradient(180deg, #f8f3e8, #f0e8d4)",
        border: `0.5px solid ${BRAND.rule}`,
        borderRadius: 16,
        color: BRAND.ink,
        display: "grid",
        gridTemplateColumns: "1.1fr 1fr",
        margin: "0 0 18px",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "26px 28px",
        }}
      >
        <div
          style={{
            alignItems: "center",
            color: BRAND.claret,
            display: "flex",
            fontSize: 11,
            fontWeight: 500,
            gap: 8,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              alignItems: "center",
              color: BRAND.claret,
              display: "grid",
              height: 16,
              justifyItems: "center",
              width: 16,
            }}
          >
            <Sparkles size={12} />
          </span>
          {t("featured.eyebrow")}
        </div>
        <h2
          style={{
            fontFamily: SERIF_STACK,
            fontSize: 38,
            fontWeight: 400,
            letterSpacing: "-0.015em",
            lineHeight: 1,
            margin: "4px 0 6px",
          }}
        >
          {titleEn}{" "}
          <em style={{ color: BRAND.claret, fontStyle: "italic" }}>
            {fieldsLeft === 0
              ? t("featured.readyToPublish")
              : t("featured.fieldsAway", { count: fieldsLeft })}
          </em>
        </h2>
        <p
          style={{
            color: BRAND.ink2,
            fontSize: 13.5,
            margin: 0,
            maxWidth: "38ch",
          }}
        >
          {t("featured.description")}
        </p>
        <div style={{ display: "flex", gap: 22, marginTop: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <b
              style={{
                fontFamily: SERIF_STACK,
                fontSize: 26,
                letterSpacing: "-0.01em",
                lineHeight: 1,
              }}
            >
              {percent}%
            </b>
            <span
              style={{
                color: BRAND.ink3,
                fontSize: 11,
                letterSpacing: "0.03em",
                textTransform: "uppercase",
              }}
            >
              {t("featured.complete")}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <b
              style={{
                fontFamily: SERIF_STACK,
                fontSize: 26,
                letterSpacing: "-0.01em",
                lineHeight: 1,
              }}
            >
              {fieldsLeft}
            </b>
            <span
              style={{
                color: BRAND.ink3,
                fontSize: 11,
                letterSpacing: "0.03em",
                textTransform: "uppercase",
              }}
            >
              {t("featured.requiredFields")}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <b
              style={{
                fontFamily: SERIF_STACK,
                fontSize: 26,
                letterSpacing: "-0.01em",
                lineHeight: 1,
              }}
            >
              {fmtDate(draft.start_date, locale, {
                invalid: t("fallback.invalidDate"),
                tbd: t("fallback.tbd"),
              })}
            </b>
            <span
              style={{
                color: BRAND.ink3,
                fontSize: 11,
                letterSpacing: "0.03em",
                textTransform: "uppercase",
              }}
            >
              {t("featured.plannedFor")}
            </span>
          </div>
        </div>
      </div>
      <div
        style={{
          background: BRAND.ink,
          color: BRAND.paper,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "26px 28px",
          position: "relative",
        }}
      >
        <div>
          <div
            style={{
              color: "rgba(250,247,242,.55)",
              fontSize: 11,
              letterSpacing: "0.06em",
              marginBottom: 8,
              textTransform: "uppercase",
            }}
          >
            {t("featured.checklistTitle")}
          </div>
          <h3
            style={{
              fontFamily: SERIF_STACK,
              fontSize: 24,
              fontWeight: 400,
              lineHeight: 1.1,
              margin: 0,
              maxWidth: "22ch",
            }}
          >
            {t("featured.checklistDescription")}
          </h3>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            margin: "22px 0",
          }}
        >
          {checklist.map((item) => {
            const dotBackground = item.done ? BRAND.paper : "transparent";
            const dotBorder = item.done ? BRAND.paper : "rgba(250,247,242,.4)";
            const dotShadow = item.now
              ? "0 0 0 4px rgba(250,247,242,.12)"
              : "none";
            const dotBorderColor = item.now ? BRAND.paper : dotBorder;
            let statusText = "—";
            if (item.done) {
              statusText = t("status.done");
            } else if (item.now) {
              statusText = t("status.now");
            }
            return (
              <div
                key={item.label}
                style={{
                  alignItems: "center",
                  display: "flex",
                  fontSize: 12.5,
                  gap: 10,
                }}
              >
                <span
                  style={{
                    background: dotBackground,
                    border: `1px solid ${dotBorderColor}`,
                    borderRadius: "50%",
                    boxShadow: dotShadow,
                    height: 14,
                    width: 14,
                  }}
                />
                <span>{item.label}</span>
                <span
                  style={{
                    color: "rgba(250,247,242,.55)",
                    fontFamily: MONO_STACK,
                    fontSize: 11,
                    marginLeft: "auto",
                  }}
                >
                  {statusText}
                </span>
              </div>
            );
          })}
        </div>
        <Link
          href={`/events/${draft.$id}`}
          style={{
            alignItems: "center",
            alignSelf: "flex-start",
            background: "rgba(250,247,242,.08)",
            border: "0.5px solid rgba(250,247,242,.25)",
            borderRadius: 8,
            color: BRAND.paper,
            cursor: "pointer",
            display: "inline-flex",
            fontSize: 13,
            gap: 10,
            padding: "10px 16px",
            textDecoration: "none",
          }}
        >
          {t("featured.resume")}
          <TrendingUp size={14} />
        </Link>
      </div>
    </section>
  );
}

function WhenCell({ event }: { event: EventRecord }) {
  const locale = normalizeLocale(useLocale());
  const t = useTranslations("adminPortal.events.studio");
  if (!event.start_date) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontSize: 12.5,
          gap: 2,
        }}
      >
        <span style={{ color: BRAND.ink4 }}>—</span>
      </div>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        fontSize: 12.5,
        gap: 2,
      }}
    >
      <span style={{ color: BRAND.ink2, fontFamily: MONO_STACK }}>
        {fmtDay(event.start_date, locale)} ·{" "}
        {fmtDate(event.start_date, locale, {
          invalid: t("fallback.invalidDate"),
          tbd: t("fallback.tbd"),
        })}
      </span>
      <span style={{ color: BRAND.ink3, fontSize: 11 }}>
        {fmtTime(event.start_date, locale)} – {fmtTime(event.end_date, locale)}
      </span>
      <span
        style={{
          color: BRAND.ink4,
          fontFamily: MONO_STACK,
          fontSize: 10.5,
        }}
      >
        {durationHrs(event.start_date, event.end_date)}
      </span>
    </div>
  );
}

function VenueCell({ event }: { event: EventRecord }) {
  const baseStyle: React.CSSProperties = {
    alignItems: "center",
    color: BRAND.ink2,
    display: "flex",
    fontSize: 12.5,
    gap: 6,
    minWidth: 0,
  };
  const hasVenue = Boolean(event.location || event.online_url);
  if (!hasVenue) {
    return (
      <div style={baseStyle}>
        <span style={{ color: BRAND.ink4 }}>—</span>
      </div>
    );
  }
  const pinColor = event.location_mode === "online" ? BRAND.sky : BRAND.claret;
  return (
    <div style={baseStyle}>
      <span
        style={{
          background: pinColor,
          borderRadius: "50%",
          flexShrink: 0,
          height: 8,
          width: 8,
        }}
      />
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {event.location ?? event.online_url ?? "—"}
      </span>
    </div>
  );
}

function CapacityCell({
  capacity,
  registered,
}: {
  capacity: number;
  registered: number;
}) {
  const ratio = capacity > 0 ? Math.min(registered / capacity, 1) : 0;
  const full = ratio >= 1 && capacity > 0;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        fontSize: 12,
        gap: 4,
      }}
    >
      <div style={{ alignItems: "baseline", display: "flex", gap: 6 }}>
        <span
          style={{
            fontFamily: MONO_STACK,
            fontFeatureSettings: '"tnum" 1',
            fontWeight: 500,
          }}
        >
          {registered}
        </span>
        <span style={{ color: BRAND.ink4, fontSize: 10.5 }}>
          of {capacity > 0 ? capacity : "—"}
        </span>
      </div>
      <div
        style={{
          background: BRAND.paper3,
          borderRadius: 999,
          height: 3,
          overflow: "hidden",
        }}
      >
        <span
          style={{
            background: full ? BRAND.claret : BRAND.ink,
            display: "block",
            height: "100%",
            width: `${ratio * 100}%`,
          }}
        />
      </div>
    </div>
  );
}

function PriceCell({
  memberPrice,
  price,
}: {
  memberPrice: number | null;
  price: number;
}) {
  const t = useTranslations("adminPortal.events.studio");
  const isFree = price === 0;
  const showMember =
    price > 0 && memberPrice != null && memberPrice > 0 && memberPrice < price;
  return (
    <div
      style={{
        color: isFree ? BRAND.leaf : BRAND.ink2,
        fontFamily: MONO_STACK,
        fontSize: 12.5,
      }}
    >
      {fmtNOK(price, t("free"))}
      {showMember && (
        <div style={{ color: BRAND.ink3, fontSize: 10.5 }}>
          {fmtNOK(memberPrice, t("free"))} {t("memberAbbrev")}
        </div>
      )}
    </div>
  );
}

function EventRow({
  event,
  isConfirmingDelete,
  labels,
  onCancelDelete,
  onDelete,
  onRequestDelete,
}: {
  event: EventRecord;
  isConfirmingDelete: boolean;
  labels: EventStudioDashboardProps["labels"];
  onCancelDelete: () => void;
  onDelete: (id: string) => void;
  onRequestDelete: (id: string) => void;
}) {
  const locale = normalizeLocale(useLocale());
  const t = useTranslations("adminPortal.events");
  const ts = useTranslations("adminPortal.events.studio");
  const titleEn = getTitle(event, locale) || ts("fallback.untitled");
  const titleNo = getTitle(event, "no");
  const categoryKey = event.category ? String(event.category) : null;
  const capacity = event.capacity ?? 0;
  const registered = 0;
  const price = event.price ?? 0;

  return (
    <div
      style={{
        alignItems: "center",
        borderTop: `0.5px solid ${BRAND.rule}`,
        color: BRAND.ink,
        cursor: "pointer",
        display: "grid",
        gap: 12,
        gridTemplateColumns: "56px 1.6fr 0.85fr 0.7fr 0.95fr 0.5fr 0.85fr",
        padding: "14px 16px",
        position: "relative",
      }}
    >
      <DateBlock iso={event.start_date} />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 3,
          minWidth: 0,
        }}
      >
        <Link
          href={`/events/${event.$id}`}
          style={{
            color: BRAND.ink,
            fontSize: 14.5,
            fontWeight: 500,
            letterSpacing: "-0.005em",
            overflow: "hidden",
            textDecoration: "none",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {titleEn}
          {event.is_collection && (
            <span
              style={{
                background:
                  "linear-gradient(180deg, rgba(176,138,62,.15), rgba(176,138,62,.05))",
                border: "0.5px solid rgba(176,138,62,.35)",
                borderRadius: 999,
                color: "#6a5118",
                display: "inline-flex",
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: "0.04em",
                marginLeft: 8,
                padding: "1px 6px",
                textTransform: "uppercase",
              }}
            >
              {ts("series")}
            </span>
          )}
        </Link>
        <div
          style={{
            alignItems: "center",
            color: BRAND.ink3,
            display: "flex",
            fontSize: 12,
            gap: 6,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              border: `0.5px solid ${BRAND.rule2}`,
              borderRadius: 3,
              color: BRAND.ink4,
              fontFamily: MONO_STACK,
              fontSize: 9.5,
              padding: "1px 4px",
            }}
          >
            NO
          </span>
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {titleNo}
          </span>
          {categoryKey && (
            <>
              <span style={{ color: BRAND.ink4 }}>·</span>
              <span
                style={{
                  alignItems: "center",
                  background: BRAND.paper2,
                  borderRadius: 999,
                  color: BRAND.ink3,
                  display: "inline-flex",
                  fontSize: 10.5,
                  gap: 4,
                  padding: "1px 6px",
                }}
              >
                {t(`categories.${categoryKey}`)}
              </span>
            </>
          )}
        </div>
      </div>

      <WhenCell event={event} />

      <VenueCell event={event} />

      <CapacityCell capacity={capacity} registered={registered} />

      <PriceCell memberPrice={event.member_price ?? null} price={price} />

      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
        }}
      >
        <StatusPill status={event.status} />
        <div style={{ alignItems: "center", display: "flex", gap: 4 }}>
          <Link
            aria-label="Logistics"
            href={`/events/${event.$id}/segments`}
            style={{
              alignItems: "center",
              background: "rgba(255,255,255,.7)",
              border: `0.5px solid ${BRAND.rule2}`,
              borderRadius: 7,
              color: BRAND.ink2,
              cursor: "pointer",
              display: "grid",
              height: 28,
              justifyItems: "center",
              width: 28,
            }}
            title="Logistics"
          >
            <MapPin size={13} />
          </Link>
          <Link
            aria-label={labels.edit}
            href={`/events/${event.$id}`}
            style={{
              alignItems: "center",
              background: "rgba(255,255,255,.7)",
              border: `0.5px solid ${BRAND.rule2}`,
              borderRadius: 7,
              color: BRAND.ink2,
              cursor: "pointer",
              display: "grid",
              height: 28,
              justifyItems: "center",
              width: 28,
            }}
          >
            <Pencil size={13} />
          </Link>
          <button
            aria-label={t("actions.duplicate")}
            disabled
            style={{
              alignItems: "center",
              background: "rgba(255,255,255,.4)",
              border: `0.5px solid ${BRAND.rule2}`,
              borderRadius: 7,
              color: BRAND.ink4,
              cursor: "not-allowed",
              display: "grid",
              height: 28,
              justifyItems: "center",
              opacity: 0.5,
              width: 28,
            }}
            type="button"
          >
            <Copy size={13} />
          </button>
          <button
            aria-label={
              isConfirmingDelete ? labels.deleteConfirm : labels.delete
            }
            onBlur={onCancelDelete}
            onClick={() => {
              if (isConfirmingDelete) {
                onDelete(event.$id);
                return;
              }
              onRequestDelete(event.$id);
            }}
            style={{
              alignItems: "center",
              background: isConfirmingDelete
                ? "rgba(107,30,30,.18)"
                : "rgba(107,30,30,.06)",
              border: "0.5px solid rgba(107,30,30,.2)",
              borderRadius: 7,
              color: BRAND.claret,
              cursor: "pointer",
              display: "grid",
              height: 28,
              justifyItems: "center",
              width: 28,
            }}
            title={isConfirmingDelete ? labels.deleteConfirm : labels.delete}
            type="button"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function EventStudioDashboard({
  initialEvents,
  labels,
  page,
  total,
}: EventStudioDashboardProps) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const t = useTranslations("adminPortal.events");
  const ts = useTranslations("adminPortal.events.studio");
  const tc = useTranslations("adminPortal.common");

  const now = Date.now();

  const counts = useMemo(() => {
    let upcoming = 0;
    let drafts = 0;
    let past = 0;
    let cancelled = 0;
    for (const event of initialEvents) {
      if (event.status === "draft") {
        drafts += 1;
      }
      if (event.status === "cancelled") {
        cancelled += 1;
      }
      if (isUpcoming(event, now)) {
        upcoming += 1;
      }
      if (isPast(event, now)) {
        past += 1;
      }
    }
    return {
      all: initialEvents.length,
      cancelled,
      drafts,
      past,
      upcoming,
    };
  }, [initialEvents, now]);

  const soldOut = useMemo(() => {
    // No registration data wired yet — stub.
    return 0;
  }, []);

  const filteredEvents = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    return initialEvents.filter((event) => {
      if (!matchesEventFilter(event, filter, now)) {
        return false;
      }
      if (!trimmed) {
        return true;
      }
      return buildEventHaystack(event).includes(trimmed);
    });
  }, [filter, initialEvents, now, query]);

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteEvent(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setPendingDeleteId(null);
      toast.success(t("deleteSuccess"));
    });
  }

  const tabs: { count: number; key: FilterKey; label: string }[] = [
    { count: counts.all, key: "all", label: labels.all },
    { count: counts.upcoming, key: "upcoming", label: labels.upcoming },
    { count: counts.drafts, key: "drafts", label: labels.drafts },
    { count: counts.past, key: "past", label: labels.past },
    { count: counts.cancelled, key: "cancelled", label: labels.cancelled },
  ];

  return (
    <div
      style={{
        color: BRAND.ink,
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        padding: "28px 36px 56px",
      }}
    >
      <header
        style={{
          alignItems: "flex-end",
          borderBottom: `0.5px solid ${BRAND.rule}`,
          display: "flex",
          gap: 24,
          justifyContent: "space-between",
          paddingBottom: 22,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: SERIF_STACK,
              fontSize: 56,
              fontWeight: 400,
              letterSpacing: "-0.015em",
              lineHeight: 0.95,
              margin: 0,
            }}
          >
            {t("title")}{" "}
            <em style={{ color: BRAND.claret, fontStyle: "italic" }}>
              {ts("titleAccent")}
            </em>
          </h1>
          <p
            style={{
              color: BRAND.ink3,
              fontSize: 14.5,
              margin: "8px 0 0",
              maxWidth: "48ch",
            }}
          >
            {ts("description")}
          </p>
        </div>
        <Link
          href="/events/new"
          style={{
            alignItems: "center",
            background: BRAND.ink,
            borderRadius: 999,
            boxShadow:
              "0 4px 20px rgba(26,24,20,.25), 0 1px 0 rgba(255,255,255,.1) inset",
            color: BRAND.paper,
            cursor: "pointer",
            display: "inline-flex",
            fontSize: 14,
            fontWeight: 500,
            gap: 10,
            letterSpacing: "-0.005em",
            padding: "12px 18px",
            textDecoration: "none",
          }}
        >
          <span
            style={{
              alignItems: "center",
              background: BRAND.paper,
              borderRadius: "50%",
              color: BRAND.ink,
              display: "grid",
              height: 22,
              justifyItems: "center",
              width: 22,
            }}
          >
            <Plus size={14} />
          </span>
          {labels.compose}
        </Link>
      </header>

      <section
        style={{
          background: "rgba(255,255,255,.45)",
          border: `0.5px solid ${BRAND.rule}`,
          borderRadius: 14,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          margin: "24px 0 28px",
          overflow: "hidden",
        }}
      >
        <KpiCard
          delta={ts("kpi.published", { count: counts.upcoming })}
          label={t("kpi.upcoming")}
          spark={[3, 3, 4, 5, 5, 6, 6, counts.upcoming || 1]}
          value={String(counts.upcoming)}
        />
        <KpiCard
          delta={ts("kpi.awaitingRegistration")}
          icon={<Users size={11} />}
          label={t("kpi.registrants")}
          value="—"
        />
        <KpiCard
          delta={ts("kpi.awaitingRegistration")}
          label={t("kpi.fillRate")}
          value="—"
        />
        <KpiCard
          alert={soldOut > 0}
          delta={soldOut > 0 ? ts("kpi.openWaitlist") : ts("kpi.awaitingData")}
          label={t("kpi.soldOut")}
          value={soldOut > 0 ? String(soldOut) : "—"}
        />
      </section>

      <FeaturedEventDraft events={initialEvents} />

      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 8,
          margin: "0 0 16px",
        }}
      >
        <div
          style={{
            alignItems: "center",
            background: BRAND.paper2,
            border: `0.5px solid ${BRAND.rule2}`,
            borderRadius: 10,
            display: "flex",
            padding: 3,
          }}
        >
          {tabs.map((tab) => {
            const active = filter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                style={{
                  alignItems: "center",
                  background: active ? "white" : "transparent",
                  border: 0,
                  borderRadius: 7,
                  boxShadow: active ? "0 1px 2px rgba(0,0,0,.06)" : "none",
                  color: active ? BRAND.ink : BRAND.ink3,
                  cursor: "pointer",
                  display: "flex",
                  fontSize: 12.5,
                  gap: 8,
                  padding: "6px 14px",
                }}
                type="button"
              >
                {tab.label}{" "}
                <span
                  style={{
                    color: active ? BRAND.ink3 : BRAND.ink4,
                    fontFamily: MONO_STACK,
                    fontSize: 10.5,
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1, position: "relative" }}>
          <Search
            size={14}
            style={{
              color: BRAND.ink4,
              left: 12,
              pointerEvents: "none",
              position: "absolute",
              top: "50%",
              transform: "translateY(-50%)",
            }}
          />
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder={labels.searchPlaceholder}
            style={{
              background: "rgba(255,255,255,.5)",
              border: `0.5px solid ${BRAND.rule2}`,
              borderRadius: 8,
              color: BRAND.ink,
              fontSize: 12.5,
              height: 32,
              maxWidth: 320,
              outline: "none",
              padding: "0 12px 0 32px",
              width: "100%",
            }}
            type="search"
            value={query}
          />
        </div>

        <button
          style={{
            alignItems: "center",
            background: "rgba(255,255,255,.5)",
            border: `0.5px solid ${BRAND.rule2}`,
            borderRadius: 8,
            color: BRAND.ink2,
            cursor: "pointer",
            display: "flex",
            fontSize: 12.5,
            gap: 6,
            height: 30,
            padding: "0 10px",
          }}
          type="button"
        >
          <Filter size={13} /> {tc("category")}
        </button>
        <button
          style={{
            alignItems: "center",
            background: "rgba(255,255,255,.5)",
            border: `0.5px solid ${BRAND.rule2}`,
            borderRadius: 8,
            color: BRAND.ink2,
            cursor: "pointer",
            display: "flex",
            fontSize: 12.5,
            gap: 6,
            height: 30,
            padding: "0 10px",
          }}
          type="button"
        >
          <MapPin size={13} /> {tc("campus")}
        </button>
        <button
          style={{
            alignItems: "center",
            background: "rgba(255,255,255,.5)",
            border: `0.5px solid ${BRAND.rule2}`,
            borderRadius: 8,
            color: BRAND.ink2,
            cursor: "pointer",
            display: "flex",
            fontSize: 12.5,
            gap: 6,
            height: 30,
            padding: "0 10px",
          }}
          type="button"
        >
          <CalendarDays size={13} /> {tc("date")}
        </button>
      </div>

      <section style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        <div
          style={{
            color: BRAND.ink4,
            display: "grid",
            fontSize: 11,
            gap: 12,
            gridTemplateColumns: "56px 1.6fr 0.85fr 0.7fr 0.95fr 0.5fr 0.85fr",
            letterSpacing: "0.05em",
            padding: "0 16px 8px",
            textTransform: "uppercase",
          }}
        >
          <div />
          <div>{t("fields.title")}</div>
          <div>{ts("table.when")}</div>
          <div>{t("fields.location")}</div>
          <div>{ts("table.registered")}</div>
          <div>{tc("price")}</div>
          <div style={{ textAlign: "right" }}>{t("fields.status")}</div>
        </div>

        {filteredEvents.length === 0 ? (
          <div
            style={{
              alignItems: "center",
              borderBottom: `0.5px solid ${BRAND.rule}`,
              borderTop: `0.5px solid ${BRAND.rule}`,
              color: BRAND.ink3,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: "48px 16px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                alignItems: "center",
                background: BRAND.paper2,
                border: `0.5px solid ${BRAND.rule2}`,
                borderRadius: 16,
                color: BRAND.ink4,
                display: "grid",
                height: 56,
                justifyItems: "center",
                width: 56,
              }}
            >
              <Bell size={22} />
            </div>
            <h2
              style={{
                color: BRAND.ink,
                fontFamily: SERIF_STACK,
                fontSize: 22,
                fontStyle: "italic",
                fontWeight: 400,
                margin: "8px 0 0",
              }}
            >
              {labels.empty}
            </h2>
            <p
              style={{
                color: BRAND.ink3,
                fontSize: 13,
                margin: 0,
                maxWidth: "44ch",
              }}
            >
              {labels.emptyDescription}
            </p>
          </div>
        ) : (
          <>
            {filteredEvents.map((event) => (
              <EventRow
                event={event}
                isConfirmingDelete={pendingDeleteId === event.$id}
                key={event.$id}
                labels={labels}
                onCancelDelete={() => setPendingDeleteId(null)}
                onDelete={handleDelete}
                onRequestDelete={setPendingDeleteId}
              />
            ))}
            <div
              style={{ borderBottom: `0.5px solid ${BRAND.rule}`, height: 0 }}
            />
          </>
        )}
      </section>

      <PaginationBar page={page} total={total} />
    </div>
  );
}
