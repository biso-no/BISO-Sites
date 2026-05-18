"use client";

import {
  type Campus,
  type Departments,
  EventCategory,
  EventCoverPattern,
  EventLocationMode,
  EventPricingMode,
  EventPublishMode,
  EventStatus,
} from "@repo/api/types/appwrite";
import type { EventRecord } from "@repo/shared/types/events";
import {
  type EventUpsertInput,
  eventUpsertSchema,
} from "@repo/shared/types/events";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  Globe,
  GripVertical,
  Heading1,
  Languages,
  Link2,
  List,
  Lock,
  MapPin,
  Pilcrow,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  createEvent,
  generateEventNorwegianDraft,
  suggestEventDescriptionSection,
  updateEvent,
} from "../../../_actions/events";
import { uploadMediaFile } from "../../../_actions/upload";
import { DepartmentCombobox } from "../../../_components/department-combobox";

/* -------------------------------------------------------------------------- */
/*                              Brand + constants                             */
/* -------------------------------------------------------------------------- */

const BRAND = {
  accent: "#3DA9E0",
  blue: "#001731",
  claret: "#6b1e1e",
  gold: "#b08a3e",
  green: "#4ade80",
  ink: "#1a1814",
  ink2: "#3a342a",
  ink3: "#6b6357",
  ink4: "#9c9385",
  leaf: "#2f5d3a",
  navy: "#000a16",
  paper: "#faf7f2",
  paper2: "#f3eee5",
  paper3: "#ede6d8",
  red: "#f87171",
  rule: "#e5dcca",
  rule2: "#d8cdb6",
  sky: "#2a4a7a",
} as const;

const STEPS = [
  "Essentials",
  "Description",
  "Schedule & venue",
  "Tickets & audience",
  "Review",
] as const;

type StepIndex = 0 | 1 | 2 | 3 | 4;

const EVENT_CATEGORIES = [
  { id: EventCategory.SOCIAL, name: "Social", crest: "S" },
  { id: EventCategory.CAREER, name: "Career", crest: "C" },
  { id: EventCategory.WORKSHOP, name: "Workshop", crest: "W" },
  { id: EventCategory.TALK, name: "Talk", crest: "T" },
  { id: EventCategory.PARTY, name: "Party", crest: "P" },
  { id: EventCategory.SPORT, name: "Sport", crest: "Sp" },
  { id: EventCategory.ACADEMIC, name: "Academic", crest: "A" },
  { id: EventCategory.TRIP, name: "Trip", crest: "Tr" },
] as const;

const COVER_PATTERNS = [
  { id: EventCoverPattern.DOTTED, label: "Dotted" },
  { id: EventCoverPattern.LINEAR, label: "Linear" },
  { id: EventCoverPattern.CONCENTRIC, label: "Concentric" },
  { id: EventCoverPattern.WAVE, label: "Wave" },
  { id: EventCoverPattern.GRID, label: "Grid" },
] as const;

const TAG_OPTIONS = [
  "Welcome week",
  "International",
  "Free",
  "Networking",
  "Career",
  "Food included",
  "After-party",
  "Beginner-friendly",
  "Members only",
  "Sport",
  "Outdoor",
] as const;

const LOCATION_MODES = [
  {
    id: EventLocationMode.PHYSICAL,
    label: "On campus",
    description: "A room, a venue",
  },
  {
    id: EventLocationMode.ONLINE,
    label: "Online",
    description: "Teams, Zoom, etc",
  },
  {
    id: EventLocationMode.HYBRID,
    label: "Hybrid",
    description: "Both, in parallel",
  },
] as const;

const PUSH_FOLLOWERS = 4217;
const STUDENT_POPULATION = 6840;

type LocaleCode = "en" | "no";
type DescriptionBlockType = "h" | "l" | "p";

interface DescriptionBlock {
  id: string;
  text: string;
  type: DescriptionBlockType;
}

interface EventStudioEditorProps {
  allowedDepartmentIds?: string[];
  campuses: Campus[];
  canChangeCampus?: boolean;
  defaultCampusId?: string;
  event: EventRecord | null;
  initialDepartments: Departments[];
  isNew: boolean;
  labels: {
    back: string;
    publish: string;
    publishSuccess: string;
    saveDraft: string;
    saveError: string;
    saveSuccess: string;
  };
}

export type { EventStudioEditorProps };

/* -------------------------------------------------------------------------- */
/*                                  Utilities                                 */
/* -------------------------------------------------------------------------- */

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function toDateTimeInput(value: string | null | undefined) {
  return value ? value.slice(0, 16) : "";
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatTime(value: string | null | undefined) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatMonthShort(value: string | null | undefined) {
  if (!value) {
    return "TBD";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "TBD";
  }
  return new Intl.DateTimeFormat("en-GB", { month: "short" })
    .format(date)
    .toUpperCase();
}

function formatDayNumber(value: string | null | undefined) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return String(date.getDate()).padStart(2, "0");
}

function durationHours(
  start: string | null | undefined,
  end: string | null | undefined
) {
  if (!(start && end)) {
    return null;
  }
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) {
    return null;
  }
  const hours = (b - a) / (1000 * 60 * 60);
  if (hours >= 24) {
    const days = Math.round((hours / 24) * 10) / 10;
    return `${days}d`;
  }
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded}h`;
}

function formatNOK(value: number | null | undefined) {
  if (value == null || value === 0) {
    return "Free";
  }
  return `NOK ${Math.round(value).toLocaleString("en-GB")}`;
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function newBlock(type: DescriptionBlockType, text = ""): DescriptionBlock {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    text,
    type,
  };
}

function htmlToDescriptionBlocks(value: string): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = [];
  const pattern = /<(h[1-6]|p|li)[^>]*>(.*?)<\/\1>/gis;
  let match = pattern.exec(value);

  while (match) {
    const [, tag, rawText] = match;
    const text = decodeHtml(stripHtml(rawText ?? ""));
    let type: DescriptionBlockType = "p";
    if (tag?.startsWith("h")) {
      type = "h";
    } else if (tag === "li") {
      type = "l";
    }
    blocks.push(newBlock(type, text));
    match = pattern.exec(value);
  }

  if (blocks.length > 0) {
    return blocks;
  }

  const plain = stripHtml(value);
  return [newBlock("p", plain)];
}

function descriptionBlocksToHtml(blocks: DescriptionBlock[]) {
  const html: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }
    html.push(`<ul>${listItems.join("")}</ul>`);
    listItems = [];
  };

  for (const block of blocks) {
    const text = escapeHtml(block.text.trim());
    if (!text) {
      continue;
    }
    if (block.type === "l") {
      listItems.push(`<li>${text}</li>`);
      continue;
    }
    flushList();
    html.push(block.type === "h" ? `<h3>${text}</h3>` : `<p>${text}</p>`);
  }

  flushList();
  return html.join("");
}

function fallback<T>(value: T | null | undefined, fallbackValue: T): T {
  return value ?? fallbackValue;
}

function getTranslation(event: EventRecord | null, locale: LocaleCode) {
  return event?.translation_refs.find(
    (translation) => translation.locale === locale
  );
}

function buildDefaultValues(
  event: EventRecord | null,
  campuses: Campus[],
  defaultCampusId?: string
): EventUpsertInput {
  const en = getTranslation(event, "en");
  const no = getTranslation(event, "no");
  const effectiveCampusId = defaultCampusId ?? campuses[0]?.$id ?? "";

  return {
    title_en: fallback(en?.title, ""),
    title_no: fallback(no?.title, ""),
    description_en: fallback(en?.description, ""),
    description_no: fallback(no?.description, ""),
    short_description_en: fallback(en?.short_description, null),
    short_description_no: fallback(no?.short_description, null),
    campus_id: fallback(event?.campus_id, effectiveCampusId),
    department_id: fallback(event?.department_id, null),
    slug: fallback(event?.slug, ""),
    status: fallback(event?.status, EventStatus.DRAFT),
    category: fallback(event?.category, null),
    tags: fallback(event?.tags, []),
    start_date: fallback(event?.start_date, null),
    end_date: fallback(event?.end_date, null),
    registration_deadline: fallback(event?.registration_deadline, null),
    location_mode: fallback(event?.location_mode, EventLocationMode.PHYSICAL),
    location: fallback(event?.location, null),
    online_url: fallback(event?.online_url, null),
    capacity: fallback(event?.capacity, 0),
    waitlist: fallback(event?.waitlist, false),
    cover_pattern: fallback(event?.cover_pattern, EventCoverPattern.DOTTED),
    image: fallback(event?.image, null),
    pricing_mode: fallback(event?.pricing_mode, EventPricingMode.FREE),
    price: fallback(event?.price, null),
    member_price: fallback(event?.member_price, null),
    ticket_url: fallback(event?.ticket_url, null),
    member_only: fallback(event?.member_only, false),
    is_collection: fallback(event?.is_collection, false),
    notify_push: fallback(event?.notify_push, false),
    publish_mode: fallback(event?.publish_mode, EventPublishMode.NOW),
    scheduled_publish_at: fallback(event?.scheduled_publish_at, null),
    contact_name: fallback(event?.contact_name, null),
    contact_role: fallback(event?.contact_role, null),
    contact_email: fallback(event?.contact_email, null),
  };
}

/* -------------------------------------------------------------------------- */
/*                                Cover patterns                              */
/* -------------------------------------------------------------------------- */

function coverPatternToNumber(value: EventCoverPattern | null | undefined) {
  switch (value) {
    case EventCoverPattern.LINEAR:
      return 2;
    case EventCoverPattern.CONCENTRIC:
      return 3;
    case EventCoverPattern.WAVE:
      return 4;
    case EventCoverPattern.GRID:
      return 5;
    default:
      return 1;
  }
}

function coverBackground(value: EventCoverPattern | null | undefined) {
  switch (value) {
    case EventCoverPattern.LINEAR:
      return "linear-gradient(135deg, #2a4a7a 0%, #15263c 100%)";
    case EventCoverPattern.CONCENTRIC:
      return "linear-gradient(135deg, #2f5d3a 0%, #1a3422 100%)";
    case EventCoverPattern.WAVE:
      return "linear-gradient(135deg, #b08a3e 0%, #6a5118 100%)";
    case EventCoverPattern.GRID:
      return "linear-gradient(180deg, #29261b 0%, #100e09 100%)";
    default:
      return "linear-gradient(135deg, #6b1e1e 0%, #2a1010 100%)";
  }
}

function EvCoverPattern({ which }: { which: number }) {
  if (which === 2) {
    return (
      <svg
        aria-hidden
        preserveAspectRatio="none"
        style={{
          height: "100%",
          inset: 0,
          opacity: 0.3,
          position: "absolute",
          width: "100%",
        }}
        viewBox="0 0 200 130"
      >
        <title>Linear cover pattern</title>
        {Array.from({ length: 8 }).map((_, i) => (
          <line
            key={`line-${i}`}
            stroke="white"
            strokeWidth="0.5"
            x1="0"
            x2="200"
            y1={i * 18}
            y2={i * 18 - 30}
          />
        ))}
      </svg>
    );
  }
  if (which === 3) {
    return (
      <svg
        aria-hidden
        preserveAspectRatio="none"
        style={{
          height: "100%",
          inset: 0,
          opacity: 0.3,
          position: "absolute",
          width: "100%",
        }}
        viewBox="0 0 200 130"
      >
        <title>Concentric cover pattern</title>
        {[80, 60, 40, 20].map((r) => (
          <circle
            cx="40"
            cy="100"
            fill="none"
            key={`circ-${r}`}
            r={r}
            stroke="white"
            strokeWidth="0.5"
          />
        ))}
      </svg>
    );
  }
  if (which === 4) {
    return (
      <svg
        aria-hidden
        preserveAspectRatio="none"
        style={{
          height: "100%",
          inset: 0,
          opacity: 0.3,
          position: "absolute",
          width: "100%",
        }}
        viewBox="0 0 200 130"
      >
        <title>Wave cover pattern</title>
        {Array.from({ length: 10 }).map((_, i) => (
          <path
            d={`M0,${60 + i * 8} Q50,${40 + i * 8} 100,${60 + i * 8} T200,${60 + i * 8}`}
            fill="none"
            key={`wave-${i}`}
            opacity={1 - i * 0.06}
            stroke="white"
            strokeWidth="0.4"
          />
        ))}
      </svg>
    );
  }
  if (which === 5) {
    return (
      <svg
        aria-hidden
        preserveAspectRatio="none"
        style={{
          height: "100%",
          inset: 0,
          opacity: 0.3,
          position: "absolute",
          width: "100%",
        }}
        viewBox="0 0 200 130"
      >
        <title>Grid cover pattern</title>
        <defs>
          <pattern
            height="22"
            id="evstudio-grid"
            patternUnits="userSpaceOnUse"
            width="22"
          >
            <path d="M0 11h22M11 0v22" stroke="white" strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect fill="url(#evstudio-grid)" height="130" width="200" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden
      preserveAspectRatio="none"
      style={{
        height: "100%",
        inset: 0,
        opacity: 0.3,
        position: "absolute",
        width: "100%",
      }}
      viewBox="0 0 200 130"
    >
      <title>Dotted cover pattern</title>
      <defs>
        <pattern
          height="14"
          id="evstudio-dots"
          patternUnits="userSpaceOnUse"
          width="14"
        >
          <circle cx="2" cy="2" fill="white" r="1" />
        </pattern>
      </defs>
      <rect fill="url(#evstudio-dots)" height="130" width="200" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   StepRail                                 */
/* -------------------------------------------------------------------------- */

function pickStepColor(
  active: boolean,
  done: boolean,
  variants: { active: string; done: string; idle: string }
) {
  if (active) {
    return variants.active;
  }
  if (done) {
    return variants.done;
  }
  return variants.idle;
}

function StepRail({
  dirty,
  setStep,
  step,
}: {
  dirty: boolean;
  setStep: (step: StepIndex) => void;
  step: StepIndex;
}) {
  return (
    <div
      style={{
        alignItems: "center",
        backdropFilter: "blur(14px)",
        background: "rgba(250,247,242,.92)",
        borderBottom: `0.5px solid ${BRAND.rule}`,
        display: "flex",
        gap: 6,
        padding: "14px 36px",
        position: "sticky",
        top: 0,
        WebkitBackdropFilter: "blur(14px)",
        zIndex: 10,
      }}
    >
      {STEPS.map((name, index) => {
        const active = index === step;
        const done = index < step;
        const pillColor = pickStepColor(active, done, {
          active: BRAND.paper,
          done: BRAND.leaf,
          idle: BRAND.ink3,
        });
        const numBg = pickStepColor(active, done, {
          active: BRAND.paper,
          done: BRAND.leaf,
          idle: "white",
        });
        const numBorder = pickStepColor(active, done, {
          active: "0.5px solid transparent",
          done: `0.5px solid ${BRAND.leaf}`,
          idle: `0.5px solid ${BRAND.rule2}`,
        });
        const numColor = pickStepColor(active, done, {
          active: BRAND.ink,
          done: "white",
          idle: BRAND.ink3,
        });
        return (
          <div key={name} style={{ alignItems: "center", display: "flex" }}>
            {index > 0 && (
              <div
                style={{
                  background: BRAND.rule2,
                  height: "0.5px",
                  margin: "0 -2px",
                  maxWidth: 36,
                  width: 36,
                }}
              />
            )}
            <button
              onClick={() => setStep(index as StepIndex)}
              style={{
                alignItems: "center",
                background: active ? BRAND.ink : "transparent",
                border: 0,
                borderRadius: 999,
                color: pillColor,
                cursor: "pointer",
                display: "flex",
                fontSize: 12.5,
                gap: 9,
                padding: "6px 14px 6px 6px",
                transition: "color .15s, background .15s",
              }}
              type="button"
            >
              <span
                style={{
                  alignItems: "center",
                  background: numBg,
                  borderRadius: "50%",
                  border: numBorder,
                  color: numColor,
                  display: "grid",
                  fontFamily: "ui-monospace, Menlo, Monaco, monospace",
                  fontSize: 10.5,
                  height: 22,
                  justifyItems: "center",
                  placeItems: "center",
                  width: 22,
                }}
              >
                {done ? (
                  <Check size={11} />
                ) : (
                  String(index + 1).padStart(2, "0")
                )}
              </span>
              <span>{name}</span>
            </button>
          </div>
        );
      })}
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 10,
          marginLeft: "auto",
        }}
      >
        {dirty && (
          <span
            style={{
              alignItems: "center",
              color: BRAND.ink3,
              display: "flex",
              fontSize: 11.5,
              gap: 5,
            }}
          >
            <span
              style={{
                background: BRAND.gold,
                borderRadius: "50%",
                height: 5,
                width: 5,
              }}
            />
            Unsaved
          </span>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                LocaleTabs                                  */
/* -------------------------------------------------------------------------- */

function LocaleTabs({
  locale,
  setLocale,
  pendingNo,
}: {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  pendingNo: boolean;
}) {
  return (
    <div
      style={{
        background: BRAND.paper2,
        border: `0.5px solid ${BRAND.rule2}`,
        borderRadius: 8,
        display: "inline-flex",
        gap: 2,
        marginBottom: 8,
        padding: 3,
      }}
    >
      {(["en", "no"] as const).map((item) => {
        const on = locale === item;
        return (
          <button
            key={item}
            onClick={() => setLocale(item)}
            style={{
              alignItems: "center",
              background: on ? "white" : "transparent",
              border: 0,
              borderRadius: 5,
              boxShadow: on ? "0 1px 2px rgba(0,0,0,.05)" : "none",
              color: on ? BRAND.ink : BRAND.ink3,
              cursor: "pointer",
              display: "flex",
              fontSize: 11,
              gap: 6,
              padding: "4px 12px",
            }}
            type="button"
          >
            {item === "en" ? "English" : "Norsk"}
            {item === "no" && pendingNo && (
              <span
                style={{
                  background: BRAND.gold,
                  borderRadius: "50%",
                  height: 5,
                  width: 5,
                }}
                title="Not yet filled"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Description blocks                            */
/* -------------------------------------------------------------------------- */

function EventDescriptionBlockRow({
  block,
  dragging,
  onChange,
  onChangeType,
  onDelete,
  onDropBlock,
  onEnter,
  onFocused,
  onInsertBelow,
  onSlash,
  onStartDrag,
  shouldFocus,
  showSlashMenu,
}: {
  block: DescriptionBlock;
  dragging: boolean;
  onChange: (text: string) => void;
  onChangeType: (type: DescriptionBlockType) => void;
  onDelete: () => void;
  onDropBlock: () => void;
  onEnter: () => void;
  onFocused: () => void;
  onInsertBelow: (type: DescriptionBlockType) => void;
  onSlash: () => void;
  onStartDrag: () => void;
  shouldFocus: boolean;
  showSlashMenu: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerText !== block.text) {
      ref.current.innerText = block.text;
    }
  }, [block.text]);

  useEffect(() => {
    if (!(shouldFocus && ref.current)) {
      return;
    }
    ref.current.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(ref.current);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
    onFocused();
  }, [onFocused, shouldFocus]);

  let placeholder =
    "Tell the story. Who's coming? What does the room look like at 8pm?";
  if (block.type === "h") {
    placeholder = "Section heading…";
  } else if (block.type === "l") {
    placeholder = "A timing, a perk, a what-to-expect…";
  }

  const contentStyle: React.CSSProperties = (() => {
    if (block.type === "h") {
      return {
        color: BRAND.ink,
        fontFamily: "'Instrument Serif', Georgia, serif",
        fontSize: 26,
        fontWeight: 400,
        letterSpacing: "-0.012em",
        lineHeight: 1.15,
        minHeight: 28,
        outline: "none",
      };
    }
    if (block.type === "l") {
      return {
        color: BRAND.ink2,
        fontSize: 15.5,
        lineHeight: 1.6,
        minHeight: 24,
        outline: "none",
      };
    }
    return {
      color: BRAND.ink2,
      fontSize: 15.5,
      lineHeight: 1.55,
      minHeight: 24,
      outline: "none",
    };
  })();

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: drop target wraps semantic editable text
    // biome-ignore lint/a11y/noStaticElementInteractions: see above
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDropBlock();
      }}
      style={{
        display: "flex",
        gap: 12,
        opacity: dragging ? 0.35 : 1,
        padding: block.type === "h" ? "16px 0 8px" : "8px 0",
        position: "relative",
        transition: "opacity .15s",
      }}
    >
      <button
        aria-label="Drag block"
        draggable
        onDragStart={onStartDrag}
        style={{
          alignItems: "flex-start",
          background: "transparent",
          border: 0,
          color: BRAND.ink4,
          cursor: "grab",
          display: "flex",
          flexShrink: 0,
          justifyContent: "center",
          opacity: dragging ? 1 : undefined,
          paddingTop: 8,
          width: 24,
        }}
        type="button"
      >
        <GripVertical size={13} />
      </button>
      <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
        {block.type === "l" && (
          <span
            aria-hidden
            style={{
              background: BRAND.claret,
              height: 1,
              left: 0,
              position: "absolute",
              top: 16,
              width: 8,
            }}
          />
        )}
        {/* biome-ignore lint/a11y/useSemanticElements: contentEditable maintains the document editing UX */}
        <div
          aria-label={placeholder}
          contentEditable
          data-placeholder={placeholder}
          onInput={(event) => onChange(event.currentTarget.innerText)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onEnter();
              return;
            }
            if (event.key === "/") {
              event.preventDefault();
              onSlash();
            }
          }}
          ref={ref}
          role="textbox"
          style={{ ...contentStyle, paddingLeft: block.type === "l" ? 20 : 0 }}
          suppressContentEditableWarning
          tabIndex={0}
        />
        {showSlashMenu && (
          <div
            style={{
              background: "white",
              border: `0.5px solid ${BRAND.rule2}`,
              borderRadius: 12,
              boxShadow: "0 12px 24px rgba(0,0,0,.10)",
              left: 0,
              marginTop: 4,
              overflow: "hidden",
              padding: "4px 0",
              position: "absolute",
              top: "100%",
              width: 220,
              zIndex: 30,
            }}
          >
            {[
              { icon: Heading1, label: "Heading", type: "h" as const },
              { icon: Pilcrow, label: "Paragraph", type: "p" as const },
              { icon: List, label: "Bullet", type: "l" as const },
            ].map(({ icon: Icon, label, type }) => (
              <button
                key={type}
                onClick={() => onChangeType(type)}
                style={{
                  alignItems: "center",
                  background: "transparent",
                  border: 0,
                  color: BRAND.ink2,
                  cursor: "pointer",
                  display: "flex",
                  fontSize: 13,
                  gap: 8,
                  padding: "8px 12px",
                  textAlign: "left",
                  width: "100%",
                }}
                type="button"
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
            <div
              style={{
                background: BRAND.rule,
                height: 1,
                margin: "4px 0",
              }}
            />
            <button
              onClick={() => onInsertBelow("p")}
              style={{
                alignItems: "center",
                background: "transparent",
                border: 0,
                color: BRAND.ink2,
                cursor: "pointer",
                display: "flex",
                fontSize: 13,
                gap: 8,
                padding: "8px 12px",
                textAlign: "left",
                width: "100%",
              }}
              type="button"
            >
              <Plus size={13} />
              New paragraph below
            </button>
            <button
              onClick={onDelete}
              style={{
                alignItems: "center",
                background: "transparent",
                border: 0,
                color: BRAND.claret,
                cursor: "pointer",
                display: "flex",
                fontSize: 13,
                gap: 8,
                padding: "8px 12px",
                textAlign: "left",
                width: "100%",
              }}
              type="button"
            >
              <Trash2 size={13} />
              Delete block
            </button>
          </div>
        )}
      </div>
      <button
        aria-label="Delete block"
        onClick={onDelete}
        style={{
          alignItems: "center",
          background: "transparent",
          border: 0,
          borderRadius: 6,
          color: BRAND.ink4,
          cursor: "pointer",
          display: "grid",
          flexShrink: 0,
          height: 28,
          justifyItems: "center",
          marginTop: 4,
          placeItems: "center",
          width: 28,
        }}
        type="button"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function EventDescriptionBlockEditor({
  blocks,
  onChangeBlocks,
}: {
  blocks: DescriptionBlock[];
  onChangeBlocks: (next: DescriptionBlock[]) => void;
}) {
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [focusBlockId, setFocusBlockId] = useState<string | null>(null);
  const [slashBlockId, setSlashBlockId] = useState<string | null>(null);

  function updateBlock(id: string, text: string) {
    onChangeBlocks(blocks.map((b) => (b.id === id ? { ...b, text } : b)));
  }

  function insertBlock(afterId: string, type: DescriptionBlockType = "p") {
    const idx = blocks.findIndex((b) => b.id === afterId);
    const block = newBlock(type);
    const next = blocks.slice();
    next.splice(idx + 1, 0, block);
    setFocusBlockId(block.id);
    setSlashBlockId(null);
    onChangeBlocks(next);
  }

  function addBlock(type: DescriptionBlockType) {
    const block = newBlock(type);
    setFocusBlockId(block.id);
    setSlashBlockId(null);
    onChangeBlocks([...blocks, block]);
  }

  function changeBlockType(id: string, type: DescriptionBlockType) {
    setFocusBlockId(id);
    setSlashBlockId(null);
    onChangeBlocks(blocks.map((b) => (b.id === id ? { ...b, type } : b)));
  }

  function deleteBlock(id: string) {
    setSlashBlockId(null);
    if (blocks.length === 1) {
      setFocusBlockId(id);
      const first = blocks[0];
      onChangeBlocks([{ ...first, text: "", type: "p" }]);
      return;
    }
    const idx = blocks.findIndex((b) => b.id === id);
    const next = blocks.filter((b) => b.id !== id);
    const nextFocus = next[Math.max(0, idx - 1)]?.id ?? null;
    setFocusBlockId(nextFocus);
    onChangeBlocks(next);
  }

  function moveBlock(sourceId: string, targetId: string) {
    if (sourceId === targetId) {
      return;
    }
    const si = blocks.findIndex((b) => b.id === sourceId);
    const ti = blocks.findIndex((b) => b.id === targetId);
    if (si < 0 || ti < 0) {
      return;
    }
    const next = blocks.slice();
    const [moved] = next.splice(si, 1);
    if (!moved) {
      return;
    }
    next.splice(ti, 0, moved);
    setDraggingBlockId(null);
    setFocusBlockId(sourceId);
    onChangeBlocks(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {blocks.map((block) => (
        <EventDescriptionBlockRow
          block={block}
          dragging={draggingBlockId === block.id}
          key={block.id}
          onChange={(text) => updateBlock(block.id, text)}
          onChangeType={(type) => changeBlockType(block.id, type)}
          onDelete={() => deleteBlock(block.id)}
          onDropBlock={() => {
            if (draggingBlockId) {
              moveBlock(draggingBlockId, block.id);
            }
          }}
          onEnter={() => insertBlock(block.id)}
          onFocused={() => setFocusBlockId(null)}
          onInsertBelow={(type) => insertBlock(block.id, type)}
          onSlash={() => setSlashBlockId(block.id)}
          onStartDrag={() => setDraggingBlockId(block.id)}
          shouldFocus={focusBlockId === block.id}
          showSlashMenu={slashBlockId === block.id}
        />
      ))}
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 8,
          margin: "14px 0 0",
          opacity: 0.85,
          padding: "6px 0",
        }}
      >
        <div style={{ background: BRAND.rule, flex: 1, height: 0.5 }} />
        <button
          onClick={() => addBlock("h")}
          style={addBtnStyle()}
          type="button"
        >
          <Heading1 size={11} />
          Heading
        </button>
        <button
          onClick={() => addBlock("p")}
          style={addBtnStyle()}
          type="button"
        >
          <Pilcrow size={11} />
          Paragraph
        </button>
        <button
          onClick={() => addBlock("l")}
          style={addBtnStyle()}
          type="button"
        >
          <List size={11} />
          Bullet
        </button>
        <div style={{ background: BRAND.rule, flex: 1, height: 0.5 }} />
      </div>
    </div>
  );
}

function addBtnStyle(): React.CSSProperties {
  return {
    alignItems: "center",
    background: "rgba(255,255,255,.6)",
    border: `0.5px solid ${BRAND.rule2}`,
    borderRadius: 999,
    color: BRAND.ink3,
    cursor: "pointer",
    display: "flex",
    fontSize: 11.5,
    gap: 5,
    height: 26,
    padding: "0 10px",
  };
}

/* -------------------------------------------------------------------------- */
/*                               Shared inputs                                */
/* -------------------------------------------------------------------------- */

function fieldInputStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    appearance: "none",
    background: "rgba(255,255,255,.6)",
    border: `0.5px solid ${BRAND.rule2}`,
    borderRadius: 8,
    color: BRAND.ink,
    fontSize: 14,
    outline: 0,
    padding: "10px 12px",
    transition: "border-color .15s, background .15s",
    width: "100%",
    ...extra,
  };
}

function FieldLabel({
  children,
  help,
  required,
}: {
  children: React.ReactNode;
  help?: string;
  required?: boolean;
}) {
  return (
    <div
      style={{
        alignItems: "center",
        color: BRAND.ink3,
        display: "flex",
        fontSize: 11.5,
        fontWeight: 500,
        gap: 8,
        letterSpacing: ".04em",
        textTransform: "uppercase",
      }}
    >
      {children}
      {required && (
        <span style={{ color: BRAND.claret, fontSize: 10 }}>required</span>
      )}
      {help && (
        <span
          style={{
            color: BRAND.ink4,
            fontSize: 10.5,
            fontWeight: 400,
            letterSpacing: 0,
            marginLeft: "auto",
            textTransform: "none",
          }}
        >
          {help}
        </span>
      )}
    </div>
  );
}

function ToggleCard({
  active,
  children,
  description,
  icon,
  onClick,
  title,
}: {
  active: boolean;
  children?: React.ReactNode;
  description?: string;
  icon?: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? BRAND.ink : "rgba(255,255,255,.55)",
        border: `0.5px solid ${active ? BRAND.ink : BRAND.rule2}`,
        borderRadius: 12,
        color: active ? BRAND.paper : BRAND.ink,
        cursor: "pointer",
        padding: "16px 18px",
        position: "relative",
        textAlign: "left",
        transition: "background .12s, border-color .12s",
      }}
      type="button"
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          fontSize: 14,
          fontWeight: 500,
          gap: 8,
        }}
      >
        {icon && (
          <span
            style={{
              alignItems: "center",
              background: active ? "rgba(255,255,255,.12)" : BRAND.paper2,
              borderRadius: 8,
              color: active ? BRAND.paper : BRAND.ink2,
              display: "grid",
              height: 28,
              placeItems: "center",
              width: 28,
            }}
          >
            {icon}
          </span>
        )}
        {title}
      </div>
      {description && (
        <p
          style={{
            color: active ? "rgba(250,247,242,.7)" : BRAND.ink3,
            fontSize: 12.5,
            lineHeight: 1.45,
            margin: "8px 0 0",
          }}
        >
          {description}
        </p>
      )}
      {children}
      <span
        style={{
          alignItems: "center",
          background: active ? BRAND.leaf : "white",
          border: `1px solid ${active ? BRAND.leaf : BRAND.rule2}`,
          borderRadius: "50%",
          color: "white",
          display: "grid",
          height: 18,
          placeItems: "center",
          position: "absolute",
          right: 14,
          top: 14,
          width: 18,
        }}
      >
        {active && <Check size={11} />}
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*                                AI cards                                    */
/* -------------------------------------------------------------------------- */

function AiCard({
  body,
  children,
  gemColor = "linear-gradient(135deg, #b08a3e, #d4ad5b)",
  title,
}: {
  body: string;
  children?: React.ReactNode;
  gemColor?: string;
  title: string;
}) {
  return (
    <div
      style={{
        alignItems: "flex-start",
        background:
          "linear-gradient(180deg, rgba(176,138,62,0.05), rgba(176,138,62,0.02))",
        border: "0.5px dashed rgba(176,138,62,.6)",
        borderRadius: 10,
        display: "flex",
        gap: 12,
        margin: "4px 0 14px",
        padding: "12px 14px",
      }}
    >
      <span
        style={{
          alignItems: "center",
          background: gemColor,
          borderRadius: 8,
          boxShadow: "0 2px 4px rgba(176,138,62,.3)",
          color: "white",
          display: "grid",
          flexShrink: 0,
          height: 28,
          placeItems: "center",
          width: 28,
        }}
      >
        <Sparkles size={14} />
      </span>
      <div style={{ flex: 1 }}>
        <b style={{ fontSize: 13, fontWeight: 500 }}>{title}</b>
        <p
          style={{
            color: BRAND.ink2,
            fontSize: 12.5,
            lineHeight: 1.4,
            margin: "2px 0 8px",
          }}
        >
          {body}
        </p>
        {children}
      </div>
    </div>
  );
}

function aiButtonStyle(primary?: boolean): React.CSSProperties {
  return {
    alignItems: "center",
    background: primary ? BRAND.ink : "rgba(255,255,255,.7)",
    border: `0.5px solid ${primary ? BRAND.ink : "rgba(176,138,62,.4)"}`,
    borderRadius: 6,
    color: primary ? BRAND.paper : BRAND.ink,
    cursor: "pointer",
    display: "flex",
    fontSize: 11.5,
    gap: 4,
    padding: "5px 10px",
  };
}

/* -------------------------------------------------------------------------- */
/*                                Essentials step                             */
/* -------------------------------------------------------------------------- */

function EssentialsStep({
  allowedDepartmentIds,
  campuses,
  canChangeCampus,
  departments,
  initialDepartments,
  locale,
  onTranslateNo,
  set,
  setLocale,
  translating,
  values,
}: {
  allowedDepartmentIds?: string[];
  campuses: Campus[];
  canChangeCampus?: boolean;
  departments: Departments[];
  initialDepartments: Departments[];
  locale: LocaleCode;
  onTranslateNo: () => Promise<void>;
  set: <K extends keyof EventUpsertInput>(
    key: K,
    value: EventUpsertInput[K]
  ) => void;
  setLocale: (locale: LocaleCode) => void;
  translating: boolean;
  values: EventUpsertInput;
}) {
  const [slugEditing, setSlugEditing] = useState(false);
  const titleValue = locale === "en" ? values.title_en : values.title_no;
  const teaserValue =
    locale === "en"
      ? (values.short_description_en ?? "")
      : (values.short_description_no ?? "");
  const teaserKey =
    locale === "en" ? "short_description_en" : "short_description_no";
  const titleKey = locale === "en" ? "title_en" : "title_no";

  function onTitleChange(value: string) {
    set(titleKey, value);
    if (!values.slug || values.slug.length === 0) {
      set("slug", generateSlug(value));
    }
  }

  function toggleTag(tag: string) {
    const current = values.tags ?? [];
    const next = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag].slice(0, 5);
    set("tags", next);
  }

  return (
    <div>
      <div style={{ padding: "8px 0 24px", position: "relative" }}>
        <LocaleTabs
          locale={locale}
          pendingNo={!values.title_no?.trim()}
          setLocale={setLocale}
        />
        <input
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="A night with a name…"
          style={{
            appearance: "none",
            background: "transparent",
            border: 0,
            color: BRAND.ink,
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 56,
            fontStyle: "normal",
            fontWeight: 400,
            letterSpacing: "-0.018em",
            lineHeight: 1,
            outline: 0,
            padding: 0,
            width: "100%",
          }}
          value={titleValue}
        />
        <div
          style={{
            alignItems: "center",
            background: BRAND.paper2,
            border: `0.5px solid ${BRAND.rule2}`,
            borderRadius: 7,
            color: BRAND.ink3,
            display: "flex",
            fontFamily: "ui-monospace, Menlo, Monaco, monospace",
            fontSize: 11.5,
            gap: 8,
            marginTop: 12,
            maxWidth: "100%",
            padding: "6px 10px",
            width: "fit-content",
          }}
        >
          <span style={{ color: BRAND.ink4 }}>biso.no/oslo/events/</span>
          {slugEditing ? (
            <input
              onBlur={() => setSlugEditing(false)}
              onChange={(event) =>
                set("slug", generateSlug(event.target.value))
              }
              style={{
                background: "transparent",
                border: 0,
                color: BRAND.ink,
                fontFamily: "ui-monospace, Menlo, Monaco, monospace",
                fontSize: 11.5,
                outline: 0,
                width: 220,
              }}
              value={values.slug}
            />
          ) : (
            <b style={{ color: BRAND.ink, fontWeight: 500 }}>
              {values.slug || "untitled-event"}
            </b>
          )}
          <button
            aria-label="Edit slug"
            onClick={() => setSlugEditing((prev) => !prev)}
            style={{
              background: "transparent",
              border: 0,
              color: BRAND.ink4,
              cursor: "pointer",
              display: "grid",
              marginLeft: 4,
              placeItems: "center",
            }}
            type="button"
          >
            <Wand2 size={11} />
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 22 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel help="Shown in lists" required>
            <CalendarDays size={12} /> Category
          </FieldLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {EVENT_CATEGORIES.map((category) => {
              const active = values.category === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => set("category", category.id)}
                  style={{
                    alignItems: "center",
                    background: active ? BRAND.ink : "rgba(255,255,255,.5)",
                    border: `0.5px solid ${active ? BRAND.ink : BRAND.rule2}`,
                    borderRadius: 999,
                    color: active ? BRAND.paper : BRAND.ink,
                    cursor: "pointer",
                    display: "flex",
                    fontSize: 13,
                    gap: 8,
                    padding: "7px 12px 7px 7px",
                    transition: "border-color .12s, background .12s",
                  }}
                  type="button"
                >
                  <span
                    style={{
                      alignItems: "center",
                      background: active
                        ? "rgba(255,255,255,.12)"
                        : BRAND.paper2,
                      borderRadius: 6,
                      color: active ? BRAND.paper : BRAND.ink,
                      display: "grid",
                      fontFamily: "'Instrument Serif', Georgia, serif",
                      fontSize: 14,
                      height: 24,
                      placeItems: "center",
                      width: 24,
                    }}
                  >
                    {category.crest}
                  </span>
                  {category.name}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <FieldLabel help="Appears under the title">
            <Users size={12} /> Hosted by
          </FieldLabel>
          <DepartmentCombobox
            campusId={values.campus_id || null}
            disabled={
              allowedDepartmentIds !== undefined &&
              allowedDepartmentIds.length <= 1
            }
            initialDepartments={initialDepartments}
            onChange={(id) => set("department_id", id)}
            placeholder="Search departments…"
            value={values.department_id ?? null}
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <FieldLabel>
            <MapPin size={12} /> Campus
          </FieldLabel>
          <select
            disabled={!canChangeCampus}
            onChange={(event) => set("campus_id", event.target.value)}
            style={fieldInputStyle()}
            value={values.campus_id}
          >
            <option value="">Select campus</option>
            {campuses.map((campus) => (
              <option key={campus.$id} value={campus.$id}>
                {campus.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel
            help={`${Math.max(0, 120 - teaserValue.length)} characters left`}
            required
          >
            <Languages size={12} /> One-line teaser
          </FieldLabel>
          <textarea
            maxLength={280}
            onChange={(event) => set(teaserKey, event.target.value || null)}
            placeholder="Why should a tired Tuesday-night student get on the metro for this?"
            style={fieldInputStyle({
              fontSize: 16,
              minHeight: 80,
              padding: "12px 14px",
              resize: "none",
            })}
            value={teaserValue}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel help="Up to 5 — helps the algorithm">
            <Sparkles size={12} /> Tags
          </FieldLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {TAG_OPTIONS.map((tag) => {
              const active = values.tags?.includes(tag) ?? false;
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  style={{
                    background: active ? BRAND.ink : "rgba(255,255,255,.5)",
                    border: `0.5px solid ${active ? BRAND.ink : BRAND.rule2}`,
                    borderRadius: 999,
                    color: active ? BRAND.paper : BRAND.ink,
                    cursor: "pointer",
                    fontSize: 13,
                    padding: "5px 12px",
                    transition: "border-color .12s, background .12s",
                  }}
                  type="button"
                >
                  {tag}
                </button>
              );
            })}
          </div>
          {departments.length === 0 && initialDepartments.length === 0 && null}
        </div>

        <AiCard
          body="Want me to pre-fill the tags and hint at a Kantina booking? Most ESN socials run Tuesday or Thursday evenings and reach capacity within 36 hours."
          title="This looks like a Welcome-week social."
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button
              onClick={() =>
                toast.message("Pre-fill from past socials — coming soon")
              }
              style={aiButtonStyle(true)}
              type="button"
            >
              <Sparkles size={11} /> Pre-fill from past socials
            </button>
            <button
              disabled={translating}
              onClick={onTranslateNo}
              style={aiButtonStyle()}
              type="button"
            >
              <Languages size={11} />
              {translating ? "Translating..." : "Generate Norwegian"}
            </button>
            <button
              onClick={() => toast.message("Maybe next time")}
              style={aiButtonStyle()}
              type="button"
            >
              Not now
            </button>
          </div>
        </AiCard>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Description step                              */
/* -------------------------------------------------------------------------- */

function DescriptionStep({
  blocksEn,
  blocksNo,
  locale,
  onChangeBlocksEn,
  onChangeBlocksNo,
  onSuggestRunOfShow,
  setLocale,
  suggesting,
  values,
}: {
  blocksEn: DescriptionBlock[];
  blocksNo: DescriptionBlock[];
  locale: LocaleCode;
  onChangeBlocksEn: (next: DescriptionBlock[]) => void;
  onChangeBlocksNo: (next: DescriptionBlock[]) => void;
  onSuggestRunOfShow: () => Promise<void>;
  setLocale: (locale: LocaleCode) => void;
  suggesting: boolean;
  values: EventUpsertInput;
}) {
  const blocks = locale === "en" ? blocksEn : blocksNo;
  const onChange = locale === "en" ? onChangeBlocksEn : onChangeBlocksNo;

  return (
    <div>
      <div style={{ padding: "8px 0 8px" }}>
        <LocaleTabs
          locale={locale}
          pendingNo={!values.title_no?.trim()}
          setLocale={setLocale}
        />
        <div
          style={{
            color: BRAND.ink2,
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 32,
            lineHeight: 1.1,
            marginTop: 6,
          }}
        >
          The whole night.
        </div>
        <p
          style={{
            color: BRAND.ink3,
            fontSize: 13.5,
            margin: "6px 0 0",
            maxWidth: "50ch",
          }}
        >
          Set the mood, then break down the run-of-show. Hit / for a heading or
          a bullet list. Press Enter for a new paragraph.
        </p>
      </div>

      <EventDescriptionBlockEditor blocks={blocks} onChangeBlocks={onChange} />

      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 8,
          marginTop: 14,
          padding: "6px 0",
        }}
      >
        <button
          disabled={suggesting}
          onClick={onSuggestRunOfShow}
          style={{
            ...addBtnStyle(),
            background: BRAND.ink,
            border: `0.5px solid ${BRAND.ink}`,
            color: BRAND.paper,
            opacity: suggesting ? 0.6 : 1,
          }}
          type="button"
        >
          <Sparkles size={11} />
          {suggesting ? "Suggesting..." : "Suggest run-of-show"}
        </button>
      </div>

      <div style={{ marginTop: 28 }}>
        <AiCard
          body="Most ESN socials read better with a minute-by-minute timeline near the top. I'll draft one from the bullet list below — you can edit before publish."
          title="Want a run-of-show block?"
        >
          <div style={{ display: "flex", gap: 6 }}>
            <button
              disabled={suggesting}
              onClick={onSuggestRunOfShow}
              style={aiButtonStyle(true)}
              type="button"
            >
              <Sparkles size={11} />
              {suggesting ? "Drafting..." : "Draft run-of-show"}
            </button>
            <button
              onClick={() => toast.message("Keeping the description as is")}
              style={aiButtonStyle()}
              type="button"
            >
              Keep as is
            </button>
          </div>
        </AiCard>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Schedule step                                 */
/* -------------------------------------------------------------------------- */

interface ScheduleCol {
  conn: string | null;
  isDuration?: boolean;
  label: string;
  value: string | null | undefined;
}

function ScheduleCellBody({
  col,
  endDate,
  startDate,
}: {
  col: ScheduleCol;
  endDate: string | null | undefined;
  startDate: string | null | undefined;
}) {
  if (col.isDuration) {
    return (
      <>
        <div
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 22,
            letterSpacing: "-0.01em",
            lineHeight: 1,
          }}
        >
          {col.value || "—"}
        </div>
        <div
          style={{
            color: BRAND.ink3,
            fontFamily: "ui-monospace, Menlo, Monaco, monospace",
            fontSize: 11.5,
          }}
        >
          {startDate && endDate ? "incl. setup" : "set start + end"}
        </div>
      </>
    );
  }
  if (!col.value) {
    return (
      <div style={{ color: BRAND.ink4, fontSize: 13, fontStyle: "italic" }}>
        Not set
      </div>
    );
  }
  return (
    <>
      <div
        style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontSize: 22,
          letterSpacing: "-0.01em",
          lineHeight: 1,
        }}
      >
        {formatDate(col.value)}
      </div>
      <div
        style={{
          color: BRAND.ink3,
          fontFamily: "ui-monospace, Menlo, Monaco, monospace",
          fontSize: 11.5,
        }}
      >
        {formatTime(col.value)}
      </div>
    </>
  );
}

function ScheduleStep({
  onUploadCover,
  set,
  uploading,
  values,
}: {
  onUploadCover: (file: File) => Promise<void>;
  set: <K extends keyof EventUpsertInput>(
    key: K,
    value: EventUpsertInput[K]
  ) => void;
  uploading: boolean;
  values: EventUpsertInput;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <div style={{ padding: "8px 0 18px" }}>
        <div
          style={{
            color: BRAND.ink,
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 40,
            letterSpacing: "-0.015em",
            lineHeight: 1.05,
          }}
        >
          When, where, how many.
        </div>
        <p
          style={{
            color: BRAND.ink3,
            fontSize: 13.5,
            margin: "8px 0 0",
            maxWidth: "50ch",
          }}
        >
          Once the date is in, calendar buttons and reminders wire themselves up
          automatically. Capacity sets the cut-off for the waitlist.
        </p>
      </div>

      <div
        style={{
          background: "rgba(255,255,255,.55)",
          border: `0.5px solid ${BRAND.rule2}`,
          borderRadius: 12,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          margin: "0 0 18px",
          overflow: "hidden",
        }}
      >
        {[
          { label: "Doors open", value: values.start_date, conn: "→" },
          { label: "Wraps up", value: values.end_date, conn: "·" },
          {
            label: "Duration",
            value: durationHours(values.start_date, values.end_date),
            conn: null,
            isDuration: true,
          },
        ].map((col) => (
          <div
            key={col.label}
            style={{
              borderRight: col.conn ? `0.5px solid ${BRAND.rule}` : 0,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              padding: "14px 18px",
              position: "relative",
            }}
          >
            <div
              style={{
                color: BRAND.ink4,
                fontSize: 10.5,
                letterSpacing: ".06em",
                textTransform: "uppercase",
              }}
            >
              {col.label}
            </div>
            <ScheduleCellBody
              col={col}
              endDate={values.end_date}
              startDate={values.start_date}
            />

            {col.conn && (
              <span
                style={{
                  alignItems: "center",
                  background: BRAND.paper,
                  border: `0.5px solid ${BRAND.rule2}`,
                  borderRadius: "50%",
                  color: BRAND.ink4,
                  display: "grid",
                  fontSize: 8,
                  height: 12,
                  placeItems: "center",
                  position: "absolute",
                  right: -6,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 12,
                  zIndex: 2,
                }}
              >
                {col.conn}
              </span>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: 22 }}>
        <div
          style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <FieldLabel required>
              <CalendarDays size={12} /> Start
            </FieldLabel>
            <input
              onChange={(event) =>
                set("start_date", event.target.value || null)
              }
              style={fieldInputStyle()}
              type="datetime-local"
              value={toDateTimeInput(values.start_date)}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <FieldLabel>
              <CalendarDays size={12} /> End
            </FieldLabel>
            <input
              onChange={(event) => set("end_date", event.target.value || null)}
              style={fieldInputStyle()}
              type="datetime-local"
              value={toDateTimeInput(values.end_date)}
            />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>
            <CalendarDays size={12} /> Registration closes
          </FieldLabel>
          <input
            onChange={(event) =>
              set("registration_deadline", event.target.value || null)
            }
            style={fieldInputStyle()}
            type="datetime-local"
            value={toDateTimeInput(values.registration_deadline)}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>
            <MapPin size={12} /> Where is it
          </FieldLabel>
          <div style={{ display: "flex", gap: 6 }}>
            {LOCATION_MODES.map((mode) => {
              const active = values.location_mode === mode.id;
              let Icon: typeof Globe = MapPin;
              if (mode.id === EventLocationMode.ONLINE) {
                Icon = Globe;
              } else if (mode.id === EventLocationMode.HYBRID) {
                Icon = Link2;
              }
              return (
                <button
                  key={mode.id}
                  onClick={() => set("location_mode", mode.id)}
                  style={{
                    alignItems: "center",
                    background: active ? BRAND.ink : "rgba(255,255,255,.5)",
                    border: `0.5px solid ${active ? BRAND.ink : BRAND.rule2}`,
                    borderRadius: 10,
                    color: active ? BRAND.paper : BRAND.ink,
                    cursor: "pointer",
                    display: "flex",
                    flex: 1,
                    gap: 10,
                    padding: "10px 12px",
                    textAlign: "left",
                    transition: "background .12s, border-color .12s",
                  }}
                  type="button"
                >
                  <span
                    style={{
                      alignItems: "center",
                      background: active
                        ? "rgba(255,255,255,.12)"
                        : BRAND.paper2,
                      borderRadius: 8,
                      color: active ? BRAND.paper : BRAND.ink2,
                      display: "grid",
                      height: 28,
                      placeItems: "center",
                      width: 28,
                    }}
                  >
                    <Icon size={14} />
                  </span>
                  <div>
                    <b style={{ fontSize: 13, fontWeight: 500 }}>
                      {mode.label}
                    </b>
                    <span
                      style={{
                        color: active ? "rgba(250,247,242,.7)" : BRAND.ink3,
                        display: "block",
                        fontSize: 11,
                      }}
                    >
                      {mode.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {values.location_mode !== EventLocationMode.ONLINE && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <FieldLabel>
              <MapPin size={12} /> Venue address
            </FieldLabel>
            <input
              onChange={(event) => set("location", event.target.value || null)}
              placeholder="BI Oslo · Kantina (Nydalen)"
              style={fieldInputStyle()}
              value={values.location ?? ""}
            />
          </div>
        )}

        {values.location_mode !== EventLocationMode.PHYSICAL && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <FieldLabel help="Sent on registration">
              <Link2 size={12} /> Online link
            </FieldLabel>
            <input
              onChange={(event) =>
                set("online_url", event.target.value || null)
              }
              placeholder="https://teams.microsoft.com/l/…"
              style={fieldInputStyle()}
              value={values.online_url ?? ""}
            />
          </div>
        )}

        <div
          style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <FieldLabel>
              <Users size={12} /> Capacity
            </FieldLabel>
            <div
              style={{
                alignItems: "stretch",
                background: "rgba(255,255,255,.55)",
                border: `0.5px solid ${BRAND.rule2}`,
                borderRadius: 10,
                display: "flex",
                overflow: "hidden",
                width: "fit-content",
              }}
            >
              <button
                aria-label="Decrease capacity"
                onClick={() =>
                  set("capacity", Math.max(0, (values.capacity ?? 0) - 10))
                }
                style={capStepperBtn(true)}
                type="button"
              >
                −
              </button>
              <input
                aria-label="Capacity"
                onChange={(event) => {
                  const parsed = Number.parseInt(event.target.value || "0", 10);
                  set("capacity", Number.isFinite(parsed) ? parsed : 0);
                }}
                style={{
                  appearance: "none",
                  background: "transparent",
                  border: 0,
                  color: BRAND.ink,
                  fontFamily: "ui-monospace, Menlo, Monaco, monospace",
                  fontSize: 18,
                  outline: 0,
                  textAlign: "center",
                  width: 80,
                }}
                type="number"
                value={values.capacity ?? 0}
              />
              <button
                aria-label="Increase capacity"
                onClick={() => set("capacity", (values.capacity ?? 0) + 10)}
                style={capStepperBtn(false)}
                type="button"
              >
                +
              </button>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <FieldLabel>
              <Bell size={12} /> Waitlist
            </FieldLabel>
            <ToggleCard
              active={values.waitlist ?? false}
              description={
                values.waitlist
                  ? "Students can join a waitlist once capacity is reached."
                  : "Registration simply closes when capacity is reached."
              }
              icon={<Bell size={14} />}
              onClick={() => set("waitlist", !values.waitlist)}
              title={values.waitlist ? "Waitlist on" : "Waitlist off"}
            />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>
            <Upload size={12} /> Cover artwork
          </FieldLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {COVER_PATTERNS.map((pattern) => {
              const active = values.cover_pattern === pattern.id;
              return (
                <button
                  key={pattern.id}
                  onClick={() => set("cover_pattern", pattern.id)}
                  style={{
                    background: coverBackground(pattern.id),
                    border: `1.5px solid ${active ? BRAND.ink : "transparent"}`,
                    borderRadius: 8,
                    cursor: "pointer",
                    height: 60,
                    overflow: "hidden",
                    padding: 0,
                    position: "relative",
                    transition: "border-color .12s",
                    width: 88,
                  }}
                  type="button"
                >
                  <EvCoverPattern which={coverPatternToNumber(pattern.id)} />
                  <span
                    style={{
                      bottom: 4,
                      color: "white",
                      fontSize: 9,
                      left: 6,
                      opacity: 0.8,
                      position: "absolute",
                    }}
                  >
                    {pattern.label}
                  </span>
                </button>
              );
            })}
            <input
              accept="image/*"
              hidden
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) {
                  await onUploadCover(file);
                }
              }}
              ref={fileInputRef}
              type="file"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                alignItems: "center",
                background: BRAND.paper2,
                border: `1.5px dashed ${BRAND.rule2}`,
                borderRadius: 8,
                color: BRAND.ink3,
                cursor: "pointer",
                display: "grid",
                height: 60,
                placeItems: "center",
                width: 88,
              }}
              type="button"
            >
              {uploading ? (
                <span style={{ fontSize: 10 }}>Uploading</span>
              ) : (
                <Upload size={16} />
              )}
            </button>
          </div>
          {values.image && (
            <div
              style={{
                alignItems: "center",
                background: "rgba(255,255,255,.6)",
                border: `0.5px solid ${BRAND.rule2}`,
                borderRadius: 10,
                display: "flex",
                gap: 12,
                marginTop: 8,
                padding: 10,
              }}
            >
              <div
                style={{
                  backgroundImage: `url(${values.image})`,
                  backgroundPosition: "center",
                  backgroundSize: "cover",
                  borderRadius: 8,
                  height: 48,
                  width: 72,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>
                  Custom cover image
                </p>
                <p
                  style={{
                    color: BRAND.ink4,
                    fontSize: 11,
                    margin: "2px 0 0",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {values.image}
                </p>
              </div>
              <button
                onClick={() => {
                  set("image", null);
                  set("cover_pattern", EventCoverPattern.DOTTED);
                }}
                style={{
                  background: "transparent",
                  border: `0.5px solid ${BRAND.rule2}`,
                  borderRadius: 6,
                  color: BRAND.ink3,
                  cursor: "pointer",
                  fontSize: 11,
                  padding: "5px 10px",
                }}
                type="button"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function capStepperBtn(left: boolean): React.CSSProperties {
  return {
    appearance: "none",
    background: "transparent",
    border: 0,
    borderLeft: left ? 0 : `0.5px solid ${BRAND.rule2}`,
    borderRight: left ? `0.5px solid ${BRAND.rule2}` : 0,
    color: BRAND.ink3,
    cursor: "pointer",
    fontSize: 18,
    lineHeight: 1,
    width: 32,
  };
}

/* -------------------------------------------------------------------------- */
/*                              Tickets step                                  */
/* -------------------------------------------------------------------------- */

function TicketsStep({
  set,
  values,
}: {
  set: <K extends keyof EventUpsertInput>(
    key: K,
    value: EventUpsertInput[K]
  ) => void;
  values: EventUpsertInput;
}) {
  const isFree = values.pricing_mode === EventPricingMode.FREE;
  const price = values.price ?? 0;
  const memberPrice = values.member_price ?? 0;
  const memberSavings = Math.max(0, price - memberPrice);
  const estTake = Math.round(price * (values.capacity ?? 0) * 0.7);

  return (
    <div>
      <div style={{ padding: "8px 0 18px" }}>
        <div
          style={{
            color: BRAND.ink,
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 40,
            letterSpacing: "-0.015em",
            lineHeight: 1.05,
          }}
        >
          Doors, tickets, who's invited.
        </div>
        <p
          style={{
            color: BRAND.ink3,
            fontSize: 13.5,
            margin: "8px 0 0",
            maxWidth: "50ch",
          }}
        >
          Free events skip Stripe entirely. Paid events route through the
          existing BISO Webshop and apply member pricing automatically.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gap: 18,
          gridTemplateColumns: "1fr 1fr",
          marginBottom: 22,
        }}
      >
        <ToggleCard
          active={isFree}
          description="No payment. Sign-ups are first-come, first-served. Best for socials, talks and casual mixers."
          icon={<Sparkles size={14} />}
          onClick={() => set("pricing_mode", EventPricingMode.FREE)}
          title="Free"
        />
        <ToggleCard
          active={!isFree}
          description="Routes through the BISO Webshop. Members get the member price; everyone else pays the regular price."
          icon={<Save size={14} />}
          onClick={() => set("pricing_mode", EventPricingMode.PAID)}
          title="Paid ticket"
        />
      </div>

      {!isFree && (
        <div
          style={{
            background: "rgba(255,255,255,.55)",
            border: `0.5px solid ${BRAND.rule2}`,
            borderRadius: 12,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginBottom: 22,
            padding: "14px 16px",
          }}
        >
          <div style={{ alignItems: "baseline", display: "flex", gap: 14 }}>
            <div
              style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: 38,
                letterSpacing: "-0.015em",
                lineHeight: 1,
              }}
            >
              {formatNOK(price)}
            </div>
            <div style={{ color: BRAND.ink3, fontSize: 12.5 }}>
              regular ticket
            </div>
            {memberPrice > 0 && memberPrice < price && (
              <>
                <div
                  style={{
                    color: BRAND.leaf,
                    fontFamily: "'Instrument Serif', Georgia, serif",
                    fontSize: 26,
                    letterSpacing: "-0.015em",
                    lineHeight: 1,
                  }}
                >
                  {formatNOK(memberPrice)}
                </div>
                <div style={{ color: BRAND.ink3, fontSize: 12.5 }}>members</div>
              </>
            )}
          </div>
          <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
            <label
              htmlFor="ev-regular-price"
              style={{ color: BRAND.ink3, fontSize: 11.5, width: 110 }}
            >
              Regular price
            </label>
            <input
              id="ev-regular-price"
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value || "0", 10);
                set("price", Number.isFinite(parsed) ? parsed : 0);
              }}
              style={{
                background: "white",
                border: `0.5px solid ${BRAND.rule2}`,
                borderRadius: 6,
                fontFamily: "ui-monospace, Menlo, Monaco, monospace",
                fontSize: 13,
                outline: 0,
                padding: "6px 10px",
                width: 120,
              }}
              type="number"
              value={values.price ?? 0}
            />
            <span style={{ color: BRAND.ink4, fontSize: 11 }}>
              NOK incl. VAT
            </span>
          </div>
          <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
            <label
              htmlFor="ev-member-price"
              style={{ color: BRAND.ink3, fontSize: 11.5, width: 110 }}
            >
              Member price
            </label>
            <input
              id="ev-member-price"
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value || "0", 10);
                set("member_price", Number.isFinite(parsed) ? parsed : 0);
              }}
              style={{
                background: "white",
                border: `0.5px solid ${BRAND.rule2}`,
                borderRadius: 6,
                fontFamily: "ui-monospace, Menlo, Monaco, monospace",
                fontSize: 13,
                outline: 0,
                padding: "6px 10px",
                width: 120,
              }}
              type="number"
              value={values.member_price ?? 0}
            />
            <span style={{ color: BRAND.ink4, fontSize: 11 }}>
              NOK · 0 = same as regular
            </span>
          </div>
          <div
            style={{
              background: BRAND.paper2,
              borderRadius: 8,
              color: BRAND.ink3,
              fontSize: 11.5,
              padding: "8px 12px",
            }}
          >
            BISO members save <b>{formatNOK(memberSavings)}</b> per ticket.
            Estimated take: <b>{formatNOK(estTake)}</b> at 70% fill.
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 18, gridTemplateColumns: "1fr 1fr" }}>
        <ToggleCard
          active={values.member_only ?? false}
          description="Only verified BISO members can register. Best for paid socials and members-only mixers."
          icon={<Lock size={14} />}
          onClick={() => set("member_only", true)}
          title="Members only"
        />
        <ToggleCard
          active={!values.member_only}
          description="Anyone with a BI email can register. Recommended for first-week orientation events."
          icon={<Globe size={14} />}
          onClick={() => set("member_only", false)}
          title="Open to all BI students"
        />
        <ToggleCard
          active={values.is_collection ?? false}
          description="Group this with other events in a collection — students get one bundle ticket and a unified landing page."
          icon={<List size={14} />}
          onClick={() => set("is_collection", !values.is_collection)}
          title="Part of a series"
        />
        <ToggleCard
          active={values.notify_push ?? false}
          description={`Notify ${PUSH_FOLLOWERS.toLocaleString("en-GB")} students who follow this tag. Sends once when published.`}
          icon={<Bell size={14} />}
          onClick={() => set("notify_push", !values.notify_push)}
          title="Push notification"
        />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          marginTop: 18,
        }}
      >
        <FieldLabel>
          <CalendarDays size={12} /> Publish schedule
        </FieldLabel>
        <div
          style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}
        >
          <ToggleCard
            active={values.publish_mode === EventPublishMode.NOW}
            icon={<ArrowRight size={12} />}
            onClick={() => set("publish_mode", EventPublishMode.NOW)}
            title="Publish now"
          />
          <ToggleCard
            active={values.publish_mode === EventPublishMode.SCHEDULED}
            icon={<CalendarDays size={12} />}
            onClick={() => set("publish_mode", EventPublishMode.SCHEDULED)}
            title="Schedule for…"
          />
        </div>
        {values.publish_mode === EventPublishMode.SCHEDULED && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              marginTop: 8,
            }}
          >
            <FieldLabel>
              <CalendarDays size={12} /> Scheduled publish time
            </FieldLabel>
            <input
              onChange={(event) =>
                set("scheduled_publish_at", event.target.value || null)
              }
              style={fieldInputStyle()}
              type="datetime-local"
              value={toDateTimeInput(values.scheduled_publish_at)}
            />
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          marginTop: 18,
        }}
      >
        <FieldLabel>
          <Users size={12} /> Point of contact
        </FieldLabel>
        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "1fr 1fr 1fr",
          }}
        >
          <input
            onChange={(event) =>
              set("contact_name", event.target.value || null)
            }
            placeholder="Name"
            style={fieldInputStyle()}
            value={values.contact_name ?? ""}
          />
          <input
            onChange={(event) =>
              set("contact_role", event.target.value || null)
            }
            placeholder="Role"
            style={fieldInputStyle()}
            value={values.contact_role ?? ""}
          />
          <input
            onChange={(event) =>
              set("contact_email", event.target.value || null)
            }
            placeholder="Email"
            style={fieldInputStyle()}
            type="email"
            value={values.contact_email ?? ""}
          />
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <AiCard
          body="GDPR consent text auto-attached · Inclusive language score 9.4/10 · No restricted partners detected."
          gemColor="linear-gradient(135deg, #2f5d3a, #4a8359)"
          title="This event meets BISO publishing standards."
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Review step                                 */
/* -------------------------------------------------------------------------- */

function ReviewStep({
  blocksEn,
  departments,
  setStep,
  values,
}: {
  blocksEn: DescriptionBlock[];
  departments: Departments[];
  setStep: (step: StepIndex) => void;
  values: EventUpsertInput;
}) {
  const department = departments.find((d) => d.$id === values.department_id);
  const category = EVENT_CATEGORIES.find((c) => c.id === values.category);
  const teaser =
    values.short_description_en ?? values.short_description_no ?? null;

  const rows: Array<{ label: string; value: string | null; step: StepIndex }> =
    [
      { label: "Title (EN)", value: values.title_en || null, step: 0 },
      { label: "Title (NO)", value: values.title_no || null, step: 0 },
      {
        label: "Category · Host",
        value: `${category?.name ?? "—"} · ${department?.Name ?? "—"}`,
        step: 0,
      },
      { label: "Teaser", value: teaser, step: 0 },
      {
        label: "Description",
        value: `${blocksEn.filter((b) => b.text.trim().length > 0).length} blocks`,
        step: 1,
      },
      {
        label: "When",
        value: values.start_date
          ? `${formatDate(values.start_date)} · ${formatTime(values.start_date)} → ${formatTime(values.end_date)} (${durationHours(values.start_date, values.end_date) ?? "—"})`
          : null,
        step: 2,
      },
      {
        label: "Where",
        value:
          values.location_mode === EventLocationMode.ONLINE
            ? "Online"
            : (values.location ?? null),
        step: 2,
      },
      {
        label: "Capacity",
        value: `${values.capacity ?? 0}${values.waitlist ? " · waitlist on" : ""}`,
        step: 2,
      },
      {
        label: "Price",
        value:
          values.pricing_mode === EventPricingMode.FREE
            ? "Free"
            : `${formatNOK(values.price)} · ${formatNOK(values.member_price)} for members`,
        step: 3,
      },
      {
        label: "Audience",
        value: values.member_only
          ? `Members only · ${PUSH_FOLLOWERS.toLocaleString("en-GB")} students`
          : `All BI students · ${STUDENT_POPULATION.toLocaleString("en-GB")} students`,
        step: 3,
      },
      {
        label: "Series",
        value: values.is_collection ? "Yes" : "No",
        step: 3,
      },
      {
        label: "Contact",
        value:
          values.contact_name || values.contact_email
            ? `${values.contact_name ?? "No name"} (${values.contact_email ?? "no email"})`
            : null,
        step: 3,
      },
    ];

  return (
    <div>
      <div style={{ padding: "8px 0 18px" }}>
        <div
          style={{
            color: BRAND.ink,
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 40,
            letterSpacing: "-0.015em",
            lineHeight: 1.05,
          }}
        >
          One last look.
        </div>
        <p
          style={{
            color: BRAND.ink3,
            fontSize: 13.5,
            margin: "8px 0 0",
            maxWidth: "50ch",
          }}
        >
          Click any row to jump back and edit. When you're happy, hit Publish —
          the event goes on biso.no and the BISO app at the same moment.
        </p>
      </div>

      <div
        style={{
          background: "rgba(255,255,255,.5)",
          border: `0.5px solid ${BRAND.rule}`,
          borderRadius: 14,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {rows.map((row, i) => (
          <button
            key={row.label}
            onClick={() => setStep(row.step)}
            style={{
              alignItems: "center",
              background: "transparent",
              border: 0,
              borderTop: i > 0 ? `0.5px solid ${BRAND.rule}` : 0,
              cursor: "pointer",
              display: "grid",
              gap: 14,
              gridTemplateColumns: "160px 1fr auto",
              padding: "14px 18px",
              textAlign: "left",
              width: "100%",
            }}
            type="button"
          >
            <span
              style={{
                color: BRAND.ink3,
                fontSize: 11.5,
                letterSpacing: ".04em",
                textTransform: "uppercase",
              }}
            >
              {row.label}
            </span>
            <span
              style={{
                color: row.value ? BRAND.ink : BRAND.ink4,
                fontSize: 14,
                fontStyle: row.value ? "normal" : "italic",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {row.value ?? "Not set"}
            </span>
            <Wand2 size={13} style={{ color: BRAND.ink4 }} />
          </button>
        ))}
      </div>

      <div style={{ marginTop: 18 }}>
        <AiCard
          body="The Norwegian translation hasn't been reviewed yet — students switching to NO will see the AI version. Also: registration closes the night before doors — students who decide late might miss the cutoff."
          gemColor="linear-gradient(135deg, #6b1e1e, #b04545)"
          title="Two reminders before you publish."
        >
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => toast.message("Open NO translation review")}
              style={aiButtonStyle()}
              type="button"
            >
              Review NO translation
            </button>
            <button
              onClick={() => toast.message("Push registration cutoff")}
              style={aiButtonStyle()}
              type="button"
            >
              Push registration cutoff
            </button>
          </div>
        </AiCard>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Action bar                                  */
/* -------------------------------------------------------------------------- */

function ActionBar({
  dirty,
  onDraft,
  onPublish,
  setStep,
  step,
  submitting,
  values,
}: {
  dirty: boolean;
  onDraft: () => void;
  onPublish: () => void;
  setStep: (step: StepIndex) => void;
  step: StepIndex;
  submitting: boolean;
  values: EventUpsertInput;
}) {
  const filled = [
    Boolean(values.title_en?.trim()),
    Boolean(values.title_no?.trim()),
    Boolean(values.category),
    Boolean(values.start_date),
    (values.capacity ?? 0) > 0,
    Boolean(stripHtml(values.description_en ?? "").length),
    Boolean(values.department_id),
  ];
  const progress = Math.round(
    (filled.filter(Boolean).length / filled.length) * 100
  );
  const nextStepName = step < STEPS.length - 1 ? STEPS[step + 1] : null;

  return (
    <div
      style={{
        alignItems: "center",
        backdropFilter: "blur(14px)",
        background: "rgba(250,247,242,.92)",
        borderTop: `0.5px solid ${BRAND.rule}`,
        bottom: 0,
        display: "flex",
        gap: 10,
        marginTop: "auto",
        padding: "14px 36px",
        position: "sticky",
        WebkitBackdropFilter: "blur(14px)",
        zIndex: 8,
      }}
    >
      <div
        style={{
          alignItems: "center",
          color: BRAND.ink3,
          display: "flex",
          fontSize: 12,
          gap: 10,
        }}
      >
        <span>Completeness</span>
        <div
          style={{
            background: BRAND.paper3,
            borderRadius: 999,
            height: 4,
            overflow: "hidden",
            width: 140,
          }}
        >
          <span
            style={{
              background: BRAND.ink,
              display: "block",
              height: "100%",
              transition: "width .4s",
              width: `${progress}%`,
            }}
          />
        </div>
        <span
          style={{
            fontFamily: "ui-monospace, Menlo, Monaco, monospace",
            fontSize: 11.5,
          }}
        >
          {progress}%
        </span>
        {dirty && (
          <span style={{ color: BRAND.gold, fontSize: 11 }}>· Unsaved</span>
        )}
      </div>
      <div style={{ flex: 1 }} />
      <button
        onClick={() => toast.message("Preview is in the right pane")}
        style={actionBtnStyle()}
        type="button"
      >
        <Globe size={13} /> Preview as student
      </button>
      <button
        disabled={submitting}
        onClick={onDraft}
        style={actionBtnStyle()}
        type="button"
      >
        <Save size={13} />
        {submitting ? "Saving..." : "Save as draft"}
      </button>
      {step > 0 && (
        <button
          onClick={() => setStep((step - 1) as StepIndex)}
          style={actionBtnStyle()}
          type="button"
        >
          Back
        </button>
      )}
      {step < STEPS.length - 1 ? (
        <button
          onClick={() => setStep((step + 1) as StepIndex)}
          style={{
            ...actionBtnStyle(),
            background: BRAND.ink,
            border: `0.5px solid ${BRAND.ink}`,
            color: BRAND.paper,
            padding: "9px 18px",
          }}
          type="button"
        >
          Continue · {nextStepName} <ArrowRight size={14} />
        </button>
      ) : (
        <button
          disabled={submitting}
          onClick={onPublish}
          style={{
            ...actionBtnStyle(),
            background: BRAND.ink,
            border: `0.5px solid ${BRAND.ink}`,
            color: BRAND.paper,
            padding: "9px 18px",
          }}
          type="button"
        >
          <Send size={13} />
          {submitting ? "Publishing..." : "Publish event"}
        </button>
      )}
    </div>
  );
}

function actionBtnStyle(): React.CSSProperties {
  return {
    alignItems: "center",
    background: "rgba(255,255,255,.7)",
    border: `0.5px solid ${BRAND.rule2}`,
    borderRadius: 8,
    color: BRAND.ink,
    cursor: "pointer",
    display: "flex",
    fontSize: 13,
    fontWeight: 500,
    gap: 6,
    padding: "9px 16px",
  };
}

/* -------------------------------------------------------------------------- */
/*                              Event preview pane                            */
/* -------------------------------------------------------------------------- */

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Phone preview composes many small visual elements that are clearer when colocated than split across components.
function EventPreviewPane({
  blocksEn,
  blocksNo,
  campuses,
  departments,
  draft,
  locale,
  setLocale,
}: {
  blocksEn: DescriptionBlock[];
  blocksNo: DescriptionBlock[];
  campuses: Campus[];
  departments: Departments[];
  draft: EventUpsertInput;
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
}) {
  const department = departments.find((d) => d.$id === draft.department_id);
  const campus = campuses.find((c) => c.$id === draft.campus_id);
  const category = EVENT_CATEGORIES.find((c) => c.id === draft.category);
  const title = locale === "no" ? draft.title_no : draft.title_en;
  const short =
    locale === "no" ? draft.short_description_no : draft.short_description_en;
  const descBlocks = locale === "no" ? blocksNo : blocksEn;
  const dur = durationHours(draft.start_date, draft.end_date);
  const capacity = draft.capacity ?? 0;
  const registered = capacity > 0 ? Math.round(capacity * 0.62) : 0;
  const ratio = capacity > 0 ? registered / capacity : 0;
  const seatsLeft = capacity > 0 ? Math.max(0, capacity - registered) : null;
  const price =
    draft.pricing_mode === EventPricingMode.FREE ? 0 : (draft.price ?? 0);
  const year = draft.start_date ? new Date(draft.start_date).getFullYear() : "";
  const audience = draft.member_only ? PUSH_FOLLOWERS : STUDENT_POPULATION;
  const audienceLabel = draft.member_only
    ? "with active BISO membership"
    : `on the ${campus?.name ?? "campus"}`;
  const coverWhich = coverPatternToNumber(draft.cover_pattern);
  let capacityBarColor: string = BRAND.leaf;
  if (ratio >= 0.95) {
    capacityBarColor = BRAND.claret;
  } else if (ratio >= 0.75) {
    capacityBarColor = BRAND.gold;
  }

  return (
    <div
      style={{
        background: "linear-gradient(180deg, #efe7d4 0%, #e6dcc2 100%)",
        borderLeft: `0.5px solid ${BRAND.rule}`,
        display: "flex",
        flex: 1,
        flexDirection: "column",
        minWidth: 0,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          alignItems: "center",
          backdropFilter: "blur(8px)",
          background: "rgba(250,247,242,.5)",
          borderBottom: `0.5px solid ${BRAND.rule}`,
          display: "flex",
          flexWrap: "nowrap",
          fontSize: 12.5,
          gap: 8,
          overflow: "hidden",
          padding: "12px 16px",
          position: "relative",
          WebkitBackdropFilter: "blur(8px)",
          zIndex: 2,
        }}
      >
        <span
          style={{
            alignItems: "center",
            color: BRAND.leaf,
            display: "flex",
            flexShrink: 0,
            fontSize: 11.5,
            fontWeight: 500,
            gap: 6,
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              animation: "ev-pulse 1.8s infinite",
              background: BRAND.leaf,
              borderRadius: "50%",
              height: 6,
              width: 6,
            }}
          />
          Live preview
        </span>
        <span
          style={{
            color: BRAND.ink3,
            flexShrink: 0,
            fontSize: 11.5,
            letterSpacing: ".05em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          As students see it
        </span>
        <div style={{ flex: 1 }} />
        <div
          style={{
            background: "rgba(255,255,255,.5)",
            border: `0.5px solid ${BRAND.rule2}`,
            borderRadius: 7,
            display: "flex",
            flexShrink: 0,
            padding: 2,
          }}
        >
          {(["en", "no"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setLocale(item)}
              style={{
                background: locale === item ? "white" : "transparent",
                border: 0,
                borderRadius: 5,
                color: locale === item ? BRAND.ink : BRAND.ink3,
                cursor: "pointer",
                fontSize: 10.5,
                fontWeight: 500,
                padding: "0 8px",
              }}
              type="button"
            >
              {item.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flex: 1,
          justifyContent: "center",
          minHeight: 0,
          padding: 24,
          position: "relative",
        }}
      >
        <div
          style={{
            animation: "ev-drift 8s ease-in-out infinite",
            background: BRAND.ink,
            borderRadius: 38,
            boxShadow:
              "0 0 0 0.5px rgba(0,0,0,.15), 0 30px 60px -20px rgba(26,24,20,.45), 0 8px 20px rgba(26,24,20,.18), inset 0 0 0 0.5px rgba(255,255,255,.06)",
            height: 640,
            padding: 7,
            position: "relative",
            width: 314,
          }}
        >
          <div
            aria-hidden
            style={{
              background: "#000",
              borderRadius: 14,
              height: 26,
              left: "50%",
              position: "absolute",
              top: 14,
              transform: "translateX(-50%)",
              width: 90,
              zIndex: 10,
            }}
          />
          <div
            style={{
              background: BRAND.paper,
              borderRadius: 30,
              display: "flex",
              flexDirection: "column",
              height: "100%",
              overflow: "hidden",
              position: "relative",
              width: "100%",
            }}
          >
            <div
              style={{
                alignItems: "center",
                color: BRAND.ink,
                display: "flex",
                fontSize: 11,
                fontWeight: 600,
                justifyContent: "space-between",
                padding: "12px 20px 6px",
              }}
            >
              <span>09:41</span>
              <div style={{ alignItems: "center", display: "flex", gap: 4 }}>
                <div
                  style={{
                    alignItems: "flex-end",
                    display: "flex",
                    gap: 1.5,
                  }}
                >
                  {[3, 5, 7, 9].map((h) => (
                    <span
                      key={h}
                      style={{
                        background: BRAND.ink,
                        borderRadius: 1,
                        height: h,
                        width: 2.5,
                      }}
                    />
                  ))}
                </div>
                <div
                  style={{
                    border: `1px solid ${BRAND.ink}`,
                    borderRadius: 3,
                    height: 10,
                    position: "relative",
                    width: 22,
                  }}
                >
                  <span
                    style={{
                      background: BRAND.ink,
                      borderRadius: 1.5,
                      display: "block",
                      height: "100%",
                      width: "70%",
                    }}
                  />
                </div>
              </div>
            </div>
            <div
              style={{
                alignItems: "center",
                color: BRAND.ink3,
                display: "flex",
                fontSize: 12.5,
                gap: 8,
                padding: "4px 14px 10px",
              }}
            >
              <span
                style={{
                  alignItems: "center",
                  background: BRAND.paper2,
                  borderRadius: "50%",
                  display: "grid",
                  height: 28,
                  placeItems: "center",
                  width: 28,
                }}
              >
                <ArrowLeft size={14} />
              </span>
              <span>Events</span>
              <span style={{ color: BRAND.ink4, marginLeft: "auto" }}>
                ♡ •••
              </span>
            </div>
            <div
              style={{
                flex: 1,
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  background: draft.image
                    ? `linear-gradient(135deg, rgba(0, 23, 49, 0.28), rgba(0, 10, 22, 0.52)), url(${draft.image})`
                    : coverBackground(draft.cover_pattern),
                  backgroundPosition: "center",
                  backgroundSize: "cover",
                  height: 160,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                {!draft.image && <EvCoverPattern which={coverWhich} />}
                <span
                  style={{
                    backdropFilter: "blur(8px)",
                    background: "rgba(255,255,255,.18)",
                    border: "0.5px solid rgba(255,255,255,.25)",
                    borderRadius: 999,
                    color: "white",
                    fontSize: 9,
                    left: 14,
                    letterSpacing: ".08em",
                    padding: "3px 8px",
                    position: "absolute",
                    textTransform: "uppercase",
                    top: 14,
                    WebkitBackdropFilter: "blur(8px)",
                  }}
                >
                  {draft.member_only ? "Members only" : "Open to all"}
                </span>
                {category && (
                  <span
                    style={{
                      backdropFilter: "blur(8px)",
                      background: "rgba(255,255,255,.18)",
                      border: "0.5px solid rgba(255,255,255,.25)",
                      borderRadius: 999,
                      color: "white",
                      fontSize: 9,
                      letterSpacing: ".08em",
                      padding: "3px 8px",
                      position: "absolute",
                      right: 14,
                      textTransform: "uppercase",
                      top: 14,
                      WebkitBackdropFilter: "blur(8px)",
                    }}
                  >
                    {category.name}
                  </span>
                )}
                <div
                  style={{
                    alignItems: "center",
                    background: BRAND.paper,
                    border: `0.5px solid ${BRAND.rule2}`,
                    borderRadius: 10,
                    bottom: -22,
                    boxShadow: "0 6px 16px rgba(0,0,0,.18)",
                    display: "flex",
                    flexDirection: "column",
                    fontFamily: "'Instrument Serif', Georgia, serif",
                    justifyContent: "center",
                    left: 14,
                    minHeight: 66,
                    opacity: draft.start_date ? 1 : 0.55,
                    overflow: "hidden",
                    position: "absolute",
                    width: 60,
                  }}
                >
                  <div
                    style={{
                      background: draft.start_date ? BRAND.claret : BRAND.ink4,
                      color: BRAND.paper,
                      fontFamily: "Geist, system-ui, sans-serif",
                      fontSize: 9,
                      fontWeight: 600,
                      letterSpacing: ".08em",
                      padding: "2px 0",
                      textAlign: "center",
                      textTransform: "uppercase",
                      width: "100%",
                    }}
                  >
                    {draft.start_date
                      ? formatMonthShort(draft.start_date)
                      : "tbd"}
                  </div>
                  <div
                    style={{
                      fontSize: draft.start_date ? 28 : 14,
                      fontStyle: draft.start_date ? "normal" : "italic",
                      letterSpacing: "-0.02em",
                      lineHeight: 1,
                      padding: draft.start_date ? "6px 0 4px" : "10px 0",
                      color: draft.start_date ? BRAND.ink : BRAND.ink3,
                    }}
                  >
                    {draft.start_date ? formatDayNumber(draft.start_date) : "—"}
                  </div>
                  {draft.start_date && (
                    <div
                      style={{
                        color: BRAND.ink3,
                        fontFamily: "Geist, system-ui, sans-serif",
                        fontSize: 9,
                        paddingBottom: 4,
                      }}
                    >
                      {year}
                    </div>
                  )}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 9,
                  padding: "32px 18px 8px",
                }}
              >
                <div
                  style={{
                    alignItems: "center",
                    color: BRAND.ink3,
                    display: "flex",
                    fontSize: 10.5,
                    gap: 8,
                    letterSpacing: ".03em",
                  }}
                >
                  <span>{department?.Name ?? "—"}</span>
                  <span
                    style={{
                      background: BRAND.ink4,
                      borderRadius: "50%",
                      height: 3,
                      width: 3,
                    }}
                  />
                  <span>{campus?.name ?? "—"}</span>
                  {draft.is_collection && (
                    <>
                      <span
                        style={{
                          background: BRAND.ink4,
                          borderRadius: "50%",
                          height: 3,
                          width: 3,
                        }}
                      />
                      <span style={{ color: BRAND.claret }}>Series</span>
                    </>
                  )}
                </div>
                <div
                  style={{
                    color: BRAND.ink,
                    fontFamily: "'Instrument Serif', Georgia, serif",
                    fontSize: 22,
                    fontWeight: 400,
                    letterSpacing: "-0.012em",
                    lineHeight: 1.05,
                  }}
                >
                  {title || (
                    <em style={{ color: BRAND.ink4, fontStyle: "italic" }}>
                      Your event title…
                    </em>
                  )}
                </div>
                {short && (
                  <div
                    style={{
                      color: BRAND.ink2,
                      fontSize: 11.5,
                      lineHeight: 1.5,
                    }}
                  >
                    {short}
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    margin: "6px 0 4px",
                  }}
                >
                  <div style={infoRowStyle()}>
                    <span style={infoIcStyle()}>
                      <CalendarDays size={13} />
                    </span>
                    <div
                      style={{
                        display: "flex",
                        flex: 1,
                        flexDirection: "column",
                        gap: 1,
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          color: BRAND.ink,
                          fontSize: 11.5,
                          fontWeight: 500,
                        }}
                      >
                        {formatDate(draft.start_date)}
                      </div>
                      <div style={{ color: BRAND.ink3, fontSize: 10.5 }}>
                        {formatTime(draft.start_date)} –{" "}
                        {formatTime(draft.end_date)} · {dur ?? "—"}
                      </div>
                    </div>
                  </div>
                  <div style={infoRowStyle()}>
                    <span style={infoIcStyle()}>
                      {draft.location_mode === EventLocationMode.ONLINE ? (
                        <Globe size={13} />
                      ) : (
                        <MapPin size={13} />
                      )}
                    </span>
                    <div
                      style={{
                        display: "flex",
                        flex: 1,
                        flexDirection: "column",
                        gap: 1,
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          color: BRAND.ink,
                          fontSize: 11.5,
                          fontWeight: 500,
                        }}
                      >
                        {draft.location_mode === EventLocationMode.ONLINE
                          ? "Online"
                          : (draft.location?.split("·")[0] ?? "Venue TBC")}
                      </div>
                      <div style={{ color: BRAND.ink3, fontSize: 10.5 }}>
                        {draft.location_mode === EventLocationMode.ONLINE
                          ? "Link sent on registration"
                          : (draft.location?.split("·")[1]?.trim() ?? "—")}
                      </div>
                    </div>
                  </div>
                </div>

                {capacity > 0 && (
                  <div
                    style={{
                      alignItems: "center",
                      background: "rgba(255,255,255,.5)",
                      border: `0.5px solid ${BRAND.rule2}`,
                      borderRadius: 8,
                      display: "flex",
                      gap: 10,
                      padding: "8px 10px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flex: 1,
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          alignItems: "baseline",
                          display: "flex",
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            color: BRAND.ink4,
                            fontSize: 9,
                            letterSpacing: ".06em",
                            textTransform: "uppercase",
                          }}
                        >
                          Registered
                        </span>
                        <span
                          style={{
                            color: BRAND.ink,
                            fontFamily:
                              "ui-monospace, Menlo, Monaco, monospace",
                            fontSize: 11,
                            fontWeight: 500,
                          }}
                        >
                          {registered} / {capacity}
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
                            background: capacityBarColor,
                            display: "block",
                            height: "100%",
                            width: `${ratio * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {(draft.tags?.length ?? 0) > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {draft.tags?.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          background: BRAND.paper2,
                          border: `0.5px solid ${BRAND.rule2}`,
                          borderRadius: 999,
                          color: BRAND.ink2,
                          fontSize: 9.5,
                          padding: "3px 7px",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {descBlocks.map((block) => {
                  if (block.type === "h") {
                    return (
                      <h4
                        key={block.id}
                        style={{
                          color: BRAND.ink,
                          fontFamily: "'Instrument Serif', Georgia, serif",
                          fontSize: 14,
                          fontWeight: 400,
                          lineHeight: 1.2,
                          margin: "6px 0 0",
                        }}
                      >
                        {block.text}
                      </h4>
                    );
                  }
                  if (block.type === "l") {
                    return (
                      <p
                        key={block.id}
                        style={{
                          color: BRAND.ink2,
                          fontSize: 11.5,
                          lineHeight: 1.45,
                          margin: 0,
                          paddingLeft: 14,
                          position: "relative",
                        }}
                      >
                        <span
                          style={{
                            background: BRAND.claret,
                            height: 1,
                            left: 0,
                            position: "absolute",
                            top: 7,
                            width: 5,
                          }}
                        />
                        {block.text}
                      </p>
                    );
                  }
                  return (
                    <p
                      key={block.id}
                      style={{
                        color: BRAND.ink2,
                        fontSize: 11.5,
                        lineHeight: 1.55,
                        margin: 0,
                      }}
                    >
                      {block.text}
                    </p>
                  );
                })}
                <div style={{ height: 80 }} />
              </div>
              <div
                aria-hidden
                style={{
                  background: "linear-gradient(180deg, transparent, #faf7f2)",
                  bottom: 0,
                  height: 50,
                  left: 0,
                  pointerEvents: "none",
                  position: "absolute",
                  right: 0,
                  zIndex: 5,
                }}
              />
            </div>
            <div
              style={{
                backdropFilter: "blur(8px)",
                background: "rgba(250,247,242,.92)",
                borderTop: `0.5px solid ${BRAND.rule}`,
                padding: "10px 16px 14px",
                WebkitBackdropFilter: "blur(8px)",
              }}
            >
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <div>
                  <div
                    style={{
                      color: price === 0 ? BRAND.leaf : BRAND.ink,
                      fontFamily: "'Instrument Serif', Georgia, serif",
                      fontSize: 18,
                      letterSpacing: "-0.01em",
                      lineHeight: 1,
                    }}
                  >
                    {formatNOK(price)}
                  </div>
                  {price > 0 &&
                    (draft.member_price ?? 0) > 0 &&
                    (draft.member_price ?? 0) < price && (
                      <div style={{ color: BRAND.ink3, fontSize: 10.5 }}>
                        {formatNOK(draft.member_price)} for BISO members
                      </div>
                    )}
                  {price === 0 && (
                    <div style={{ color: BRAND.ink3, fontSize: 10.5 }}>
                      Bring a friend
                    </div>
                  )}
                </div>
                {seatsLeft != null && seatsLeft < 20 && seatsLeft > 0 && (
                  <div
                    style={{
                      color: BRAND.claret,
                      fontFamily: "ui-monospace, Menlo, Monaco, monospace",
                      fontSize: 10,
                    }}
                  >
                    {seatsLeft} seats left
                  </div>
                )}
              </div>
              <button
                style={{
                  appearance: "none",
                  background: BRAND.ink,
                  border: 0,
                  borderRadius: 999,
                  color: BRAND.paper,
                  cursor: "pointer",
                  fontSize: 12.5,
                  fontWeight: 500,
                  padding: 11,
                  width: "100%",
                }}
                type="button"
              >
                {draft.location_mode === EventLocationMode.ONLINE
                  ? "Reserve my spot"
                  : "Register"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        style={{
          alignItems: "center",
          background: "rgba(250,247,242,.6)",
          borderTop: `0.5px solid ${BRAND.rule}`,
          color: BRAND.ink3,
          display: "flex",
          fontSize: 11,
          gap: 10,
          padding: "10px 18px",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div style={{ alignItems: "center", display: "flex", gap: 6 }}>
          Reaches{" "}
          <b
            style={{
              color: BRAND.ink,
              fontFamily: "ui-monospace, Menlo, Monaco, monospace",
              fontWeight: 600,
            }}
          >
            {audience.toLocaleString("en-GB")}
          </b>{" "}
          students {audienceLabel}
        </div>
        <span style={{ marginLeft: "auto" }}>Auto-saved 12 sec ago</span>
      </div>
    </div>
  );
}

function infoRowStyle(): React.CSSProperties {
  return {
    alignItems: "flex-start",
    background: BRAND.paper2,
    border: `0.5px solid ${BRAND.rule2}`,
    borderRadius: 8,
    display: "flex",
    gap: 10,
    padding: "8px 10px",
  };
}

function infoIcStyle(): React.CSSProperties {
  return {
    alignItems: "center",
    background: BRAND.paper,
    border: `0.5px solid ${BRAND.rule2}`,
    borderRadius: 6,
    color: BRAND.ink2,
    display: "grid",
    flexShrink: 0,
    height: 22,
    placeItems: "center",
    width: 22,
  };
}

/* -------------------------------------------------------------------------- */
/*                                Root editor                                 */
/* -------------------------------------------------------------------------- */

export function EventStudioEditor({
  allowedDepartmentIds,
  campuses,
  canChangeCampus = true,
  defaultCampusId,
  event,
  initialDepartments,
  isNew,
  labels,
}: EventStudioEditorProps) {
  const router = useRouter();
  const [step, setStep] = useState<StepIndex>(0);
  const [locale, setLocale] = useState<LocaleCode>("en");
  const [previewLocale, setPreviewLocale] = useState<LocaleCode>("en");
  const [values, setValues] = useState<EventUpsertInput>(() => {
    const defaults = buildDefaultValues(event, campuses, defaultCampusId);
    if (!event && allowedDepartmentIds?.length === 1) {
      defaults.department_id = allowedDepartmentIds[0] ?? null;
    }
    return defaults;
  });
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [departments, setDepartments] =
    useState<Departments[]>(initialDepartments);

  const [blocksEn, setBlocksEn] = useState<DescriptionBlock[]>(() =>
    htmlToDescriptionBlocks(values.description_en ?? "")
  );
  const [blocksNo, setBlocksNo] = useState<DescriptionBlock[]>(() =>
    htmlToDescriptionBlocks(values.description_no ?? "")
  );

  useEffect(() => {
    setDepartments(initialDepartments);
  }, [initialDepartments]);

  function set<K extends keyof EventUpsertInput>(
    key: K,
    value: EventUpsertInput[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function onChangeBlocksEn(next: DescriptionBlock[]) {
    setBlocksEn(next);
    setValues((prev) => ({
      ...prev,
      description_en: descriptionBlocksToHtml(next),
    }));
    setDirty(true);
  }

  function onChangeBlocksNo(next: DescriptionBlock[]) {
    setBlocksNo(next);
    setValues((prev) => ({
      ...prev,
      description_no: descriptionBlocksToHtml(next),
    }));
    setDirty(true);
  }

  async function handleUploadCover(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    const result = await uploadMediaFile(formData);
    setUploading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    setValues((prev) => ({
      ...prev,
      cover_pattern: EventCoverPattern.CUSTOM,
      image: result.url ?? null,
    }));
    setDirty(true);
    toast.success("Cover image uploaded");
  }

  async function handleSuggestRunOfShow() {
    setSuggesting(true);
    const result = await suggestEventDescriptionSection({
      category: values.category ?? undefined,
      current_description: values.description_en ?? "",
    });
    setSuggesting(false);

    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    if (!("data" in result && result.data)) {
      toast.error("Failed to suggest a run-of-show section");
      return;
    }

    const newBlocks = htmlToDescriptionBlocks(result.data.content);
    const heading = newBlock("h", result.data.heading);
    const next = [...blocksEn, heading, ...newBlocks];
    onChangeBlocksEn(next);
    toast.success("Run-of-show added");
  }

  async function handleTranslateNo() {
    if (!(values.title_en?.trim() && values.description_en?.trim())) {
      toast.error("Add an English title and description first");
      return;
    }
    setTranslating(true);
    try {
      const result = await generateEventNorwegianDraft({
        description_en: values.description_en ?? "",
        short_description_en: values.short_description_en ?? undefined,
        title_en: values.title_en,
      });

      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if (!("data" in result && result.data)) {
        toast.error("Failed to generate Norwegian draft");
        return;
      }

      const noBlocks = htmlToDescriptionBlocks(result.data.description_no);
      setBlocksNo(noBlocks);
      setValues((prev) => ({
        ...prev,
        description_no: result.data.description_no,
        short_description_no: result.data.short_description_no,
        title_no: result.data.title_no,
      }));
      setDirty(true);
      setLocale("no");
      toast.success("Norwegian draft generated");
    } finally {
      setTranslating(false);
    }
  }

  async function submit(status: EventStatus) {
    setSubmitting(true);
    const payload: EventUpsertInput = { ...values, status };
    const validated = eventUpsertSchema.safeParse(payload);
    if (!validated.success) {
      toast.error("Please fix the form errors before continuing.");
      setSubmitting(false);
      return;
    }
    try {
      const result = isNew
        ? await createEvent(validated.data)
        : await updateEvent(event?.$id ?? "", validated.data);
      if ("error" in result && result.error) {
        toast.error(labels.saveError);
        return;
      }
      toast.success(
        status === EventStatus.PUBLISHED
          ? labels.publishSuccess
          : labels.saveSuccess
      );
      setDirty(false);
      if (isNew && "data" in result && typeof result.data === "string") {
        router.push(`/events/${result.data}`);
        return;
      }
      router.push("/events");
    } finally {
      setSubmitting(false);
    }
  }

  const campusLabel = useMemo(
    () =>
      campuses.find((campus) => campus.$id === values.campus_id)?.name ?? "—",
    [campuses, values.campus_id]
  );
  const departmentLabel = useMemo(
    () =>
      departments.find((department) => department.$id === values.department_id)
        ?.Name ?? "—",
    [departments, values.department_id]
  );

  return (
    <div
      style={{
        background: BRAND.paper,
        display: "flex",
        flexDirection: "column",
        fontFamily: "Geist, system-ui, sans-serif",
        height: "100vh",
      }}
    >
      <style>{`
        @keyframes ev-drift {
          0% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(8px, -6px) rotate(0.4deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }
        @keyframes ev-pulse {
          0% { opacity: 1; }
          50% { opacity: 0.35; }
          100% { opacity: 1; }
        }
        [contenteditable][data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: ${BRAND.ink4};
          font-style: italic;
        }
      `}</style>

      <div
        style={{
          alignItems: "center",
          borderBottom: `0.5px solid ${BRAND.rule}`,
          display: "flex",
          gap: 8,
          padding: "10px 36px",
        }}
      >
        <Link
          aria-label={labels.back}
          href="/events"
          style={{
            alignItems: "center",
            color: BRAND.ink3,
            display: "flex",
            fontSize: 12,
            gap: 6,
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={14} />
          {labels.back}
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          flex: 1,
          gridTemplateColumns: "minmax(0,1fr) minmax(360px,460px)",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: BRAND.paper,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            overflow: "auto",
            position: "relative",
          }}
        >
          <StepRail dirty={dirty} setStep={setStep} step={step} />
          <div
            style={{
              margin: "0 auto",
              maxWidth: 680,
              padding: "32px 44px 120px",
              width: "100%",
            }}
          >
            <div
              style={{
                alignItems: "center",
                display: "flex",
                gap: 12,
                marginBottom: 24,
              }}
            >
              <span
                style={{
                  color: BRAND.ink4,
                  fontSize: 11,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                }}
              >
                {departmentLabel} · {campusLabel}
              </span>
              <span
                style={{
                  background: BRAND.ink4,
                  borderRadius: "50%",
                  height: 4,
                  width: 4,
                }}
              />
              <span style={{ color: BRAND.ink3, fontSize: 12 }}>
                Step {step + 1} of {STEPS.length} · {STEPS[step]}
              </span>
            </div>

            {step === 0 && (
              <EssentialsStep
                allowedDepartmentIds={allowedDepartmentIds}
                campuses={campuses}
                canChangeCampus={canChangeCampus}
                departments={departments}
                initialDepartments={initialDepartments}
                locale={locale}
                onTranslateNo={handleTranslateNo}
                set={set}
                setLocale={setLocale}
                translating={translating}
                values={values}
              />
            )}
            {step === 1 && (
              <DescriptionStep
                blocksEn={blocksEn}
                blocksNo={blocksNo}
                locale={locale}
                onChangeBlocksEn={onChangeBlocksEn}
                onChangeBlocksNo={onChangeBlocksNo}
                onSuggestRunOfShow={handleSuggestRunOfShow}
                setLocale={setLocale}
                suggesting={suggesting}
                values={values}
              />
            )}
            {step === 2 && (
              <ScheduleStep
                onUploadCover={handleUploadCover}
                set={set}
                uploading={uploading}
                values={values}
              />
            )}
            {step === 3 && <TicketsStep set={set} values={values} />}
            {step === 4 && (
              <ReviewStep
                blocksEn={blocksEn}
                departments={departments}
                setStep={setStep}
                values={values}
              />
            )}
          </div>
          <ActionBar
            dirty={dirty}
            onDraft={() => submit(EventStatus.DRAFT)}
            onPublish={() => submit(EventStatus.PUBLISHED)}
            setStep={setStep}
            step={step}
            submitting={submitting}
            values={values}
          />
        </div>

        <EventPreviewPane
          blocksEn={blocksEn}
          blocksNo={blocksNo}
          campuses={campuses}
          departments={departments}
          draft={values}
          locale={previewLocale}
          setLocale={setPreviewLocale}
        />
      </div>

      {/* TODO(copilot): wire useAssistant from @repo/ai/hooks/use-assistant here */}
    </div>
  );
}
