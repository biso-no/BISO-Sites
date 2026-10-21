"use client";

import type { Announcements } from "@repo/api/types/appwrite";
import { logicalTopicFor } from "@repo/shared/utils/notification-topics";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  ChevronRight,
  type Megaphone,
  Save,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AutoTranslateControl } from "@/app/_components/content-translation-controls";
import type { TOPIC_OPTIONS } from "@/lib/announcements/audience-names";
import type { AutoTranslationOptions } from "@/lib/content-translation";
import {
  createAnnouncement,
  generateAnnouncementTranslationDraft,
  sendAnnouncement,
  updateAnnouncement,
} from "../../_actions/announcements";
import {
  type AnnouncementFormValues,
  announcementSchema,
} from "../../_actions/schemas";
import { DescriptionBlockEditor } from "../../_components/description-block-editor";
import { CheckStep } from "./composer/check-step";
import {
  COMPOSER_STEPS,
  type ComposerStepIndex,
  canContinue,
  clearDepartmentOnCampusChange,
  TYPE_CARDS,
} from "./composer/composer-state";
import {
  buildLinkState,
  type LinkState,
  storedLinkFrom,
} from "./composer/link-state";
import {
  BRAND,
  type LocaleCode,
  LocaleTabs,
  MONO,
  StepIntro,
  TYPE_ICONS,
} from "./composer/ui";
import { WhatStep } from "./composer/what-step";
import { WhoStep } from "./composer/who-step";

/* -------------------------------------------------------------------------- */
/*                              Brand + constants                             */
/* -------------------------------------------------------------------------- */

const STEPS = COMPOSER_STEPS;

type StepIndex = ComposerStepIndex;

type CategoryId = AnnouncementFormValues["category"];
type AudienceType = AnnouncementFormValues["audience_type"];

const CATEGORIES: Array<{
  id: CategoryId;
  label: string;
  description: string;
  icon: typeof Megaphone;
}> = TYPE_CARDS.map((card) => ({
  description: card.description,
  icon: TYPE_ICONS[card.id],
  id: card.id,
  label: card.label,
}));

const PUSH_PREVIEW_CHARS = 140;

interface CampusOption {
  id: string;
  name: string;
}

interface AnnouncementStudioEditorProps {
  announcement: Announcements | null;
  campuses: CampusOption[];
  defaultCampusId: string;
  /** The step to open on; the history list's "Review & send" opens Check & send. */
  initialStep?: StepIndex;
  isGlobalAdmin: boolean;
  isNew: boolean;
  /** Single-department authors are pinned to their department. */
  lockDepartment: boolean;
  /** Campuses a campus admin manages; empty for others. */
  managedCampusIds: string[];
  pinnedDepartmentId: string | null;
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
 * `@repo/shared/utils/push-dispatch` (`htmlToPlainText`), which this client
 * component can't import because that module pulls in the server SDK.
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

interface AnnouncementEditorTranslationDraft {
  body: string;
  title: string;
}

const getAnnouncementEditorTranslationDraft = (
  values: AnnouncementFormValues,
  locale: LocaleCode
): AnnouncementEditorTranslationDraft =>
  locale === "en"
    ? { body: values.body_en ?? "", title: values.title_en }
    : { body: values.body_no ?? "", title: values.title_no ?? "" };

const hasAnnouncementTranslationContent = ({
  body,
  title,
}: AnnouncementEditorTranslationDraft): boolean =>
  Boolean(body.trim() || title.trim());

const getAnnouncementSendMessage = (
  status: "queued" | "scheduled" | "sent"
): string => {
  if (status === "scheduled") {
    return "Announcement scheduled";
  }
  if (status === "queued") {
    return "Announcement saved; translation and delivery queued";
  }
  return "Announcement sent";
};

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

const AUDIENCE_KEYS = new Set<keyof AnnouncementFormValues>([
  "audience_type",
  "audience_value",
  "campus_id",
]);

/**
 * The topic a topic announcement holds when it has none. The form stores it
 * rather than only displaying it: dispatch sends an empty topic to `general`,
 * which is every student, so an Events pill shown over an empty value would
 * message everyone.
 */
const DEFAULT_TOPIC: (typeof TOPIC_OPTIONS)[number]["value"] = "events";

/** Gives a topic announcement with no topic the default one. */
function withTopicDefault(
  values: AnnouncementFormValues
): AnnouncementFormValues {
  return values.audience_type === "topic" && !values.audience_value?.trim()
    ? { ...values, audience_value: DEFAULT_TOPIC }
    : values;
}

/**
 * Every form change goes through here: a topic audience keeps a topic, and a
 * campus change drops a department that belongs to the old campus.
 */
function nextValues(
  previous: AnnouncementFormValues,
  next: AnnouncementFormValues,
  keepDepartment: boolean
): AnnouncementFormValues {
  return withTopicDefault(
    clearDepartmentOnCampusChange(previous, next, { keepDepartment })
  );
}

/** An explicit link wins; a legacy draft with only `event_id` is an event link. */
function initialLink(
  announcement: Announcements | null
): Pick<AnnouncementFormValues, "content_id" | "content_type"> {
  if (announcement?.content_type && announcement.content_id) {
    return {
      content_id: announcement.content_id,
      content_type: announcement.content_type,
    };
  }
  if (announcement?.event_id) {
    return { content_id: announcement.event_id, content_type: "event" };
  }
  return { content_id: null, content_type: null };
}

export function buildInitialValues(
  announcement: Announcements | null,
  defaultCampusId: string,
  pinnedDepartmentId: string | null
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
  } else if (announcement?.audience_type === "topic" && audienceValue) {
    // A sent row holds the campus-scoped id dispatch resolved (e.g.
    // "events_oslo" — see `resolveAnnouncementTopicId`), but the Who step's
    // topic pills offer only the four logical topics. Editing the logical
    // topic does two things: it keeps a pill selected, and it makes a re-send
    // target the campus chosen now. The resolver passes an already-scoped id
    // through unchanged, so an "events_oslo" row moved to Bergen would
    // otherwise still push to Oslo.
    //
    // It is not what keeps a sent row scoped — saving writes the logical topic
    // back. `updateAnnouncement` does that on the server, resolving a sent
    // row's topic against the campus being saved.
    audienceValue = logicalTopicFor(audienceValue);
  }

  return withTopicDefault({
    title_en: announcement?.title_en ?? "",
    title_no: announcement?.title_no ?? null,
    body_en: announcement?.body_en ?? null,
    body_no: announcement?.body_no ?? null,
    category: (announcement?.category as CategoryId) ?? "general",
    audience_type: (announcement?.audience_type as AudienceType) ?? "broadcast",
    audience_value: audienceValue,
    ...initialLink(announcement),
    event_id: announcement?.event_id ?? null,
    campus_id: announcement?.campus_id ?? defaultCampusId ?? null,
    department_id: announcementDepartmentId(announcement) ?? pinnedDepartmentId,
    push: announcement?.push ?? true,
    scheduled_at: announcement?.scheduled_at ?? null,
  });
}

function announcementDepartmentId(
  announcement: Announcements | null
): string | null {
  const department = (
    announcement as { department?: string | { $id: string } | null } | null
  )?.department;
  if (!department) {
    return null;
  }
  return typeof department === "string" ? department : department.$id;
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

function ContentStep({
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
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 Action bar                                 */
/* -------------------------------------------------------------------------- */

function ActionBar({
  autoTranslate,
  dirty,
  locale,
  onAutoTranslateChange,
  onSaveDraft,
  sending,
  setStep,
  step,
  submitting,
  values,
}: {
  autoTranslate: boolean;
  dirty: boolean;
  locale: LocaleCode;
  onAutoTranslateChange: (checked: boolean) => void;
  onSaveDraft: () => void;
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
  const gate = canContinue(step, values);

  return (
    <div
      style={{
        alignItems: "center",
        backdropFilter: "blur(14px)",
        background: "rgba(250,247,242,.92)",
        borderTop: `0.5px solid ${BRAND.rule}`,
        bottom: 0,
        display: "flex",
        flexWrap: "wrap",
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
      <AutoTranslateControl
        checked={autoTranslate}
        className="min-w-[250px]"
        disabled={submitting || sending}
        onCheckedChange={onAutoTranslateChange}
        operation="save or send"
        sourceLocale={locale}
      />
      <button
        disabled={submitting || sending}
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
          disabled={!gate.ok}
          onClick={() => setStep((step + 1) as StepIndex)}
          style={{
            ...actionBtnStyle(),
            background: BRAND.ink,
            border: `0.5px solid ${BRAND.ink}`,
            color: BRAND.paper,
            opacity: gate.ok ? 1 : 0.5,
            padding: "9px 18px",
          }}
          title={gate.reason}
          type="button"
        >
          Continue · {nextStepName} <ArrowRight size={14} />
        </button>
      ) : null}
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
  announcement,
  campuses,
  defaultCampusId,
  initialStep = 0,
  isGlobalAdmin,
  isNew,
  lockDepartment,
  managedCampusIds,
  pinnedDepartmentId,
}: AnnouncementStudioEditorProps) {
  const router = useRouter();
  const [step, setStep] = useState<StepIndex>(initialStep);
  const [locale, setLocale] = useState<LocaleCode>("no");
  const [previewLocale, setPreviewLocale] = useState<LocaleCode>("en");
  const [values, setValues] = useState<AnnouncementFormValues>(() =>
    buildInitialValues(announcement, defaultCampusId, pinnedDepartmentId)
  );
  const [dirty, setDirty] = useState(false);
  const [link, setLink] = useState<LinkState>(buildLinkState);
  const storedLink = useMemo(
    () =>
      storedLinkFrom(
        announcement?.items ?? null,
        initialLink(announcement).content_id ?? null
      ),
    [announcement]
  );
  // The audience counts as touched when the admin changes it here, or when a
  // saved draft already carries a non-default one.
  const [audienceTouched, setAudienceTouched] = useState(
    () =>
      announcement !== null &&
      (announcement.audience_type !== "broadcast" ||
        Boolean(announcement.audience_value) ||
        (announcement.campus_id ?? "") !== defaultCampusId)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [confirmTranslationOverwrite, setConfirmTranslationOverwrite] =
    useState(false);

  // Mirrors the server's audience rules (`isAudienceAllowed`).
  const audienceContext = {
    managedCampusIds,
    roles: isGlobalAdmin ? ["globaladmin"] : ["campusadmin"],
  };

  const campusOptions = [
    ...(isGlobalAdmin ? [{ value: "", label: "All campuses (app-wide)" }] : []),
    ...campuses.map((campus) => ({ value: campus.id, label: campus.name })),
  ];

  function set<K extends keyof AnnouncementFormValues>(
    key: K,
    value: AnnouncementFormValues[K]
  ) {
    // Switching the audience to Topic with no topic set picks the default, so
    // the topic pills show what will be stored and sent.
    setValues((prev) =>
      nextValues(prev, { ...prev, [key]: value }, lockDepartment)
    );
    setDirty(true);
    if (AUDIENCE_KEYS.has(key)) {
      setAudienceTouched(true);
    }
  }

  function setAudience(
    patch: Partial<
      Pick<
        AnnouncementFormValues,
        "audience_type" | "audience_value" | "campus_id"
      >
    >
  ) {
    setValues((prev) =>
      nextValues(prev, { ...prev, ...patch }, lockDepartment)
    );
    setDirty(true);
    setAudienceTouched(true);
  }

  function update(
    change: (previous: AnnouncementFormValues) => AnnouncementFormValues
  ) {
    setValues((prev) => nextValues(prev, change(prev), lockDepartment));
    setDirty(true);
  }

  async function persist(
    autoTranslation?: AutoTranslationOptions
  ): Promise<{ id: string; translationQueued: boolean } | null> {
    const validated = announcementSchema.safeParse(values);
    if (!validated.success) {
      toast.error("Please fix the highlighted fields before continuing.");
      return null;
    }
    const result = isNew
      ? await createAnnouncement(validated.data, autoTranslation)
      : await updateAnnouncement(
          announcement?.$id ?? "",
          validated.data,
          autoTranslation
        );
    if (result.error) {
      toast.error(errorMessage(result.error, "Failed to save announcement"));
      return null;
    }
    setDirty(false);
    const id =
      typeof result.data === "string"
        ? result.data
        : (announcement?.$id ?? null);
    return id
      ? {
          id,
          translationQueued: result.translationQueued === true,
        }
      : null;
  }

  async function handleSaveDraft() {
    setIsSaving(true);
    try {
      const saved = await persist({
        enabled: autoTranslate,
        sourceLocale: locale,
      });
      if (saved) {
        toast.success(
          saved.translationQueued
            ? "Draft saved; translation queued"
            : "Draft saved"
        );
        if (isNew) {
          router.push(`/communications/${saved.id}`);
        }
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSend() {
    setIsSending(true);
    try {
      const saved = await persist();
      if (!saved) {
        return;
      }
      const result = await sendAnnouncement(saved.id, {
        enabled: autoTranslate,
        sourceLocale: locale,
      });
      if (!result.data) {
        toast.error(errorMessage(result.error, "Failed to send announcement"));
        return;
      }
      toast.success(getAnnouncementSendMessage(result.data.status));
      router.push("/communications");
    } finally {
      setIsSending(false);
    }
  }

  async function handleTranslate() {
    const source = getAnnouncementEditorTranslationDraft(values, locale);
    const targetLocale = locale === "en" ? "no" : "en";
    const destination = getAnnouncementEditorTranslationDraft(
      values,
      targetLocale
    );
    if (!hasAnnouncementTranslationContent(source)) {
      toast.error("Add source-language announcement content first.");
      return;
    }
    if (
      hasAnnouncementTranslationContent(destination) &&
      !confirmTranslationOverwrite
    ) {
      setConfirmTranslationOverwrite(true);
      toast.warning("Click Generate again to replace the translated draft.");
      return;
    }
    setConfirmTranslationOverwrite(false);
    setTranslating(true);
    try {
      const result = await generateAnnouncementTranslationDraft({
        ...source,
        campusId: values.campus_id ?? null,
        departmentId: values.department_id ?? null,
        sourceLocale: locale,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if (!("data" in result && result.data)) {
        toast.error("Failed to generate announcement translation");
        return;
      }
      setValues((previous) =>
        targetLocale === "no"
          ? {
              ...previous,
              body_no: result.data.body,
              title_no: result.data.title,
            }
          : {
              ...previous,
              body_en: result.data.body,
              title_en: result.data.title,
            }
      );
      setDirty(true);
      setLocale(targetLocale);
      setPreviewLocale(targetLocale);
      toast.success(
        targetLocale === "no"
          ? "Norwegian draft generated"
          : "English draft generated"
      );
    } finally {
      setTranslating(false);
    }
  }

  const status = isNew ? "draft" : (announcement?.status ?? "draft");

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
              <WhatStep
                audienceContext={audienceContext}
                audienceTouched={audienceTouched}
                link={link}
                locale={locale}
                set={set}
                setLink={setLink}
                setLocale={setLocale}
                storedLink={storedLink}
                update={update}
                values={values}
              />
            )}
            {step === 1 && (
              <ContentStep
                locale={locale}
                set={set}
                setLocale={setLocale}
                values={values}
              />
            )}
            {step === 2 && (
              <WhoStep
                audienceContext={audienceContext}
                lockDepartment={lockDepartment}
                set={set}
                setAudience={setAudience}
                tappingOpens={
                  values.content_id && link.display
                    ? (link.display.label ?? link.display.title)
                    : null
                }
                values={values}
              />
            )}
            {step === 3 && (
              <CheckStep
                alreadySent={status === "sent"}
                campusOptions={campusOptions}
                confirmTranslationOverwrite={confirmTranslationOverwrite}
                link={values.content_id ? link.display : null}
                locale={locale}
                onEdit={setStep}
                onSend={handleSend}
                onTranslate={handleTranslate}
                saving={isSaving}
                sending={isSending}
                set={set}
                translating={translating}
                values={values}
              />
            )}
          </div>
          <ActionBar
            autoTranslate={autoTranslate}
            dirty={dirty}
            locale={locale}
            onAutoTranslateChange={setAutoTranslate}
            onSaveDraft={handleSaveDraft}
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
