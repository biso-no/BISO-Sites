import { ID, Permission, Role } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { sendEmail } from "@repo/connectors/email";
import { normalizePageDoc } from "@repo/editor/serialize";
import type { PageDoc } from "@repo/editor/types";
import { NextResponse } from "next/server";
import { cachedPublishedPage } from "@/lib/data/public-content";
import {
  isBisoRecipient,
  type ResolvedSubmission,
  resolveSubmission,
} from "@/lib/form-submit";
import { clampString, escapeHtml } from "@/lib/html-escape";
import { clientKeyFromHeaders, createRateLimiter } from "@/lib/rate-limit";

const OPERATIONS_UNIT_TEAM_ID = "sg-app-dept-operationsunit";
const MAX_SLUG_LENGTH = 300;
const MAX_ID_LENGTH = 100;
const SUBMISSIONS_PER_MINUTE = 5;
const MINUTE_MS = 60_000;
const LOCALES = ["no", "en"] as const;
type FormLocale = (typeof LOCALES)[number];

// Per source address, and only where the deployment says which address to
// trust (see `rate-limit.ts`). Unidentified callers are not limited.
const limiter = createRateLimiter({
  limit: SUBMISSIONS_PER_MINUTE,
  windowMs: MINUTE_MS,
});

interface FormRequest {
  blockId: string;
  data: unknown;
  locale: FormLocale;
  slug: string;
}

/**
 * Only these four fields are read. Anything else a caller sends (a recipient,
 * a mode, a topic, a team, a campus) is ignored: those come from the page.
 */
function parseRequest(input: unknown): FormRequest | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const { blockId, data, locale, slug } = input as Record<string, unknown>;
  if (
    typeof blockId !== "string" ||
    blockId.length === 0 ||
    blockId.length > MAX_ID_LENGTH ||
    typeof slug !== "string" ||
    slug.length === 0 ||
    slug.length > MAX_SLUG_LENGTH ||
    (locale !== "no" && locale !== "en")
  ) {
    return null;
  }
  return { blockId, data, locale, slug };
}

function fail(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

function row(label: string, value: string): string {
  return `<tr><td style="padding:6px 12px;font-weight:600;color:#555;">${escapeHtml(clampString(label, 200))}</td><td style="padding:6px 12px;">${escapeHtml(value)}</td></tr>`;
}

function displayValue(value: string | string[] | boolean): string {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return Array.isArray(value) ? value.join(", ") : value;
}

function buildEmail(submission: ResolvedSubmission) {
  const heading = escapeHtml(clampString(submission.formHeading, 200));
  const topic = escapeHtml(clampString(submission.topic, 100));
  const labelled = submission.fields.filter(
    ({ name }) => name in submission.data
  );
  const rows = labelled
    .map(({ label, name }) =>
      row(label, displayValue(submission.data[name] ?? ""))
    )
    .join("");
  const html = `
    <div style="font-family:'Museo Sans',system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="margin:0 0 4px;font-size:20px;">${heading}</h2>
      <p style="margin:0 0 20px;color:#888;font-size:13px;">New form submission</p>
      <table style="width:100%;border-collapse:collapse;background:#f9f9f9;border-radius:8px;overflow:hidden;">
        <tbody>${rows}</tbody>
      </table>
      <p style="margin:20px 0 0;font-size:11px;color:#aaa;">Sent via BISO page form · Topic: ${topic}</p>
    </div>`;
  const text = labelled
    .map(
      ({ label, name }) =>
        `${label}: ${displayValue(submission.data[name] ?? "")}`
    )
    .join("\n");
  return { html, text };
}

async function storeSubmission(
  submission: ResolvedSubmission,
  pageId: string,
  campusId: string | null
) {
  const permissions = [
    Permission.read(Role.team(OPERATIONS_UNIT_TEAM_ID)),
    Permission.update(Role.team(OPERATIONS_UNIT_TEAM_ID)),
    Permission.delete(Role.team(OPERATIONS_UNIT_TEAM_ID)),
  ];
  // The one extra team comes from the block on the published page.
  if (submission.accessTeamId) {
    permissions.push(
      Permission.read(Role.team(submission.accessTeamId)),
      Permission.update(Role.team(submission.accessTeamId))
    );
  }
  const { db } = await createAdminClient();
  await db.createRow(
    "app",
    "form_submissions",
    ID.unique(),
    {
      topic: submission.topic,
      form_heading: submission.formHeading,
      data_json: JSON.stringify(submission.data),
      status: "new",
      access_team_id: submission.accessTeamId ?? null,
      campus_id: campusId,
      page_id: pageId.slice(0, 50),
      source: submission.source,
    },
    permissions
  );
}

async function loadDoc(slug: string, locale: FormLocale) {
  const page = await cachedPublishedPage(slug, locale).catch(() => null);
  if (!page?.doc) {
    return null;
  }
  return {
    campusId: page.row.campus_id ?? null,
    doc: normalizePageDoc(page.doc as PageDoc),
    pageId: page.row.$id,
  };
}

export async function POST(request: Request) {
  const clientKey = clientKeyFromHeaders(request.headers);
  if (clientKey && !limiter.reserve(clientKey).allowed) {
    return fail("Too many submissions. Please wait a minute.", 429);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail("Invalid payload", 400);
  }
  const parsed = parseRequest(raw);
  if (!parsed) {
    return fail("Invalid payload", 400);
  }

  const loaded = await loadDoc(parsed.slug, parsed.locale);
  if (!loaded) {
    return fail("Form not found", 404);
  }
  const resolved = resolveSubmission(loaded.doc, parsed.blockId, parsed.data);
  if (!resolved.ok) {
    if (resolved.reason === "unknown-block") {
      return fail("Form not found", 404);
    }
    return fail("Invalid submission", 400);
  }
  const { submission } = resolved;

  try {
    if (submission.mode === "email") {
      if (!isBisoRecipient(submission.recipientEmail)) {
        // Deliberately without the submitter's answers.
        console.warn(
          "Form submit refused: recipient is not a @biso.no address",
          { blockId: parsed.blockId, slug: parsed.slug }
        );
        return fail("This form is not set up to send email.", 400);
      }
      const { html, text } = buildEmail(submission);
      await sendEmail({
        html,
        subject: `New submission: ${clampString(submission.formHeading, 200)}`,
        text,
        to: submission.recipientEmail,
      });
      return NextResponse.json({ success: true });
    }

    await storeSubmission(submission, loaded.pageId, loaded.campusId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Form submit error:", error);
    return fail("Submission failed", 500);
  }
}
