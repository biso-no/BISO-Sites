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

/** Column sizes of a message's title and text (`big_event_messages`). */
export const MESSAGE_TITLE_MAX = 200;
export const MESSAGE_BODY_MAX = 2000;

export const PLACEHOLDERS = [
  "first_name",
  "bus",
  "departure",
  "meeting_point",
  "bus_contact",
  "trip_home",
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
    trip_home: "hjemreise",
    room: "rom",
  },
  en: {
    first_name: "first name",
    bus: "bus",
    departure: "departure",
    meeting_point: "meeting point",
    bus_contact: "bus contact",
    trip_home: "trip home",
    room: "room",
  },
};

const TOKEN_PATTERN = /\{\s*([\p{L}\p{N}_-]+(?:\s+[\p{L}\p{N}_-]+)*)\s*\}/gu;
const WHITESPACE_RUN = /\s+/g;

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

const LINE_START = /(?:^|\n)[ \t]*$/;
const TRAILING_BLANKS = /[ \t]+$/;
const LEADING_BLANKS = /^[ \t]+/;
const LEADING_LINE_PUNCTUATION = /^[,;:][ \t]*/;
const CLOSING_PUNCTUATION_OR_BREAK = /^(?:[.,!?;:]|\n|\r|$)/;
/** A separator (and blanks) the text so far ends with. */
const TRAILING_SEPARATOR = /[,;:][ \t]*$/;

/**
 * Tidies the spacing around one removed placeholder. `out` is the text
 * produced so far, `rest` the original text after the token. Returns the
 * adjusted `out` and `rest`. Only whitespace and punctuation touching the
 * removal change; the rest of the text is left alone. A separator left
 * right before a closing mark, another separator or the end of a line goes
 * too: "Hei, {fornavn}!" becomes "Hei!", "Hei, {fornavn}, bussen" becomes
 * "Hei, bussen".
 */
function closeGap(out: string, rest: string): { out: string; rest: string } {
  const afterBlanks = rest.replace(LEADING_BLANKS, "");
  if (LINE_START.test(out)) {
    const orphan = LEADING_LINE_PUNCTUATION.exec(afterBlanks);
    return {
      out,
      rest: orphan ? afterBlanks.slice(orphan[0].length) : afterBlanks,
    };
  }
  if (CLOSING_PUNCTUATION_OR_BREAK.test(afterBlanks)) {
    return {
      out: out.replace(TRAILING_SEPARATOR, "").replace(TRAILING_BLANKS, ""),
      rest: afterBlanks,
    };
  }
  return { out, rest: afterBlanks };
}

export function renderText(
  text: string,
  vars: MessageVars,
  opts?: { forPush?: boolean }
): string {
  let out = "";
  let cursor = 0;
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const start = match.index ?? 0;
    const key = LABEL_TO_KEY.get(normalizeLabel(match[1] ?? ""));
    out += text.slice(cursor, start);
    cursor = start + match[0].length;
    if (!key) {
      out += match[0];
      continue;
    }
    const value = opts?.forPush && key === "first_name" ? "" : vars[key];
    if (value !== undefined && value.trim() !== "") {
      out += value;
      continue;
    }
    // Continue from the tidied remainder; matchAll offsets stay valid
    // because we only skip forward over text already consumed.
    const gap = closeGap(out, text.slice(cursor));
    out = gap.out;
    cursor = text.length - gap.rest.length;
  }
  return out + text.slice(cursor);
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
      body: "Hei {fornavn}! Du skal med {buss}. Den går {avgang} fra {oppmøtested}. {hjemreise}",
    },
    en: {
      title: "Your bus",
      body: "Hi {first name}! You're on {bus}. It leaves {departure} from {meeting point}. {trip home}",
    },
  },
  bus_moved: {
    no: {
      title: "Ny buss",
      body: "Hei {fornavn}! Bussplassen din er endret. Du er på {buss}. Den går {avgang} fra {oppmøtested}. {hjemreise}",
    },
    en: {
      title: "New bus",
      body: "Hi {first name}! Your bus seat has changed. You're on {bus}. It leaves {departure} from {meeting point}. {trip home}",
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
