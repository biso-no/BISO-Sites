import { CAMPUS_NAME_TO_ID } from "@/lib/campus-constants";

export { normalizePhone } from "@repo/shared/big-events/phone";

const WHITESPACE = /\s+/g;
const CAMPUS_PATTERN = /\b(oslo|bergen|trondheim|stavanger)\b/i;
const ROOM_SIZE_PATTERN = /\b(\d+)\s*-?\s*(?:person|pers\b|personsrom)/i;
const SINGLE_ROOM_PATTERN = /\benkeltrom\b/i;
const DOUBLE_ROOM_PATTERN = /\bdobbeltrom\b/i;
const CAMPUS_KEYS: Record<string, string> = {
  oslo: "Oslo",
  bergen: "Bergen",
  trondheim: "Trondheim",
  stavanger: "Stavanger",
};

export function normalizeName(value: string): string {
  return value
    .normalize("NFC")
    .toLocaleLowerCase("nb")
    .replace(WHITESPACE, " ")
    .trim();
}

export function splitFullName(full: string): {
  first: string;
  last: string | null;
} {
  const words = full.trim().split(WHITESPACE).filter(Boolean);
  if (words.length <= 1) {
    return { first: words[0] ?? "", last: null };
  }
  return { first: words.slice(0, -1).join(" "), last: words.at(-1) ?? null };
}

export function parseCampus(text: string | null | undefined): string | null {
  const match = text ? CAMPUS_PATTERN.exec(text) : null;
  if (!match) {
    return null;
  }
  return CAMPUS_NAME_TO_ID[CAMPUS_KEYS[match[1].toLowerCase()]] ?? null;
}

export function parseRoomSize(text: string | null | undefined): number | null {
  if (!text) {
    return null;
  }
  if (SINGLE_ROOM_PATTERN.test(text)) {
    return 1;
  }
  if (DOUBLE_ROOM_PATTERN.test(text)) {
    return 2;
  }
  const match = ROOM_SIZE_PATTERN.exec(text);
  return match ? Number(match[1]) : null;
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  const email = raw?.trim().toLowerCase();
  return email?.includes("@") ? email : null;
}
