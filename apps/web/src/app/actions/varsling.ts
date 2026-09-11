"use server";

import { Query } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { Campus, VarslingSettings } from "@repo/api/types/appwrite";
import {
  isCertainNonDelivery,
  isSmtpConfigured,
  sendEmail,
} from "@repo/connectors/email";
import { headers } from "next/headers";
import {
  clampString,
  escapeHtml,
  escapeHtmlMultiline,
} from "@/lib/html-escape";
import { clientKeyFromHeaders, createRateLimiter } from "@/lib/rate-limit";

export interface VarslingSubmission {
  case_description: string;
  /** `$id` of the chosen `varsling_settings` row — the recipient is resolved
   *  server-side from this row, never from a client-supplied address. */
  setting_id: string;
  submission_type: "harassment" | "witness" | "other";
  submitter_email?: string;
}

const MAX_DESCRIPTION_LENGTH = 10_000;
const MAX_SHORT_FIELD_LENGTH = 200;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// This action is public and unauthenticated by design — a reporter must be
// able to file without an account — so nothing but this stands between a
// script and an unbounded run of real emails to the varsling contacts.
// Flooding those inboxes would bury genuine reports, which is the failure that
// matters here far more than the wasted relay quota.
//
// The window is deliberately loose. Whole campuses share a handful of NAT
// addresses, and turning a real reporter away is a worse outcome than
// accepting a few extra messages, so the limit sits well above any plausible
// burst of genuine reports while still capping a bot at 30/hour per address.
const SUBMISSIONS_PER_WINDOW = 5;
const SUBMISSION_WINDOW_MS = 10 * 60 * 1000;

// Never "please try again": a reporter who reads that may believe the case is
// filed, or burn their nerve retrying something that cannot work. Say what is
// known, and give them the route that works.
//
// Two messages, because two different things are known. Claiming certain
// non-delivery where the truth is "we lost the connection mid-send" could have
// someone re-file a sensitive disclosure that already arrived; softening it
// everywhere would let a report that certainly failed read as "probably fine"
// and go unfollowed. Both messages send them to a person either way.
const NOT_DELIVERED_ERROR =
  "Your report could NOT be delivered. Please contact one of the people listed on this page directly, so your case reaches someone.";

const DELIVERY_UNCONFIRMED_ERROR =
  "We could not confirm your report was delivered — it may not have arrived. Please contact one of the people listed on this page directly to be sure your case is received, and mention that you also used this form.";

const RATE_LIMITED_ERROR =
  "Too many reports have been submitted from this network. Please wait a few minutes and try again, or contact one of the people listed on this page directly.";

const submissionLimiter = createRateLimiter({
  limit: SUBMISSIONS_PER_WINDOW,
  windowMs: SUBMISSION_WINDOW_MS,
});

/**
 * The caller's rate-limit key, or `null` when they cannot be identified or the
 * lookup itself fails — in which case the submission proceeds unlimited. A
 * report lost to trouble in the limiter would be the worst possible bug in
 * this file.
 */
async function resolveClientKey(): Promise<string | null> {
  try {
    return clientKeyFromHeaders(await headers());
  } catch {
    return null;
  }
}

const SUBMISSION_LABELS: Record<VarslingSubmission["submission_type"], string> =
  {
    harassment: "Trakassering",
    witness: "Vitne",
    other: "Annet",
  };

// Get varsling settings for a specific campus
export async function getVarslingSettings(
  campusId?: string
): Promise<VarslingSettings[]> {
  try {
    // `varsling_settings` grants read("any"), so the visitor's (possibly
    // absent) session is enough for this public lookup.
    const { db } = await createSessionClient();

    const queries = [
      Query.equal("is_active", true),
      Query.orderAsc("sort_order"),
      Query.orderAsc("role_name"),
    ];

    if (campusId) {
      queries.unshift(Query.equal("campus_id", campusId));
    }

    const response = await db.listRows<VarslingSettings>(
      "app",
      "varsling_settings",
      queries
    );
    return response.rows;
  } catch (error) {
    console.error("Failed to fetch varsling settings:", error);
    return [];
  }
}

async function resolveCampusName(
  db: Awaited<ReturnType<typeof createAdminClient>>["db"],
  campusId: string
): Promise<string> {
  try {
    const campus = await db.getRow<Campus>("app", "campus", campusId);
    return campus.name ?? campusId;
  } catch {
    return campusId;
  }
}

interface VarslingEmailInput {
  campusName: string;
  caseDescription: string;
  roleName: string;
  submissionLabel: string;
  submitterEmail: string | null;
}

function buildVarslingEmail(input: VarslingEmailInput): string {
  const campus = escapeHtml(
    clampString(input.campusName, MAX_SHORT_FIELD_LENGTH)
  );
  const role = escapeHtml(clampString(input.roleName, MAX_SHORT_FIELD_LENGTH));
  const type = escapeHtml(
    clampString(input.submissionLabel, MAX_SHORT_FIELD_LENGTH)
  );
  const contact = input.submitterEmail
    ? `<p><strong>Kontakt e-post:</strong> ${escapeHtml(
        clampString(input.submitterEmail, MAX_SHORT_FIELD_LENGTH)
      )}</p>`
    : "<p><strong>Kontakt:</strong> Anonym</p>";
  // Escape first, then turn newlines into <br> — never the other way around.
  const description = escapeHtmlMultiline(
    clampString(input.caseDescription, MAX_DESCRIPTION_LENGTH)
  );

  return `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="margin:0 0 16px;font-size:20px;">BISO Varsling – ny sak</h2>
      <p><strong>Campus:</strong> ${campus}</p>
      <p><strong>Rolle:</strong> ${role}</p>
      <p><strong>Type:</strong> ${type}</p>
      ${contact}
      <h3 style="margin:20px 0 8px;font-size:16px;">Beskrivelse</h3>
      <p style="white-space:pre-wrap;">${description}</p>
      <hr style="margin:24px 0;border:none;border-top:1px solid #e5e5e5;" />
      <p style="font-size:11px;color:#aaa;">Dette er en automatisk generert e-post fra BISO varslingssystem.</p>
    </div>`;
}

/**
 * Plain-text alternative to the HTML body. A `text/plain` part meaningfully
 * improves how spam filters score transactional mail, which matters here: a
 * whistleblowing report that lands in a junk folder is a report nobody reads.
 */
function buildVarslingText(input: VarslingEmailInput): string {
  const contact = input.submitterEmail
    ? `Kontakt e-post: ${clampString(input.submitterEmail, MAX_SHORT_FIELD_LENGTH)}`
    : "Kontakt: Anonym";

  return [
    "BISO Varsling – ny sak",
    "",
    `Campus: ${clampString(input.campusName, MAX_SHORT_FIELD_LENGTH)}`,
    `Rolle: ${clampString(input.roleName, MAX_SHORT_FIELD_LENGTH)}`,
    `Type: ${clampString(input.submissionLabel, MAX_SHORT_FIELD_LENGTH)}`,
    contact,
    "",
    "Beskrivelse:",
    clampString(input.caseDescription, MAX_DESCRIPTION_LENGTH),
    "",
    "--",
    "Dette er en automatisk generert e-post fra BISO varslingssystem.",
  ].join("\n");
}

// Submit varsling case (public)
export async function submitVarslingCase(
  data: VarslingSubmission
): Promise<{ success: boolean; error?: string }> {
  const description = data.case_description?.trim() ?? "";
  if (!(data.setting_id && description)) {
    return { success: false, error: "Missing required fields." };
  }

  const submitterEmail = data.submitter_email?.trim() || null;
  if (submitterEmail && !EMAIL_PATTERN.test(submitterEmail)) {
    return { success: false, error: "Invalid contact email address." };
  }

  // Checked before anything else: with no relay configured every submission is
  // going to fail, and a reporter should learn that immediately rather than
  // after a lookup — and without spending a rate-limit slot on it. Logged at
  // error level because a deployment in this state silently accepts nothing.
  if (!isSmtpConfigured()) {
    console.error(
      "[varsling] SMTP is not configured — set SMTP_HOST and SMTP_FROM. No report can be delivered until then."
    );
    // Nothing was attempted, so certain non-delivery is the honest claim.
    return { success: false, error: NOT_DELIVERED_ERROR };
  }

  // A cheap early rejection so a sustained flood from an exhausted key never
  // reaches Appwrite. It reserves nothing — the binding gate is the `reserve`
  // immediately before the send.
  const clientKey = await resolveClientKey();
  if (clientKey && !submissionLimiter.check(clientKey).allowed) {
    return { success: false, error: RATE_LIMITED_ERROR };
  }

  // Everything above the send — building the Appwrite client, resolving the
  // recipient — can throw, and none of it puts a byte on the wire. Without
  // this the catch cannot tell "the relay went quiet mid-send" from "we never
  // got as far as the relay", and would soften a certain failure into an
  // unconfirmed one.
  let sendAttempted = false;

  try {
    const { db } = await createAdminClient();

    // Resolve the recipient from the database. Trusting a client-supplied
    // address here would turn this public action into an open mail relay.
    let setting: VarslingSettings;
    try {
      setting = await db.getRow<VarslingSettings>(
        "app",
        "varsling_settings",
        data.setting_id
      );
    } catch {
      return { success: false, error: "Unknown varsling recipient." };
    }
    if (!setting.is_active) {
      return { success: false, error: "This contact is no longer available." };
    }

    const campusName = await resolveCampusName(db, setting.campus_id);
    const submissionLabel = SUBMISSION_LABELS[data.submission_type] ?? "Annet";
    const emailInput: VarslingEmailInput = {
      campusName,
      caseDescription: description,
      roleName: setting.role_name,
      submissionLabel,
      submitterEmail,
    };

    // The binding gate, deliberately here: `reserve` is synchronous and there
    // is nothing awaited between it and the send, so a batch of concurrent
    // requests from one source is serialised through it and only `limit` of
    // them get through. Checking earlier and incrementing here instead would
    // let every request in that batch pass the check before any incremented.
    if (clientKey && !submissionLimiter.reserve(clientKey).allowed) {
      return { success: false, error: RATE_LIMITED_ERROR };
    }

    // SMTP, not Appwrite Messaging: `messaging.createEmail()` addresses
    // *targets*, which only exist for Appwrite users. Varsling recipients are
    // staff mailboxes that may never sign in to the project, so the message
    // has to leave over a plain relay.
    sendAttempted = true;
    await sendEmail({
      html: buildVarslingEmail(emailInput),
      // Only set when the reporter chose to be reachable; an anonymous report
      // stays anonymous.
      replyTo: submitterEmail ?? undefined,
      subject: `BISO Varsling: ${submissionLabel}`,
      text: buildVarslingText(emailInput),
      to: setting.email,
    });

    return { success: true };
  } catch (error) {
    // The message carries the reason — a relay refusal, a TLS failure, an
    // Appwrite timeout — and is the only record of a report that did not make
    // it. Keep it whole.
    console.error("[varsling] Failed to deliver a report:", error);

    // Delivery is in doubt only if a send was actually under way. A failure
    // before that — no Appwrite client, no recipient row — never reached the
    // relay, so say so plainly rather than asking the reporter to warn someone
    // about a duplicate that cannot exist. Past the send, only an explicit
    // refusal proves anything: a reset or a timeout may have been queued on
    // the far side already.
    const certain = !sendAttempted || isCertainNonDelivery(error);

    return {
      success: false,
      error: certain ? NOT_DELIVERED_ERROR : DELIVERY_UNCONFIRMED_ERROR,
    };
  }
}
