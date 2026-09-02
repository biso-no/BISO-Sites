"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { Campus, VarslingSettings } from "@repo/api/types/appwrite";
import {
  clampString,
  escapeHtml,
  escapeHtmlMultiline,
} from "@/lib/html-escape";

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
const SCHEDULE_DELAY_MS = 30_000;

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

function buildVarslingEmail(input: {
  campusName: string;
  caseDescription: string;
  roleName: string;
  submissionLabel: string;
  submitterEmail: string | null;
}): string {
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

  try {
    // Appwrite Messaging requires an API key with `messages.write`; a public
    // (often session-less) visitor has no such scope, so the send must go
    // through the service client — same pattern as /api/form/submit.
    const { db, messaging } = await createAdminClient();

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

    await messaging.createEmail(
      ID.unique(),
      `BISO Varsling: ${submissionLabel}`,
      buildVarslingEmail({
        campusName,
        caseDescription: description,
        roleName: setting.role_name,
        submissionLabel,
        submitterEmail,
      }),
      [], // topics
      [], // users
      [setting.email], // targets — the recipient address goes here
      [], // cc
      [], // bcc
      [], // attachments
      false, // draft
      true, // html
      new Date(Date.now() + SCHEDULE_DELAY_MS).toISOString()
    );

    return { success: true };
  } catch (error) {
    console.error("Failed to submit varsling case:", error);
    return {
      success: false,
      error: "Failed to submit varsling case. Please try again.",
    };
  }
}
