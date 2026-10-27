import { ID, Permission, Role } from "@repo/api";
import { getPage } from "@repo/api/page-builder";
import { createAdminClient } from "@repo/api/server";
import { PagesVisibility } from "@repo/api/types/appwrite";
import { sendEmail } from "@repo/connectors/email";
import { normalizePageDoc } from "@repo/editor/serialize";
import { isBisoRecipient } from "@repo/editor/submit-rules";
import type { PageDoc } from "@repo/editor/types";
import {
  isProjectNamespaceSlug,
  isProjectSlug,
} from "@repo/shared/utils/project-units";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/cookie-prefs";
import {
  cachedPublishedPage,
  isPublishedPage,
} from "@/lib/data/public-content";
import { type ResolvedSubmission, resolveSubmission } from "@/lib/form-submit";
import { clampString, escapeHtml } from "@/lib/html-escape";
import { clientKeyFromHeaders, createRateLimiter } from "@/lib/rate-limit";
import {
  findCanonicalUnit,
  projectPageIsGenuine,
  publishedUnitPage,
} from "@/lib/unit-page";

const OPERATIONS_UNIT_TEAM_ID = "sg-app-dept-operationsunit";
/** The `page_translations`/`pages` slug column size. */
const MAX_SLUG_LENGTH = 128;
/**
 * What a stored slug can hold: admin saves it trimmed and nothing more, so it
 * may carry capitals and non-ASCII letters (`Om-BISO`, `fadderuka-ø`). Letters,
 * digits and `/ . _ ~ -` only: no whitespace or control characters. Passed to
 * the page reader exactly as received, never lowercased.
 */
const SLUG_SHAPE = /^[\p{L}\p{N}][\p{L}\p{N}/._~-]*$/u;
/** Largest request body read: a full 16 KiB answer set plus JSON overhead. */
const MAX_BODY_BYTES = 32 * 1024;
const MAX_DATA_KEYS = 100;
const UNIT_SLUG_PARTS = 3;
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
  const plainObject =
    typeof data === "object" && data !== null && !Array.isArray(data);
  if (
    !plainObject ||
    Object.keys(data).length > MAX_DATA_KEYS ||
    typeof blockId !== "string" ||
    blockId.length === 0 ||
    blockId.length > MAX_ID_LENGTH ||
    typeof slug !== "string" ||
    slug.length === 0 ||
    slug.length > MAX_SLUG_LENGTH ||
    !SLUG_SHAPE.test(slug) ||
    (locale !== "no" && locale !== "en")
  ) {
    return null;
  }
  return { blockId, data, locale, slug };
}

/**
 * The request text, or null when it is over the cap. Bounded twice: a
 * declared `content-length` is refused up front, and the stream is read
 * through a counter that stops at the cap, so a chunked body or a header that
 * lies cannot make the server buffer more.
 */
async function readCapped(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return null;
  }
  if (!request.body) {
    return "";
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
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

type PageResult = Awaited<ReturnType<typeof cachedPublishedPage>>;

/**
 * The page the public cache cannot see. It is read with the admin client only
 * to learn that a published page is members-only (never to serve it): drafts
 * and public pages come back null.
 */
async function findPublishedMembersPage(
  slug: string,
  locale: FormLocale
): Promise<PageResult> {
  try {
    const { db } = await createAdminClient();
    const page = await getPage(slug, locale, db);
    return isPublishedPage(page) &&
      page?.row.visibility === PagesVisibility.AUTHENTICATED
      ? page
      : null;
  } catch {
    return null;
  }
}

/**
 * Whether the caller is a member. Same proof the catch-all uses: the visitor's
 * own session reads the row, and Appwrite lets only the `biso-members` team
 * do that. No cookie means no session; one is never minted here.
 */
async function sessionCanReadPage(
  slug: string,
  locale: FormLocale
): Promise<boolean> {
  try {
    if (!(await cookies()).get(SESSION_COOKIE)) {
      return false;
    }
    return isPublishedPage(await getPage(slug, locale));
  } catch {
    return false;
  }
}

/** The page and whether it was found only through the members-only path. */
async function findPage(slug: string, locale: FormLocale) {
  const page = await cachedPublishedPage(slug, locale).catch(() => null);
  if (page) {
    return { membersOnly: false, page };
  }
  // Unit and project routes render only from the public cache, so a
  // members-only page is never visible there: no admin read at all.
  if (slug.startsWith("units/") || isProjectNamespaceSlug(slug)) {
    return { membersOnly: false, page: null };
  }
  const members = await findPublishedMembersPage(slug, locale);
  return { membersOnly: members !== null, page: members };
}

async function loadDoc(slug: string, locale: FormLocale) {
  const { membersOnly, page } = await findPage(slug, locale);
  if (!page?.doc) {
    return null;
  }
  // Before the unit/project branches, which return early: a members-only page
  // is never served to anyone but a member, whatever its slug.
  if (membersOnly && !(await sessionCanReadPage(slug, locale))) {
    // Same answer as a missing page, like the catch-all.
    return null;
  }
  const base = { campusId: page.row.campus_id ?? null, pageId: page.row.$id };

  if (slug.startsWith("units/")) {
    // Exactly the pages the site renders for a unit: the slug must be the
    // department's canonical one and the page must belong to it.
    const parts = slug.split("/");
    const unit =
      parts.length === UNIT_SLUG_PARTS
        ? await findCanonicalUnit(parts[1] ?? "", parts[2] ?? "").catch(
            () => null
          )
        : null;
    if (!unit || unit.canonical.slice(1) !== slug) {
      return null;
    }
    const owned = publishedUnitPage(page, unit.department.$id);
    return owned ? { ...base, doc: owned.doc } : null;
  }

  // Reserved like `units/`: only the page of a known project is served there.
  if (isProjectNamespaceSlug(slug)) {
    const project = slug.trim().toLowerCase().slice("projects/".length);
    if (!isProjectSlug(project)) {
      return null;
    }
    if (!(await projectPageIsGenuine(page, project))) {
      return null;
    }
  }

  return { ...base, doc: normalizePageDoc(page.doc as PageDoc) };
}

export async function POST(request: Request) {
  const clientKey = clientKeyFromHeaders(request.headers);
  if (clientKey && !limiter.reserve(clientKey).allowed) {
    return fail("Too many submissions. Please wait a minute.", 429);
  }

  let raw: unknown;
  try {
    const bodyText = await readCapped(request);
    if (bodyText === null) {
      return fail("Request too large", 413);
    }
    raw = JSON.parse(bodyText);
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
  if (submission.teamDropped) {
    // Deliberately without the submitter's answers.
    console.warn("Form submit: access team is not a valid id; no grant made", {
      blockId: parsed.blockId,
      slug: parsed.slug,
    });
  }

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
