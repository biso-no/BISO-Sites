const NON_DIGIT_OR_PLUS = /[^\d+]/g;
const NORWEGIAN_PREFIX = "+47";
const NORWEGIAN_LENGTH = 8;
const MIN_DIGITS = 8;

/** Normalises a phone number to E.164-like form, assuming Norway for bare numbers. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  let cleaned = raw.replace(NON_DIGIT_OR_PLUS, "");
  if (cleaned.startsWith("00")) {
    cleaned = `+${cleaned.slice(2)}`;
  }
  const hasPlus = cleaned.startsWith("+");
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length < MIN_DIGITS) {
    return null;
  }
  if (hasPlus) {
    return `+${digits}`;
  }
  if (digits.length === NORWEGIAN_LENGTH) {
    return `${NORWEGIAN_PREFIX}${digits}`;
  }
  if (digits.startsWith("47") && digits.length === NORWEGIAN_LENGTH + 2) {
    return `+${digits}`;
  }
  return digits;
}

/** Formats a profile phone field may hold for a normalised number (for lookups). */
export function phoneVariants(normalized: string): string[] {
  if (
    !normalized.startsWith(NORWEGIAN_PREFIX) ||
    normalized.length !== NORWEGIAN_PREFIX.length + NORWEGIAN_LENGTH
  ) {
    return [normalized];
  }
  const local = normalized.slice(NORWEGIAN_PREFIX.length);
  const spaced = `${local.slice(0, 3)} ${local.slice(3, 5)} ${local.slice(5)}`;
  return [
    normalized,
    `47${local}`,
    local,
    `+47 ${local}`,
    `+47 ${spaced}`,
    spaced,
  ];
}
