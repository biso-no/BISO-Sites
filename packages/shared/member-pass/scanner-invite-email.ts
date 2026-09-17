/**
 * Invitation email for an external scanner (someone given scanning rights in
 * the BISO app by email). Norwegian first, English below. Pure: no env reads,
 * no I/O. The email carries no token or link that grants access by itself —
 * access follows the signed-in account.
 */

export interface ScannerInviteEmailInput {
  /** Google Play link. A value that is not http(s) is replaced by a search hint. */
  androidUrl: string | null;
  /** Campus the grant is for; null means all campuses. */
  campusName: string | null;
  /** The invited address — the one they must sign in with. */
  email: string;
  expiresAt: Date | null;
  inviterName: string;
  /** App Store link. Null (or not http(s)) → "search for BISO in the App Store". */
  iosUrl: string | null;
}

export interface ScannerInviteEmail {
  html: string;
  subject: string;
  text: string;
}

const TIME_ZONE = "Europe/Oslo";
const HTTP_URL_RE = /^https?:\/\//i;
const HTML_ESCAPES: Record<string, string> = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&#39;",
  "<": "&lt;",
  ">": "&gt;",
};
const HTML_ESCAPE_RE = /[&<>"']/g;

function escapeHtml(value: string): string {
  return value.replace(HTML_ESCAPE_RE, (char) => HTML_ESCAPES[char] ?? char);
}

function safeUrl(url: string | null): string | null {
  const trimmed = url?.trim();
  return trimmed && HTTP_URL_RE.test(trimmed) ? trimmed : null;
}

function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: TIME_ZONE,
  }).format(date);
}

/** One step line: plain text, or text with a trailing link. Store lines are indented. */
interface Line {
  indent?: boolean;
  link?: string;
  text: string;
}

interface Section {
  footer: string;
  greeting: string;
  intro: string;
  steps: Line[];
}

interface Copy {
  allCampuses: string;
  appStoreLabel: string;
  appStoreSearch: string;
  byDate: (date: string) => string;
  footer: string;
  forCampus: (campus: string) => string;
  greeting: string;
  intro: (inviter: string, scope: string, until: string) => string;
  locale: string;
  playLabel: string;
  playSearch: string;
  step1: string;
  step2: (email: string) => string;
  step3: string;
}

const NORWEGIAN: Copy = {
  allCampuses: "alle campuser",
  appStoreLabel: "App Store:",
  appStoreSearch: 'App Store: Søk etter "BISO" i App Store.',
  byDate: (date) => ` fram til ${date}`,
  footer:
    "Tilgangen kan trekkes tilbake når som helst. Skanneren viser aldri studentnummer eller e-postadresser.",
  forCampus: (campus) => `for ${campus}`,
  greeting: "Hei!",
  intro: (inviter, scope, until) =>
    `${inviter} har gitt deg tilgang til å skanne BISO-medlemskort ${scope}${until}.`,
  locale: "nb-NO",
  playLabel: "Google Play:",
  playSearch: 'Google Play: Søk etter "BISO" i Google Play.',
  step1: "1. Installer BISO-appen.",
  step2: (email) =>
    `2. Logg inn med akkurat denne e-postadressen: ${email} (du får en kode på e-post).`,
  step3: '3. Åpne Utforsk → "Skann medlemskap".',
};

const ENGLISH: Copy = {
  allCampuses: "all campuses",
  appStoreLabel: "App Store:",
  appStoreSearch: 'App Store: Search for "BISO" in the App Store.',
  byDate: (date) => ` until ${date}`,
  footer:
    "Access can be revoked at any time. The scanner never shows student numbers or email addresses.",
  forCampus: (campus) => `for ${campus}`,
  greeting: "Hi!",
  intro: (inviter, scope, until) =>
    `${inviter} has given you access to scan BISO membership passes ${scope}${until}.`,
  locale: "en-GB",
  playLabel: "Google Play:",
  playSearch: 'Google Play: Search for "BISO" in Google Play.',
  step1: "1. Install the BISO app.",
  step2: (email) =>
    `2. Sign in with this exact email address: ${email} (a code is sent to you by email).`,
  step3: '3. Open Explore → "Scan memberships".',
};

function buildSection(
  copy: Copy,
  input: ScannerInviteEmailInput,
  links: { android: string | null; ios: string | null }
): Section {
  const scope = copy.forCampus(input.campusName ?? copy.allCampuses);
  const until = input.expiresAt
    ? copy.byDate(formatDate(input.expiresAt, copy.locale))
    : "";
  return {
    footer: copy.footer,
    greeting: copy.greeting,
    intro: copy.intro(input.inviterName, scope, until),
    steps: [
      { text: copy.step1 },
      links.ios
        ? { indent: true, link: links.ios, text: copy.appStoreLabel }
        : { indent: true, text: copy.appStoreSearch },
      links.android
        ? { indent: true, link: links.android, text: copy.playLabel }
        : { indent: true, text: copy.playSearch },
      { text: copy.step2(input.email) },
      { text: copy.step3 },
    ],
  };
}

function sectionText(section: Section): string {
  const steps = section.steps.map((line) => {
    const indent = line.indent ? "   " : "";
    const link = line.link ? ` ${line.link}` : "";
    return `${indent}${line.text}${link}`;
  });
  return [
    section.greeting,
    "",
    section.intro,
    "",
    ...steps,
    "",
    section.footer,
  ].join("\n");
}

function sectionHtml(section: Section): string {
  const steps = section.steps
    .map((line) => {
      const style = line.indent ? ' style="padding-left:1.5em"' : "";
      const text = escapeHtml(line.text);
      if (!line.link) {
        return `<li${style}>${text}</li>`;
      }
      const href = escapeHtml(line.link);
      return `<li${style}>${text} <a href="${href}">${href}</a></li>`;
    })
    .join("");
  return [
    `<p>${escapeHtml(section.greeting)}</p>`,
    `<p>${escapeHtml(section.intro)}</p>`,
    `<ul style="list-style:none;padding-left:0">${steps}</ul>`,
    `<p style="color:#555">${escapeHtml(section.footer)}</p>`,
  ].join("");
}

export function buildScannerInviteEmail(
  input: ScannerInviteEmailInput
): ScannerInviteEmail {
  const links = {
    android: safeUrl(input.androidUrl),
    ios: safeUrl(input.iosUrl),
  };
  const norwegian = buildSection(NORWEGIAN, input, links);
  const english = buildSection(ENGLISH, input, links);

  return {
    html: [
      '<div style="font-family:system-ui,sans-serif;line-height:1.5">',
      sectionHtml(norwegian),
      '<hr style="border:none;border-top:1px solid #ddd;margin:24px 0">',
      sectionHtml(english),
      "</div>",
    ].join(""),
    subject: "Du kan nå skanne BISO-medlemskort / You can now scan BISO passes",
    text: `${sectionText(norwegian)}\n\n---\n\n${sectionText(english)}\n`,
  };
}
