import type { AnnouncementFormValues } from "../../../_actions/schemas";

/**
 * Pure, client-safe state rules for the announcement composer. Nothing here
 * touches the server or `node:crypto`, so step components and tests can import
 * it freely.
 */

export const COMPOSER_STEPS = [
  "What",
  "Message",
  "Who",
  "Check & send",
] as const;

export type ComposerStepIndex = 0 | 1 | 2 | 3;

/** The form values already carry `content_type` and `content_id`. */
export type ComposerValues = AnnouncementFormValues;

export type ComposerTypeId =
  | "general"
  | "event"
  | "news"
  | "job"
  | "trip"
  | "urgent";
export type ComposerLinkType = "event" | "news" | "job";
export type ComposerTopic = "events" | "news" | "jobs";

export interface TypeCard {
  description: string;
  id: ComposerTypeId;
  label: string;
  linkRequired: boolean;
  linkType: ComposerLinkType | null;
}

export const TYPE_CARDS: TypeCard[] = [
  {
    description: "An update from BISO",
    id: "general",
    label: "General",
    linkRequired: false,
    linkType: null,
  },
  {
    description: "Links to an event",
    id: "event",
    label: "Event",
    linkRequired: true,
    linkType: "event",
  },
  {
    description: "Links to an article",
    id: "news",
    label: "News",
    linkRequired: true,
    linkType: "news",
  },
  {
    description: "Links to a position",
    id: "job",
    label: "Job",
    linkRequired: true,
    linkType: "job",
  },
  {
    description: "Travel info for a trip",
    id: "trip",
    label: "Trip",
    linkRequired: false,
    linkType: "event",
  },
  {
    description: "Shown in red, delivered with priority",
    id: "urgent",
    label: "Urgent",
    linkRequired: false,
    linkType: null,
  },
];

const TOPIC_FOR_TYPE: Record<ComposerLinkType, ComposerTopic> = {
  event: "events",
  job: "jobs",
  news: "news",
};

const LINK_NOUN: Record<ComposerLinkType, string> = {
  event: "event",
  job: "position",
  news: "article",
};

export function topicForType(
  type: ComposerLinkType | ComposerTypeId | null | undefined
): ComposerTopic | null {
  if (type === "event" || type === "news" || type === "job") {
    return TOPIC_FOR_TYPE[type];
  }
  return null;
}

export interface PrefillSnapshot {
  body_en: string;
  body_no: string;
  title_en: string;
  title_no: string;
}

const PREFILL_KEYS = ["title_en", "title_no", "body_en", "body_no"] as const;

/**
 * Fills title and body from linked content, but only where the admin has not
 * typed: a field is replaced when it is empty or still equals the value the
 * previous prefill put there.
 */
export function applyPrefill(
  values: ComposerValues,
  prefill: PrefillSnapshot,
  previous: PrefillSnapshot | null
): ComposerValues {
  const next = { ...values };
  for (const key of PREFILL_KEYS) {
    const current = values[key] ?? "";
    const untouched =
      current.trim() === "" || (previous !== null && current === previous[key]);
    if (untouched) {
      const incoming = prefill[key];
      // The string-typed title_en cannot hold null; the rest can.
      next[key as "title_no"] =
        key === "title_en" ? incoming : incoming || null;
    }
  }
  return next;
}

/**
 * Points the audience at the linked content's topic and campus, unless the
 * admin already chose an audience or it is not allowed for them.
 */
export function applyLinkedAudience(
  values: ComposerValues,
  link: { campusId: string | null; topic: ComposerTopic | null },
  ctx: { allowed: boolean; audienceTouched: boolean }
): ComposerValues {
  if (ctx.audienceTouched || !ctx.allowed || !link.topic) {
    return values;
  }
  return {
    ...values,
    audience_type: "topic",
    audience_value: link.topic,
    campus_id: link.campusId,
  };
}

/** The people picked for a "users" audience: a JSON id array, or legacy text. */
export function parseAudiencePeople(
  value: string | null | undefined
): string[] {
  const raw = value?.trim() ?? "";
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (entry): entry is string => typeof entry === "string" && entry !== ""
      );
    }
  } catch {
    // Not JSON: older drafts hold a comma-separated list.
  }
  return raw
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

export function canContinue(
  step: ComposerStepIndex,
  values: ComposerValues
): { ok: boolean; reason?: string } {
  if (step === 0) {
    if (!(values.title_en.trim() || values.title_no?.trim())) {
      return { ok: false, reason: "Add a title." };
    }
    const card = TYPE_CARDS.find((type) => type.id === values.category);
    if (card?.linkRequired && card.linkType && !values.content_id) {
      return {
        ok: false,
        reason: `Pick the ${LINK_NOUN[card.linkType]} to link.`,
      };
    }
  }
  if (
    step === 2 &&
    values.audience_type === "users" &&
    parseAudiencePeople(values.audience_value).length === 0
  ) {
    return { ok: false, reason: "Add at least one person." };
  }
  return { ok: true };
}
