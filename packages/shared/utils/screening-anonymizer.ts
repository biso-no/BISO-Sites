/**
 * Data minimisation for AI candidate screening (GDPR art. 5(1)(c)).
 *
 * Free text from applicants (cover letter, CV, custom answers) is scrubbed of
 * direct identifiers before it is sent to a model provider. This is
 * best-effort pseudonymisation, not guaranteed anonymisation — regexes cannot
 * catch every identifier, so the screening prompt also instructs the model to
 * disregard protected characteristics.
 */

export const CANDIDATE_PLACEHOLDER = "[Candidate]";

const EMAIL_PATTERN = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu;

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>()]+/giu;

// Bare domains such as `github.com/user` or `heiendev.com`. Restricted to
// common TLDs so abbreviations like "e.g." or "Inc." are left alone.
const COMMON_TLDS =
  "com|no|org|net|io|dev|app|me|co|uk|se|dk|de|eu|info|biz|xyz|page|site";

const BARE_DOMAIN_PATTERN = new RegExp(
  `\\b[\\p{L}\\p{N}-]+(?:\\.[\\p{L}\\p{N}-]+)*\\.(?:${COMMON_TLDS})\\b(?:\\/[^\\s<>()]*)?`,
  "giu"
);

// Norwegian fødselsnummer / D-number: 11 digits, optionally split 6+5.
const NATIONAL_ID_PATTERN = /\b\d{6}\s?\d{5}\b/g;

const INTERNATIONAL_PHONE_PATTERN =
  /(?:\+|\b00)\d{1,3}[\s-]?\(?\d{1,4}\)?(?:[\s-]?\d{2,4}){2,4}\b/g;

// Norwegian numbers written as "12 34 56 78", "123 45 678" or eight
// contiguous digits starting with 4 or 9 (mobile). Plain "2019 2023"-style
// year ranges intentionally do not match.
const NORWEGIAN_PHONE_PATTERN =
  /\b(?:\d{2} \d{2} \d{2} \d{2}|\d{3} \d{2} \d{3}|[49]\d{7})\b/g;

const LABELLED_BIRTH_DATE_PATTERN =
  /\b(?:født|fødselsdato|f\.dato|date of birth|birth ?date|dob|born)\b\s*:?\s*[^\n,;]{1,40}/giu;

const LABELLED_AGE_PATTERN = /\b(?:alder|age)\s*:\s*\d{1,2}\b/giu;

const AGE_PATTERN = /\b\d{2}\s?(?:år gammel|years old|y\/o)\b/giu;

const LABELLED_ADDRESS_PATTERN =
  /\b(?:adresse|address|bosted|postadresse)\s*:\s*[^\n]{1,80}/giu;

// Norwegian-style street addresses ("Nydalsveien 37", "Storgata 12B") and
// English ones ("12 Baker Street" is rare in this audience; suffix form only).
const STREET_ADDRESS_PATTERN =
  /\b\p{Lu}[\p{L}-]*(?:gate|gata|veien|vei|vegen|veg|allé|alle|plass|stien|bakken|street|road|avenue)\s+\d{1,4}\s?[A-Za-z]?\b(?:,?\s*\d{4}\s+\p{Lu}[\p{L}-]+)?/gu;

// A postcode + place directly after a redacted address, e.g. "0484 Oslo".
const TRAILING_POSTCODE_PATTERN = /(\[address\]),?\s*\d{4}\s+\p{Lu}[\p{L}-]+/gu;

const REPEATED_PLACEHOLDER_PATTERN = /\[Candidate\](?:\s+\[Candidate\])+/g;

const REGEX_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;

const NAME_SEPARATOR_PATTERN = /[\s,]+/;

const MIN_NAME_TOKEN_LENGTH = 2;

const EMAIL_PARTS_PATTERN = /([\p{L}\p{N}._%+-]+)@([\p{L}\p{N}.-]+)/gu;

// Captures the host and path of a URL. A bare host must end in a common TLD,
// so tech names like "Node.js/React" are not mistaken for URLs.
const URL_PARTS_PATTERN = new RegExp(
  `(?:https?:\\/\\/|www\\.)([^\\s/<>()]+)(\\/[^\\s<>()]*)?|\\b([\\p{L}\\p{N}-]+(?:\\.[\\p{L}\\p{N}-]+)*\\.(?:${COMMON_TLDS}))\\b(\\/[^\\s<>()]*)?`,
  "giu"
);

const HANDLE_SEGMENT_SEPARATOR_PATTERN = /[^\p{L}\p{N}]+/u;

const MIN_HANDLE_LENGTH = 4;

// Generic segments that show up in contact details but identify nobody.
const GENERIC_HANDLE_SEGMENTS = new Set([
  "about",
  "contact",
  "hello",
  "home",
  "info",
  "kontakt",
  "mail",
  "portfolio",
  "post",
  "profile",
  "users",
]);

export interface ScreeningAnonymizerOptions {
  /** Applicant's name; every token of it is replaced with a placeholder. */
  candidateName?: string | null;
  /** Further identifiers to strip (e.g. a known email or handle). */
  extraIdentifiers?: Array<string | null | undefined>;
}

function escapeRegex(value: string): string {
  return value.replace(REGEX_SPECIAL_CHARACTERS, "\\$&");
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

/**
 * Matches a name token only as a whole word. Case-sensitive on purpose, so a
 * first name that is also a common word ("Mark", "Rose") is only redacted
 * when written as a name — as-given, Capitalised, or UPPERCASE (CV headers).
 */
function buildNamePattern(token: string): RegExp {
  const variants = new Set([
    token,
    capitalize(token.toLocaleLowerCase()),
    token.toLocaleUpperCase(),
  ]);
  const alternation = [...variants].map(escapeRegex).join("|");
  return new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${alternation})(?![\\p{L}\\p{N}])`,
    "gu"
  );
}

function redactName(text: string, name: string): string {
  const tokens = name
    .split(NAME_SEPARATOR_PATTERN)
    .map((token) => token.trim())
    .filter((token) => token.length >= MIN_NAME_TOKEN_LENGTH)
    // Longest first so "Anne-Marie" is replaced before "Anne".
    .sort((a, b) => b.length - a.length);

  let result = text;
  for (const token of tokens) {
    result = result.replace(buildNamePattern(token), CANDIDATE_PLACEHOLDER);
  }
  return result.replace(REPEATED_PLACEHOLDER_PATTERN, CANDIDATE_PLACEHOLDER);
}

function redactLiteral(text: string, value: string): string {
  return text.replace(new RegExp(escapeRegex(value), "giu"), "[redacted]");
}

function nameTokens(name: string | null | undefined): string[] {
  return (name ?? "")
    .split(NAME_SEPARATOR_PATTERN)
    .map((token) => token.trim().toLocaleLowerCase())
    .filter((token) => token.length >= MIN_NAME_TOKEN_LENGTH);
}

function handleSegments(value: string): string[] {
  return value
    .split(HANDLE_SEGMENT_SEPARATOR_PATTERN)
    .map((segment) => segment.toLocaleLowerCase())
    .filter(
      (segment) =>
        segment.length >= MIN_HANDLE_LENGTH &&
        !GENERIC_HANDLE_SEGMENTS.has(segment)
    );
}

/**
 * Personal handles found in the candidate's contact details — email
 * local-parts, URL paths (`github.com/<handle>`), and domains that contain
 * their name (`<surname>dev.com`). These tend to reappear elsewhere, e.g. as a
 * personal brand in a CV header, and identify the candidate as surely as the
 * name does. Company domains ("equinor.com") are left alone so work history
 * stays readable.
 */
function collectPersonalHandles(
  text: string,
  candidateName: string | null | undefined
): Set<string> {
  const names = nameTokens(candidateName);
  const handles = new Set<string>();

  for (const [, localPart = ""] of text.matchAll(EMAIL_PARTS_PATTERN)) {
    for (const segment of handleSegments(localPart)) {
      handles.add(segment);
    }
  }

  for (const match of text.matchAll(URL_PARTS_PATTERN)) {
    const host = match[1] ?? match[3] ?? "";
    const path = match[2] ?? match[4] ?? "";
    for (const segment of handleSegments(path)) {
      handles.add(segment);
    }
    for (const label of host.split(".")) {
      const lower = label.toLocaleLowerCase();
      if (names.some((name) => lower.includes(name))) {
        handles.add(lower);
      }
    }
  }

  return handles;
}

function redactHandles(text: string, handles: Set<string>): string {
  let result = text;
  for (const handle of handles) {
    result = result.replace(
      new RegExp(
        `(?<![\\p{L}\\p{N}])${escapeRegex(handle)}(?![\\p{L}\\p{N}])`,
        "giu"
      ),
      "[handle]"
    );
  }
  return result;
}

/**
 * Strips direct identifiers from applicant free text before AI screening.
 * Order matters: emails and URLs go first so their fragments are not later
 * mistaken for names or phone numbers.
 */
export function anonymizeScreeningText(
  text: string | null | undefined,
  options: ScreeningAnonymizerOptions = {}
): string | null {
  if (text == null) {
    return null;
  }

  let result = text;

  for (const identifier of options.extraIdentifiers ?? []) {
    const trimmed = identifier?.trim();
    if (trimmed && trimmed.length >= MIN_NAME_TOKEN_LENGTH) {
      result = redactLiteral(result, trimmed);
    }
  }

  const handles = collectPersonalHandles(result, options.candidateName);

  result = result
    .replace(EMAIL_PATTERN, "[email]")
    .replace(URL_PATTERN, "[link]")
    .replace(BARE_DOMAIN_PATTERN, "[link]")
    .replace(NATIONAL_ID_PATTERN, "[national-id]")
    .replace(INTERNATIONAL_PHONE_PATTERN, "[phone]")
    .replace(NORWEGIAN_PHONE_PATTERN, "[phone]")
    .replace(LABELLED_BIRTH_DATE_PATTERN, "[date of birth]")
    .replace(LABELLED_AGE_PATTERN, "[age]")
    .replace(AGE_PATTERN, "[age]")
    .replace(LABELLED_ADDRESS_PATTERN, "[address]")
    .replace(STREET_ADDRESS_PATTERN, "[address]")
    .replace(TRAILING_POSTCODE_PATTERN, "$1");

  result = redactHandles(result, handles);

  const name = options.candidateName?.trim();
  if (name) {
    result = redactName(result, name);
  }

  return result;
}
