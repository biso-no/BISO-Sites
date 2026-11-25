/**
 * Message text for big events: placeholders, rendering and the default
 * texts for automatic messages. Pure module (no Appwrite, no server-only).
 *
 * Placeholder pattern: `{` + optional spaces + one or more words + optional
 * spaces + `}`, where a word is letters (any script, so "oppmøtested"),
 * digits, `_` or `-`, and words are separated by whitespace. Anything else
 * in braces (quotes, colons, nested braces, a lone `{`) is not a
 * placeholder and is left untouched.
 */

export const PLACEHOLDERS = [
  "first_name",
  "bus",
  "departure",
  "meeting_point",
  "bus_contact",
  "room",
] as const;

export type Placeholder = (typeof PLACEHOLDERS)[number];
export type MessageVars = Partial<Record<Placeholder, string>>;
type Locale = "no" | "en";

export const PLACEHOLDER_LABELS: Record<Locale, Record<Placeholder, string>> = {
  no: {
    first_name: "fornavn",
    bus: "buss",
    departure: "avgang",
    meeting_point: "oppmøtested",
    bus_contact: "busskontakt",
    room: "rom",
  },
  en: {
    first_name: "first name",
    bus: "bus",
    departure: "departure",
    meeting_point: "meeting point",
    bus_contact: "bus contact",
    room: "room",
  },
};

const TOKEN_PATTERN = /\{\s*([\p{L}\p{N}_-]+(?:\s+[\p{L}\p{N}_-]+)*)\s*\}/gu;
const WHITESPACE_RUN = /\s+/g;
const DOUBLE_SPACE = /[ \t]{2,}/g;
const SPACE_BEFORE_PUNCTUATION = /[ \t]+([.,!?;:])/g;

const normalizeLabel = (raw: string): string =>
  raw.trim().replace(WHITESPACE_RUN, " ").toLowerCase();

const LABEL_TO_KEY = new Map<string, Placeholder>();
for (const locale of ["no", "en"] as const) {
  for (const key of PLACEHOLDERS) {
    LABEL_TO_KEY.set(normalizeLabel(PLACEHOLDER_LABELS[locale][key]), key);
  }
}

export function placeholderToken(locale: Locale, key: Placeholder): string {
  return `{${PLACEHOLDER_LABELS[locale][key]}}`;
}

export function findPlaceholders(text: string): {
  known: Placeholder[];
  unknown: string[];
} {
  const known: Placeholder[] = [];
  const unknown: string[] = [];
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const label = normalizeLabel(match[1] ?? "");
    const key = LABEL_TO_KEY.get(label);
    if (key) {
      known.push(key);
    } else if (!unknown.includes(label)) {
      unknown.push(label);
    }
  }
  return { known, unknown };
}

export function renderText(
  text: string,
  vars: MessageVars,
  opts?: { forPush?: boolean }
): string {
  let removed = false;
  const out = text.replace(TOKEN_PATTERN, (whole, raw: string) => {
    const key = LABEL_TO_KEY.get(normalizeLabel(raw));
    if (!key) {
      return whole;
    }
    const value = opts?.forPush && key === "first_name" ? "" : vars[key];
    if (value === undefined || value.trim() === "") {
      removed = true;
      return "";
    }
    return value;
  });
  if (!removed) {
    return out;
  }
  return out
    .replace(DOUBLE_SPACE, " ")
    .replace(SPACE_BEFORE_PUNCTUATION, "$1")
    .trim();
}

type AutoKind =
  | "bus_assigned"
  | "bus_moved"
  | "bus_none"
  | "departure_reminder";

const AUTO_TEXTS: Record<
  AutoKind,
  Record<Locale, { title: string; body: string }>
> = {
  bus_assigned: {
    no: {
      title: "Bussen din",
      body: "Hei {fornavn}! Du skal med {buss}. Den går {avgang} fra {oppmøtested}.",
    },
    en: {
      title: "Your bus",
      body: "Hi {first name}! You're on {bus}. It leaves {departure} from {meeting point}.",
    },
  },
  bus_moved: {
    no: {
      title: "Ny buss",
      body: "Hei {fornavn}! Du er flyttet til {buss}. Den går {avgang} fra {oppmøtested}.",
    },
    en: {
      title: "New bus",
      body: "Hi {first name}! You've been moved to {bus}. It leaves {departure} from {meeting point}.",
    },
  },
  bus_none: {
    no: {
      title: "Bussplassen din",
      body: "Hei {fornavn}! Du har ikke plass på noen buss akkurat nå. Arrangørene gir deg beskjed.",
    },
    en: {
      title: "Your bus seat",
      body: "Hi {first name}! You don't have a seat on a bus right now. The organizers will let you know.",
    },
  },
  departure_reminder: {
    no: {
      title: "Bussen går snart",
      body: "{buss} går {avgang} fra {oppmøtested}. Ha medlemsbeviset klart.",
    },
    en: {
      title: "Your bus leaves soon",
      body: "{bus} leaves {departure} from {meeting point}. Have your member pass ready.",
    },
  },
};

export function defaultAutoTexts(
  kind: AutoKind
): Record<Locale, { title: string; body: string }> {
  return AUTO_TEXTS[kind];
}
