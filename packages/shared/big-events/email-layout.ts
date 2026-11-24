/**
 * The one HTML email layout for big events (connect emails, reminders and,
 * later, organizer messages): a white card on BISO navy, one block per
 * language with a hairline between them, and a matching plain-text version.
 * Built from tables and inline styles so it holds up in Outlook and Gmail.
 * Every piece of text is escaped; http(s) addresses in paragraphs and the
 * footer become links. Pure: no env reads, no I/O.
 */

export type EmailLang = "no" | "en";

export interface EmailButton {
  label: string;
  url: string;
}

/** One line "{text}: {label}" where the label links to `url` (e.g. a person and their own link). */
export interface EmailLink {
  label: string;
  text: string;
  url: string;
}

export interface EmailSection {
  button?: EmailButton;
  heading: string;
  lang: EmailLang;
  /** Shown after the paragraphs, one per line. */
  links?: EmailLink[];
  paragraphs: string[];
}

export interface EmailInput {
  /** May hold several lines (one per language). */
  footer: string;
  /** Hidden preview text shown by inboxes next to the subject. */
  preheader: string;
  sections: EmailSection[];
}

export interface RenderedEmail {
  html: string;
  text: string;
}

const NAVY = "#001731";
const SKY = "#3DA9E0";
const INK = "#1f2933";
const MUTED = "#52606d";
const HAIRLINE = "#dfe5ec";
const FOOTER_BG = "#f4f6f9";
const FONT = "Arial,Helvetica,sans-serif";
const TEXT_RULE = "-".repeat(40);

const HTML_ESCAPES: Record<string, string> = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&#39;",
  "<": "&lt;",
  ">": "&gt;",
};
const HTML_ESCAPE_RE = /[&<>"']/g;
const HTTP_URL_RE = /^https?:\/\//i;
// An http(s) address in running text; trailing punctuation stays outside.
const INLINE_URL_RE = /https?:\/\/[^\s<>"']*[^\s<>"'.,;:!?)]/g;

const TABLE_ATTRS =
  'role="presentation" cellpadding="0" cellspacing="0" border="0"';
const LINK_STYLE = `color:${NAVY};font-weight:700;text-decoration:underline;`;
const PARAGRAPH_STYLE = "margin:0 0 16px;font-size:16px;line-height:24px;";

function escapeHtml(value: string): string {
  return value.replace(HTML_ESCAPE_RE, (char) => HTML_ESCAPES[char] ?? char);
}

function safeHref(url: string): string {
  const trimmed = url.trim();
  if (!HTTP_URL_RE.test(trimmed)) {
    throw new Error("Email links must be http(s) addresses.");
  }
  return escapeHtml(trimmed);
}

function anchor(url: string, label: string): string {
  return `<a href="${safeHref(url)}" style="${LINK_STYLE}">${escapeHtml(label)}</a>`;
}

/** Escaped text with http(s) addresses linked and line breaks kept. */
function richText(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      let html = "";
      let last = 0;
      for (const match of line.matchAll(INLINE_URL_RE)) {
        html += escapeHtml(line.slice(last, match.index));
        html += anchor(match[0], match[0]);
        last = match.index + match[0].length;
      }
      return html + escapeHtml(line.slice(last));
    })
    .join("<br>");
}

function buttonHtml(button: EmailButton): string {
  return [
    `<table ${TABLE_ATTRS} style="margin:8px 0 0;">`,
    `<tr><td bgcolor="${SKY}" style="border-radius:6px;background-color:${SKY};">`,
    `<a href="${safeHref(button.url)}" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:700;color:${NAVY};text-decoration:none;border-radius:6px;">`,
    escapeHtml(button.label),
    "</a></td></tr></table>",
  ].join("");
}

function sectionHtml(section: EmailSection): string {
  const paragraphs = section.paragraphs.map(
    (paragraph) => `<p style="${PARAGRAPH_STYLE}">${richText(paragraph)}</p>`
  );
  const links = (section.links ?? []).map(
    (link) =>
      `<p style="margin:0 0 8px;font-size:16px;line-height:24px;">${escapeHtml(link.text)}: ${anchor(link.url, link.label)}</p>`
  );
  return [
    `<tr><td lang="${section.lang}" style="padding:28px 32px;font-family:${FONT};color:${INK};">`,
    `<h1 style="margin:0 0 16px;font-size:22px;line-height:28px;font-weight:700;color:${NAVY};">${escapeHtml(section.heading)}</h1>`,
    ...paragraphs,
    ...links,
    section.button ? buttonHtml(section.button) : "",
    "</td></tr>",
  ].join("");
}

const HAIRLINE_ROW = [
  '<tr><td style="padding:0 32px;">',
  `<table ${TABLE_ATTRS} width="100%"><tr>`,
  `<td style="border-top:1px solid ${HAIRLINE};font-size:1px;line-height:1px;">&nbsp;</td>`,
  "</tr></table></td></tr>",
].join("");

function sectionText(section: EmailSection): string {
  const blocks = [section.heading, ...section.paragraphs];
  if (section.links?.length) {
    blocks.push(
      section.links.map((link) => `${link.text}: ${link.url.trim()}`).join("\n")
    );
  }
  if (section.button) {
    blocks.push(`${section.button.label}: ${section.button.url.trim()}`);
  }
  return blocks.join("\n\n");
}

export function renderEmail(input: EmailInput): RenderedEmail {
  const lang = input.sections[0]?.lang ?? "no";
  const sections = input.sections.map(sectionHtml).join(HAIRLINE_ROW);

  const html = [
    "<!DOCTYPE html>",
    `<html lang="${lang}"><head>`,
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="light">',
    '<meta name="supported-color-schemes" content="light">',
    `<title>${escapeHtml(input.sections[0]?.heading ?? "BISO")}</title>`,
    "</head>",
    `<body style="margin:0;padding:0;background-color:${NAVY};">`,
    `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(input.preheader)}</div>`,
    `<table ${TABLE_ATTRS} width="100%" bgcolor="${NAVY}" style="background-color:${NAVY};">`,
    '<tr><td align="center" style="padding:24px 12px;">',
    `<table ${TABLE_ATTRS} width="100%" style="max-width:560px;">`,
    `<tr><td style="padding:0 0 16px;font-family:${FONT};font-size:20px;line-height:24px;font-weight:700;letter-spacing:2px;color:#ffffff;">BISO</td></tr>`,
    "<tr><td>",
    `<table ${TABLE_ATTRS} width="100%" bgcolor="#ffffff" style="background-color:#ffffff;border-radius:8px;">`,
    sections,
    `<tr><td style="padding:20px 32px;font-family:${FONT};font-size:13px;line-height:20px;color:${MUTED};background-color:${FOOTER_BG};border-radius:0 0 8px 8px;">${richText(input.footer)}</td></tr>`,
    "</table>",
    "</td></tr></table>",
    "</td></tr></table>",
    "</body></html>",
  ].join("");

  const text = [...input.sections.map(sectionText), input.footer].join(
    `\n\n${TEXT_RULE}\n\n`
  );

  return { html, text: `${text}\n` };
}
