"use client";

import type { Announcements } from "@repo/api/types/appwrite";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  Bus,
  CalendarDays,
  Check,
  ChevronRight,
  Globe,
  Languages,
  Link2,
  Megaphone,
  Save,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  createAnnouncement,
  generateAnnouncementNorwegianDraft,
  sendAnnouncement,
  updateAnnouncement,
} from "../../_actions/announcements";
import {
  type AnnouncementFormValues,
  announcementSchema,
} from "../../_actions/schemas";
import { DescriptionBlockEditor } from "../../_components/description-block-editor";

/* -------------------------------------------------------------------------- */
/*                              Brand + constants                             */
/* -------------------------------------------------------------------------- */

const BRAND = {
  bisoBlue: "#1A77E9",
  claret: "#6b1e1e",
  gold: "#b08a3e",
  green: "#2f5d3a",
  ink: "#1a1814",
  ink2: "#3a342a",
  ink3: "#6b6357",
  ink4: "#9c9385",
  leaf: "#2f5d3a",
  paper: "#faf7f2",
  paper2: "#f3eee5",
  paper3: "#ede6d8",
  red: "#b91c1c",
  rule: "#e5dcca",
  rule2: "#d8cdb6",
} as const;

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "ui-monospace, Menlo, Monaco, monospace";

const STEPS = ["Essentials", "Content", "Distribution", "Review"] as const;

type StepIndex = 0 | 1 | 2 | 3;
type LocaleCode = "en" | "no";

type CategoryId = AnnouncementFormValues["category"];
type AudienceType = AnnouncementFormValues["audience_type"];

const CATEGORIES: Array<{
  id: CategoryId;
  label: string;
  description: string;
  icon: typeof Megaphone;
}> = [
  {
    id: "general",
    label: "General",
    description: "Everyday updates and reminders.",
    icon: Megaphone,
  },
  {
    id: "trip",
    label: "Trip",
    description: "Travel, excursions and away events.",
    icon: Bus,
  },
  {
    id: "urgent",
    label: "Urgent",
    description: "Time-sensitive, high-priority alerts.",
    icon: AlertTriangle,
  },
  {
    id: "event",
    label: "Event",
    description: "Tied to a specific campus event.",
    icon: CalendarDays,
  },
];

const AUDIENCE_TYPES: Array<{
  id: AudienceType;
  label: string;
  description: string;
  icon: typeof Globe;
  disabledNote?: string;
}> = [
  {
    id: "broadcast",
    label: "Everyone",
    description: "Broadcast to every app user via the default topic.",
    icon: Globe,
  },
  {
    id: "topic",
    label: "Topic",
    description: "Only students subscribed to a topic channel.",
    icon: Bell,
  },
  {
    id: "users",
    label: "Specific users",
    description: "A hand-picked list of emails or user ids.",
    icon: Users,
  },
  {
    id: "segment",
    label: "Segment",
    description: "Dynamic audience segments.",
    icon: Sparkles,
    disabledNote: "Coming in Phase 2",
  },
];

const TOPIC_OPTIONS = [
  { value: "events", label: "Events" },
  { value: "products", label: "Products" },
  { value: "jobs", label: "Jobs" },
] as const;

const PUSH_PREVIEW_CHARS = 140;

interface CampusOption {
  id: string;
  name: string;
}

interface AnnouncementStudioEditorProps {
  allowGlobalCampus: boolean;
  announcement: Announcements | null;
  campuses: CampusOption[];
  defaultCampusId: string;
  isNew: boolean;
}

export type { AnnouncementStudioEditorProps };

/* -------------------------------------------------------------------------- */
/*                                  Utilities                                 */
/* -------------------------------------------------------------------------- */

const HTML_TAG_PATTERN = /<[^>]*>/g;
const WHITESPACE_PATTERN = /\s+/g;

/**
 * Flatten the editor's HTML body to a single line of plain text for the push
 * previews and audience checks. Matches the dispatch-side flattening in
 * `lib/announcements/send.ts`.
 */
function htmlToPlainText(html: string | null | undefined): string {
  if (!html) {
    return "";
  }
  return html
    .replace(/<\/(p|div|h[1-6]|li|br)>/gi, "$& ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(HTML_TAG_PATTERN, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(WHITESPACE_PATTERN, " ")
    .trim();
}

function clampText(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max).trimEnd()}…`;
}

function categoryById(id: CategoryId) {
  return CATEGORIES.find((category) => category.id === id) ?? CATEGORIES[0];
}

function categoryAccent(id: CategoryId): string {
  switch (id) {
    case "urgent":
      return BRAND.red;
    case "trip":
      return BRAND.gold;
    case "event":
      return BRAND.green;
    default:
      return BRAND.bisoBlue;
  }
}

function buildInitialValues(
  announcement: Announcements | null,
  defaultCampusId: string
): AnnouncementFormValues {
  let audienceValue = announcement?.audience_value ?? "";
  if (announcement?.audience_type === "users" && announcement.audience_value) {
    try {
      const parsed = JSON.parse(announcement.audience_value);
      if (Array.isArray(parsed)) {
        audienceValue = parsed.join(", ");
      }
    } catch {
      // leave as-is
    }
  }

  return {
    title_en: announcement?.title_en ?? "",
    title_no: announcement?.title_no ?? null,
    body_en: announcement?.body_en ?? null,
    body_no: announcement?.body_no ?? null,
    category: (announcement?.category as CategoryId) ?? "general",
    audience_type: (announcement?.audience_type as AudienceType) ?? "broadcast",
    audience_value: audienceValue,
    event_id: announcement?.event_id ?? null,
    campus_id: announcement?.campus_id ?? defaultCampusId ?? null,
    push: announcement?.push ?? true,
    scheduled_at: announcement?.scheduled_at ?? null,
  };
}

function isFutureSchedule(scheduledAt: string | null | undefined): boolean {
  if (!scheduledAt) {
    return false;
  }
  const time = new Date(scheduledAt).getTime();
  return Number.isFinite(time) && time > Date.now();
}

/* -------------------------------------------------------------------------- */
/*                              Shared primitives                             */
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
                  border: numBorder,
                  borderRadius: "50%",
                  color: numColor,
                  display: "grid",
                  fontFamily: MONO,
                  fontSize: 10.5,
                  height: 22,
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
      <div style={{ marginLeft: "auto" }}>
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

function LocaleTabs({
  locale,
  pendingNo,
  setLocale,
}: {
  locale: LocaleCode;
  pendingNo: boolean;
  setLocale: (locale: LocaleCode) => void;
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

function SelectCard({
  active,
  description,
  disabled,
  disabledNote,
  icon,
  onClick,
  title,
}: {
  active: boolean;
  description?: string;
  disabled?: boolean;
  disabledNote?: string;
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
        opacity: disabled ? 0.7 : 1,
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
      {disabledNote && (
        <span
          style={{
            background: active ? "rgba(255,255,255,.16)" : BRAND.paper2,
            borderRadius: 999,
            color: active ? BRAND.paper : BRAND.ink3,
            display: "inline-block",
            fontSize: 10,
            marginTop: 8,
            padding: "2px 8px",
          }}
        >
          {disabledNote}
        </span>
      )}
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

function AiCard({
  body,
  children,
  title,
}: {
  body: string;
  children?: React.ReactNode;
  title: string;
}) {
  return (
    <div
      style={{
        alignItems: "flex-start",
        background:
          "linear-gradient(180deg, rgba(26,119,233,0.05), rgba(26,119,233,0.02))",
        border: "0.5px dashed rgba(26,119,233,.5)",
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
          background: "linear-gradient(135deg, #1A77E9, #3DA9E0)",
          borderRadius: 8,
          boxShadow: "0 2px 4px rgba(26,119,233,.3)",
          color: "white",
          display: "grid",
          flexShrink: 0,
          height: 28,
          placeItems: "center",
          width: 28,
        }}
      >
        <Languages size={14} />
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
    background: primary ? BRAND.bisoBlue : "rgba(255,255,255,.7)",
    border: `0.5px solid ${primary ? BRAND.bisoBlue : "rgba(26,119,233,.4)"}`,
    borderRadius: 6,
    color: primary ? "white" : BRAND.ink,
    cursor: "pointer",
    display: "flex",
    fontSize: 11.5,
    gap: 4,
    padding: "5px 10px",
  };
}

function StepIntro({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ padding: "8px 0 18px" }}>
      <span
        style={{
          color: BRAND.ink4,
          fontSize: 11,
          letterSpacing: ".08em",
          textTransform: "uppercase",
        }}
      >
        {eyebrow}
      </span>
      <div
        style={{
          color: BRAND.ink,
          fontFamily: SERIF,
          fontSize: 40,
          letterSpacing: "-0.015em",
          lineHeight: 1.05,
          marginTop: 4,
        }}
      >
        {title}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Essentials step                             */
/* -------------------------------------------------------------------------- */

function EssentialsStep({
  locale,
  set,
  setLocale,
  values,
}: {
  locale: LocaleCode;
  set: <K extends keyof AnnouncementFormValues>(
    key: K,
    value: AnnouncementFormValues[K]
  ) => void;
  setLocale: (locale: LocaleCode) => void;
  values: AnnouncementFormValues;
}) {
  const titleValue =
    locale === "en" ? values.title_en : (values.title_no ?? "");
  const titleKey = locale === "en" ? "title_en" : "title_no";

  return (
    <div>
      <div style={{ padding: "8px 0 24px" }}>
        <LocaleTabs
          locale={locale}
          pendingNo={!values.title_no?.trim()}
          setLocale={setLocale}
        />
        <input
          onChange={(event) =>
            set(
              titleKey,
              locale === "en" ? event.target.value : event.target.value || null
            )
          }
          placeholder={
            locale === "en"
              ? "A headline students can't miss…"
              : "En overskrift studentene ikke kan overse…"
          }
          style={{
            appearance: "none",
            background: "transparent",
            border: 0,
            color: BRAND.ink,
            fontFamily: SERIF,
            fontSize: 52,
            fontWeight: 400,
            letterSpacing: "-0.018em",
            lineHeight: 1.02,
            outline: 0,
            padding: 0,
            width: "100%",
          }}
          value={titleValue}
        />
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <FieldLabel help="Sets the icon and accent" required>
          <Megaphone size={12} /> Category
        </FieldLabel>
        <div
          style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}
        >
          {CATEGORIES.map((category) => {
            const Icon = category.icon;
            return (
              <SelectCard
                active={values.category === category.id}
                description={category.description}
                icon={<Icon size={14} />}
                key={category.id}
                onClick={() => set("category", category.id)}
                title={category.label}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 Content step                               */
/* -------------------------------------------------------------------------- */

function ContentStep({
  locale,
  onTranslateNo,
  set,
  setLocale,
  translating,
  values,
}: {
  locale: LocaleCode;
  onTranslateNo: () => Promise<void>;
  set: <K extends keyof AnnouncementFormValues>(
    key: K,
    value: AnnouncementFormValues[K]
  ) => void;
  setLocale: (locale: LocaleCode) => void;
  translating: boolean;
  values: AnnouncementFormValues;
}) {
  const bodyValue = locale === "en" ? values.body_en : values.body_no;
  const bodyKey = locale === "en" ? "body_en" : "body_no";

  return (
    <div>
      <StepIntro eyebrow="Step 2" title="The message." />
      <LocaleTabs
        locale={locale}
        pendingNo={!values.body_no?.trim()}
        setLocale={setLocale}
      />
      <DescriptionBlockEditor
        onChange={(value) => set(bodyKey, value || null)}
        placeholder={
          locale === "en"
            ? "Write the announcement. Keep it short — push previews show the first line or two."
            : "Skriv kunngjøringen. Hold den kort — push viser de første linjene."
        }
        value={bodyValue ?? ""}
      />

      <div style={{ marginTop: 22 }}>
        <AiCard
          body="Draft the Norwegian title and body from your English copy. Simple formatting (headings, bullets, bold) is preserved — review before you send."
          title="Translate to Norwegian"
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button
              disabled={translating}
              onClick={onTranslateNo}
              style={{
                ...aiButtonStyle(true),
                opacity: translating ? 0.6 : 1,
              }}
              type="button"
            >
              <Languages size={11} />
              {translating ? "Translating…" : "Translate to Norwegian"}
            </button>
          </div>
        </AiCard>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Distribution step                             */
/* -------------------------------------------------------------------------- */

function AudienceDetail({
  set,
  values,
}: {
  set: <K extends keyof AnnouncementFormValues>(
    key: K,
    value: AnnouncementFormValues[K]
  ) => void;
  values: AnnouncementFormValues;
}) {
  if (values.audience_type === "topic") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <FieldLabel>
          <Bell size={12} /> Topic channel
        </FieldLabel>
        <select
          onChange={(event) => set("audience_value", event.target.value)}
          style={fieldInputStyle()}
          value={values.audience_value || "events"}
        >
          {TOPIC_OPTIONS.map((topic) => (
            <option key={topic.value} value={topic.value}>
              {topic.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (values.audience_type === "users") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <FieldLabel help="Emails are resolved on save">
          <Users size={12} /> Recipients
        </FieldLabel>
        <textarea
          onChange={(event) => set("audience_value", event.target.value)}
          placeholder="ada@bi.no, ola@biso.no, 64f0c1a2b3…"
          style={fieldInputStyle({
            minHeight: 76,
            resize: "none",
          })}
          value={values.audience_value ?? ""}
        />
      </div>
    );
  }

  if (values.audience_type === "segment") {
    return (
      <div
        style={{
          background: BRAND.paper2,
          border: `0.5px solid ${BRAND.rule2}`,
          borderRadius: 10,
          color: BRAND.ink3,
          fontSize: 12.5,
          lineHeight: 1.5,
          padding: "12px 14px",
        }}
      >
        Dynamic segments arrive in Phase 2. For now this behaves like a
        broadcast — pick another audience for precise targeting.
      </div>
    );
  }

  return (
    <p style={{ color: BRAND.ink4, fontSize: 12.5, margin: 0 }}>
      Broadcast reaches every app user via the default app topic.
    </p>
  );
}

function DistributionStep({
  campusOptions,
  set,
  values,
}: {
  campusOptions: Array<{ value: string; label: string }>;
  set: <K extends keyof AnnouncementFormValues>(
    key: K,
    value: AnnouncementFormValues[K]
  ) => void;
  values: AnnouncementFormValues;
}) {
  return (
    <div>
      <StepIntro eyebrow="Step 3" title="Who gets it, and when." />

      <div style={{ display: "grid", gap: 8 }}>
        <FieldLabel required>
          <Users size={12} /> Audience
        </FieldLabel>
        <div
          style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}
        >
          {AUDIENCE_TYPES.map((audience) => {
            const Icon = audience.icon;
            return (
              <SelectCard
                active={values.audience_type === audience.id}
                description={audience.description}
                disabled={audience.id === "segment"}
                disabledNote={audience.disabledNote}
                icon={<Icon size={14} />}
                key={audience.id}
                onClick={() => set("audience_type", audience.id)}
                title={audience.label}
              />
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <AudienceDetail set={set} values={values} />
      </div>

      <div style={{ display: "grid", gap: 22, marginTop: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>
            <Globe size={12} /> Campus
          </FieldLabel>
          <select
            onChange={(event) => set("campus_id", event.target.value || null)}
            style={fieldInputStyle()}
            value={values.campus_id ?? ""}
          >
            {campusOptions.map((campus) => (
              <option key={campus.value || "all"} value={campus.value}>
                {campus.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel help="Deep-links the push to an event">
            <Link2 size={12} /> Event id
          </FieldLabel>
          <input
            onChange={(event) => set("event_id", event.target.value || null)}
            placeholder="e.g. 64f0c1a2b3…"
            style={fieldInputStyle({ fontFamily: MONO, fontSize: 13 })}
            value={values.event_id ?? ""}
          />
        </div>

        <SelectCard
          active={values.push}
          description={
            values.push
              ? "Fires a device push and adds the message to the in-app inbox."
              : "Inbox-only — appears in the app without a device push."
          }
          icon={<Bell size={14} />}
          onClick={() => set("push", !values.push)}
          title={values.push ? "Send device push" : "Inbox only"}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel help="Leave empty to send immediately">
            <CalendarDays size={12} /> Schedule
          </FieldLabel>
          <input
            onChange={(event) =>
              set("scheduled_at", event.target.value || null)
            }
            style={fieldInputStyle()}
            type="datetime-local"
            value={values.scheduled_at ? values.scheduled_at.slice(0, 16) : ""}
          />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Review step                                 */
/* -------------------------------------------------------------------------- */

function buildReviewRows(
  values: AnnouncementFormValues,
  campusOptions: Array<{ value: string; label: string }>
): Array<{ label: string; value: string | null; step: StepIndex }> {
  const category = categoryById(values.category);
  const audience = AUDIENCE_TYPES.find((a) => a.id === values.audience_type);
  const campusLabel =
    campusOptions.find((c) => c.value === (values.campus_id ?? ""))?.label ??
    "—";
  let audienceDetail = "";
  if (values.audience_type === "topic") {
    audienceDetail = ` · ${values.audience_value || "events"}`;
  } else if (values.audience_type === "users") {
    const count = (values.audience_value ?? "")
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean).length;
    audienceDetail = ` · ${count} recipient${count === 1 ? "" : "s"}`;
  }

  let scheduleValue = "Send immediately";
  if (values.scheduled_at) {
    scheduleValue = isFutureSchedule(values.scheduled_at)
      ? `Scheduled · ${new Date(values.scheduled_at).toLocaleString("en-GB")}`
      : `Send immediately (past date ${new Date(values.scheduled_at).toLocaleString("en-GB")})`;
  }

  return [
    { label: "Title (EN)", value: values.title_en || null, step: 0 },
    { label: "Title (NO)", value: values.title_no || null, step: 0 },
    { label: "Category", value: category.label, step: 0 },
    {
      label: "Body (EN)",
      value: htmlToPlainText(values.body_en) || null,
      step: 1,
    },
    {
      label: "Body (NO)",
      value: htmlToPlainText(values.body_no) || null,
      step: 1,
    },
    {
      label: "Audience",
      value: `${audience?.label ?? "—"}${audienceDetail}`,
      step: 2,
    },
    { label: "Campus", value: campusLabel, step: 2 },
    { label: "Event id", value: values.event_id || null, step: 2 },
    {
      label: "Push",
      value: values.push ? "Device push + inbox" : "Inbox only",
      step: 2,
    },
    { label: "Schedule", value: scheduleValue, step: 2 },
  ];
}

function ReviewStep({
  campusOptions,
  setStep,
  values,
}: {
  campusOptions: Array<{ value: string; label: string }>;
  setStep: (step: StepIndex) => void;
  values: AnnouncementFormValues;
}) {
  const rows = buildReviewRows(values, campusOptions);

  return (
    <div>
      <StepIntro eyebrow="Step 4" title="One last look." />
      <p
        style={{
          color: BRAND.ink3,
          fontSize: 13.5,
          margin: "0 0 18px",
          maxWidth: "50ch",
        }}
      >
        Click any row to jump back and edit. The previews on the right show
        exactly how this lands on a phone and in the in-app inbox.
      </p>

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
        {rows.map((row, index) => (
          <button
            key={row.label}
            onClick={() => setStep(row.step)}
            style={{
              alignItems: "center",
              background: "transparent",
              border: 0,
              borderTop: index > 0 ? `0.5px solid ${BRAND.rule}` : 0,
              cursor: "pointer",
              display: "grid",
              gap: 14,
              gridTemplateColumns: "140px 1fr auto",
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
            <ChevronRight size={14} style={{ color: BRAND.ink4 }} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 Action bar                                 */
/* -------------------------------------------------------------------------- */

function ActionBar({
  dirty,
  onSaveDraft,
  onSend,
  scheduledFuture,
  sending,
  setStep,
  step,
  submitting,
  values,
}: {
  dirty: boolean;
  onSaveDraft: () => void;
  onSend: () => void;
  scheduledFuture: boolean;
  sending: boolean;
  setStep: (step: StepIndex) => void;
  step: StepIndex;
  submitting: boolean;
  values: AnnouncementFormValues;
}) {
  const filled = [
    Boolean(values.title_en?.trim()),
    Boolean(values.title_no?.trim()),
    Boolean(htmlToPlainText(values.body_en)),
    Boolean(values.category),
    Boolean(values.audience_type),
  ];
  const progress = Math.round(
    (filled.filter(Boolean).length / filled.length) * 100
  );
  const nextStepName = step < STEPS.length - 1 ? STEPS[step + 1] : null;

  let sendLabel = scheduledFuture ? "Schedule" : "Send now";
  if (sending) {
    sendLabel = "Sending…";
  }

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
        <span style={{ fontFamily: MONO, fontSize: 11.5 }}>{progress}%</span>
        {dirty && (
          <span style={{ color: BRAND.gold, fontSize: 11 }}>· Unsaved</span>
        )}
      </div>
      <div style={{ flex: 1 }} />
      <button
        disabled={submitting}
        onClick={onSaveDraft}
        style={actionBtnStyle()}
        type="button"
      >
        <Save size={13} />
        {submitting ? "Saving…" : "Save draft"}
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
          disabled={sending}
          onClick={onSend}
          style={{
            ...actionBtnStyle(),
            background: BRAND.bisoBlue,
            border: `0.5px solid ${BRAND.bisoBlue}`,
            color: "white",
            padding: "9px 18px",
          }}
          type="button"
        >
          <Send size={13} />
          {sendLabel}
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
/*                                Preview pane                                */
/* -------------------------------------------------------------------------- */

function BisoAppIcon({ size = 26 }: { size?: number }) {
  return (
    <span
      style={{
        alignItems: "center",
        background: "linear-gradient(135deg, #01417B, #1A77E9)",
        borderRadius: size * 0.26,
        color: "white",
        display: "grid",
        flexShrink: 0,
        fontSize: size * 0.42,
        fontWeight: 700,
        height: size,
        letterSpacing: "-0.02em",
        placeItems: "center",
        width: size,
      }}
    >
      <Bell size={size * 0.5} />
    </span>
  );
}

function IosPushMock({ body, title }: { body: string; title: string }) {
  return (
    <div
      style={{
        backdropFilter: "blur(18px)",
        background: "rgba(38,38,42,0.82)",
        border: "0.5px solid rgba(255,255,255,0.12)",
        borderRadius: 20,
        boxShadow: "0 18px 40px -16px rgba(0,0,0,0.5)",
        color: "white",
        padding: "12px 14px",
        WebkitBackdropFilter: "blur(18px)",
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 9,
          marginBottom: 6,
        }}
      >
        <BisoAppIcon size={22} />
        <span
          style={{
            color: "rgba(255,255,255,0.65)",
            flex: 1,
            fontSize: 11,
            letterSpacing: ".04em",
            textTransform: "uppercase",
          }}
        >
          BISO
        </span>
        <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 11 }}>
          now
        </span>
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.25 }}>
        {title || "Announcement title"}
      </div>
      <div
        style={{
          color: "rgba(255,255,255,0.78)",
          display: "-webkit-box",
          fontSize: 12.5,
          lineHeight: 1.35,
          marginTop: 2,
          overflow: "hidden",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
        }}
      >
        {body || "Your message preview shows here."}
      </div>
    </div>
  );
}

function AndroidPushMock({
  accent,
  body,
  title,
}: {
  accent: string;
  body: string;
  title: string;
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "0.5px solid rgba(0,0,0,0.08)",
        borderRadius: 16,
        boxShadow: "0 8px 22px -12px rgba(0,0,0,0.3)",
        color: "#1c1b1f",
        padding: "12px 14px",
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 8,
          marginBottom: 5,
        }}
      >
        <span
          style={{
            alignItems: "center",
            background: accent,
            borderRadius: "50%",
            color: "white",
            display: "grid",
            height: 18,
            placeItems: "center",
            width: 18,
          }}
        >
          <Bell size={11} />
        </span>
        <span style={{ color: "#49454f", fontSize: 11.5, fontWeight: 500 }}>
          BISO
        </span>
        <span style={{ color: "#79747e", fontSize: 11.5 }}>· now</span>
        <ChevronRight
          size={14}
          style={{ color: "#79747e", marginLeft: "auto" }}
        />
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.25 }}>
        {title || "Announcement title"}
      </div>
      <div
        style={{
          color: "#49454f",
          display: "-webkit-box",
          fontSize: 12.5,
          lineHeight: 1.35,
          marginTop: 1,
          overflow: "hidden",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
        }}
      >
        {body || "Your message preview shows here."}
      </div>
    </div>
  );
}

function InboxCardMock({
  accent,
  body,
  category,
  title,
}: {
  accent: string;
  body: string;
  category: CategoryId;
  title: string;
}) {
  const Icon = categoryById(category).icon;
  return (
    <div
      style={{
        alignItems: "flex-start",
        background: "#ffffff",
        border: "0.5px solid rgba(0,0,0,0.06)",
        borderRadius: 14,
        boxShadow: "0 6px 18px -12px rgba(0,0,0,0.25)",
        display: "flex",
        gap: 12,
        padding: "13px 14px",
        width: "100%",
      }}
    >
      <span
        style={{
          alignItems: "center",
          background: `${accent}1a`,
          borderRadius: "50%",
          color: accent,
          display: "grid",
          flexShrink: 0,
          height: 38,
          placeItems: "center",
          width: 38,
        }}
      >
        <Icon size={17} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            alignItems: "center",
            display: "flex",
            gap: 8,
          }}
        >
          <span
            style={{
              color: "#1c1b1f",
              flex: 1,
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title || "Announcement title"}
          </span>
          <span style={{ color: "#79747e", fontSize: 11 }}>now</span>
        </div>
        <p
          style={{
            color: "#49454f",
            display: "-webkit-box",
            fontSize: 12.5,
            lineHeight: 1.4,
            margin: "3px 0 0",
            overflow: "hidden",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
          }}
        >
          {body || "Your message preview shows here."}
        </p>
      </div>
      <span
        style={{
          background: BRAND.bisoBlue,
          borderRadius: "50%",
          flexShrink: 0,
          height: 9,
          marginTop: 4,
          width: 9,
        }}
      />
    </div>
  );
}

function PreviewBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span
        style={{
          color: BRAND.ink4,
          fontFamily: MONO,
          fontSize: 10.5,
          letterSpacing: ".08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function AnnouncementPreviewPane({
  locale,
  setLocale,
  values,
}: {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  values: AnnouncementFormValues;
}) {
  const title =
    locale === "no"
      ? values.title_no?.trim() || values.title_en
      : values.title_en;
  const bodyHtml = locale === "no" ? values.body_no : values.body_en;
  const body = clampText(htmlToPlainText(bodyHtml), PUSH_PREVIEW_CHARS);
  const accent = categoryAccent(values.category);

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
          fontSize: 12.5,
          gap: 8,
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
            fontSize: 11.5,
            fontWeight: 500,
            gap: 6,
          }}
        >
          <span
            style={{
              animation: "an-pulse 1.8s infinite",
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
            fontSize: 11.5,
            letterSpacing: ".05em",
            textTransform: "uppercase",
          }}
        >
          How it lands
        </span>
        <div style={{ flex: 1 }} />
        <div
          style={{
            background: "rgba(255,255,255,.5)",
            border: `0.5px solid ${BRAND.rule2}`,
            borderRadius: 7,
            display: "flex",
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
          display: "flex",
          flex: 1,
          flexDirection: "column",
          gap: 22,
          minHeight: 0,
          overflow: "auto",
          padding: 24,
        }}
      >
        <PreviewBlock label="iOS lock screen">
          <div
            style={{
              background: "linear-gradient(160deg, #1c2a3a 0%, #0c1622 100%)",
              borderRadius: 24,
              padding: 16,
            }}
          >
            <IosPushMock body={body} title={title} />
          </div>
        </PreviewBlock>

        <PreviewBlock label="Android heads-up">
          <AndroidPushMock accent={accent} body={body} title={title} />
        </PreviewBlock>

        <PreviewBlock label="In-app inbox">
          <InboxCardMock
            accent={accent}
            body={body}
            category={values.category}
            title={title}
          />
        </PreviewBlock>

        {!values.push && (
          <p
            style={{
              color: BRAND.ink3,
              fontSize: 11.5,
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            Device push is off — students see this only in the in-app inbox.
          </p>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Root editor                                 */
/* -------------------------------------------------------------------------- */

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") {
    return error;
  }
  return fallback;
}

export function AnnouncementStudioEditor({
  allowGlobalCampus,
  announcement,
  campuses,
  defaultCampusId,
  isNew,
}: AnnouncementStudioEditorProps) {
  const router = useRouter();
  const [step, setStep] = useState<StepIndex>(0);
  const [locale, setLocale] = useState<LocaleCode>("en");
  const [previewLocale, setPreviewLocale] = useState<LocaleCode>("en");
  const [values, setValues] = useState<AnnouncementFormValues>(() =>
    buildInitialValues(announcement, defaultCampusId)
  );
  const [dirty, setDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [translating, setTranslating] = useState(false);

  const campusOptions = [
    ...(allowGlobalCampus
      ? [{ value: "", label: "All campuses (app-wide)" }]
      : []),
    ...campuses.map((campus) => ({ value: campus.id, label: campus.name })),
  ];

  function set<K extends keyof AnnouncementFormValues>(
    key: K,
    value: AnnouncementFormValues[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  async function persist(): Promise<string | null> {
    const validated = announcementSchema.safeParse(values);
    if (!validated.success) {
      toast.error("Please fix the highlighted fields before continuing.");
      return null;
    }
    const result = isNew
      ? await createAnnouncement(validated.data)
      : await updateAnnouncement(announcement?.$id ?? "", validated.data);
    if (result.error) {
      toast.error(errorMessage(result.error, "Failed to save announcement"));
      return null;
    }
    setDirty(false);
    return typeof result.data === "string"
      ? result.data
      : (announcement?.$id ?? null);
  }

  async function handleSaveDraft() {
    setIsSaving(true);
    try {
      const id = await persist();
      if (id) {
        toast.success("Draft saved");
        if (isNew) {
          router.push(`/communications/${id}`);
        }
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSend() {
    setIsSending(true);
    try {
      const id = await persist();
      if (!id) {
        return;
      }
      const result = await sendAnnouncement(id);
      if (result.error) {
        toast.error(errorMessage(result.error, "Failed to send announcement"));
        return;
      }
      toast.success(
        result.data?.status === "scheduled"
          ? "Announcement scheduled"
          : "Announcement sent"
      );
      router.push("/communications");
    } finally {
      setIsSending(false);
    }
  }

  async function handleTranslateNo() {
    if (!values.title_en.trim()) {
      toast.error("Add an English title first.");
      return;
    }
    setTranslating(true);
    try {
      const result = await generateAnnouncementNorwegianDraft({
        title_en: values.title_en,
        body_en: values.body_en ?? undefined,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if (!("data" in result && result.data)) {
        toast.error("Failed to generate Norwegian draft");
        return;
      }
      setValues((prev) => ({
        ...prev,
        body_no: result.data.body_no,
        title_no: result.data.title_no,
      }));
      setDirty(true);
      setLocale("no");
      toast.success("Norwegian draft generated");
    } finally {
      setTranslating(false);
    }
  }

  const status = isNew ? "draft" : (announcement?.status ?? "draft");
  const scheduledFuture = isFutureSchedule(values.scheduled_at);

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
        @keyframes an-pulse {
          0% { opacity: 1; }
          50% { opacity: 0.35; }
          100% { opacity: 1; }
        }
      `}</style>

      <div
        style={{
          alignItems: "center",
          borderBottom: `0.5px solid ${BRAND.rule}`,
          display: "flex",
          gap: 12,
          padding: "10px 36px",
        }}
      >
        <Link
          aria-label="Communications"
          href="/communications"
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
          Communications
        </Link>
        <span
          style={{
            background: BRAND.ink4,
            borderRadius: "50%",
            height: 4,
            width: 4,
          }}
        />
        <span
          style={{
            color: BRAND.ink,
            fontSize: 13,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {isNew ? "New announcement" : values.title_en || "Edit announcement"}
        </span>
        <span
          style={{
            background: status === "sent" ? "rgba(47,93,58,0.1)" : BRAND.paper2,
            border: `0.5px solid ${BRAND.rule2}`,
            borderRadius: 999,
            color: status === "sent" ? BRAND.leaf : BRAND.ink3,
            fontFamily: MONO,
            fontSize: 10.5,
            letterSpacing: ".05em",
            padding: "2px 9px",
            textTransform: "uppercase",
          }}
        >
          {status}
        </span>
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
            {step === 0 && (
              <EssentialsStep
                locale={locale}
                set={set}
                setLocale={setLocale}
                values={values}
              />
            )}
            {step === 1 && (
              <ContentStep
                locale={locale}
                onTranslateNo={handleTranslateNo}
                set={set}
                setLocale={setLocale}
                translating={translating}
                values={values}
              />
            )}
            {step === 2 && (
              <DistributionStep
                campusOptions={campusOptions}
                set={set}
                values={values}
              />
            )}
            {step === 3 && (
              <ReviewStep
                campusOptions={campusOptions}
                setStep={setStep}
                values={values}
              />
            )}
          </div>
          <ActionBar
            dirty={dirty}
            onSaveDraft={handleSaveDraft}
            onSend={handleSend}
            scheduledFuture={scheduledFuture}
            sending={isSending}
            setStep={setStep}
            step={step}
            submitting={isSaving}
            values={values}
          />
        </div>

        <AnnouncementPreviewPane
          locale={previewLocale}
          setLocale={setPreviewLocale}
          values={values}
        />
      </div>
    </div>
  );
}
