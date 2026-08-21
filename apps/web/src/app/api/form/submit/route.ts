import { ID, Permission, Role } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { consume, RATE_LIMITS } from "@repo/shared/utils/rate-limit";
import { NextResponse } from "next/server";

interface SubmitPayload {
  accessTeamId?: string;
  campusId?: string;
  data: Record<string, unknown>;
  formHeading?: string;
  mode: "database" | "email";
  recipientEmail?: string;
  source?: string;
  topic: string;
}

const MAX_FIELD_LENGTH = 5000;
const MAX_FIELDS = 100;
const MAX_TOPIC_LENGTH = 200;
const OPERATIONS_UNIT_TEAM_ID = "sg-app-dept-operationsunit";

/**
 * This endpoint is unauthenticated by design — anyone filling in a form block
 * on a public page posts here. In email mode it sends an HTML message through
 * BISO's Appwrite messaging, so without a constraint on the recipient it is an
 * open mail relay: an attacker picks the destination and, via `data`, the body,
 * and the mail leaves from BISO's sending identity. That is a domain-reputation
 * and phishing problem, not just spam.
 *
 * The recipient is configured by an editor in the block inspector and then sent
 * back by the browser, so it cannot be trusted as received. Restricting it to
 * the organisation's own domain is what makes that untrusted value safe: the
 * worst an attacker can now do is mail a BISO inbox, which rate limiting bounds.
 *
 * Tighten further by resolving the address from the stored page document
 * instead of the request body — that removes the trust question entirely.
 */
const ORG_MAIL_DOMAIN = process.env.M365_DOMAIN || "biso.no";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEAM_ID_PATTERN = /^[a-zA-Z0-9._-]{1,36}$/;

function isOrgRecipient(email: string): boolean {
  if (!EMAIL_PATTERN.test(email)) {
    return false;
  }
  const domain = email.split("@").at(-1)?.toLowerCase();
  return domain === ORG_MAIL_DOMAIN.toLowerCase();
}
const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

function clampString(value: unknown, max: number): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = typeof value === "string" ? value : JSON.stringify(value);
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

function validatePayload(
  input: unknown
): { ok: true; value: SubmitPayload } | { ok: false; message: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, message: "Invalid payload" };
  }

  const payload = input as Record<string, unknown>;
  const topic = payload.topic;
  if (typeof topic !== "string" || topic.length === 0) {
    return { ok: false, message: "Missing required field: topic" };
  }
  if (topic.length > MAX_TOPIC_LENGTH) {
    return { ok: false, message: "Topic too long" };
  }

  if (!payload.data || typeof payload.data !== "object") {
    return { ok: false, message: "Missing required field: data" };
  }
  const data = payload.data as Record<string, unknown>;
  if (Object.keys(data).length > MAX_FIELDS) {
    return { ok: false, message: "Too many fields" };
  }

  const mode = payload.mode;
  if (mode !== "email" && mode !== "database") {
    return { ok: false, message: "Invalid mode" };
  }

  return {
    ok: true,
    value: {
      mode,
      topic,
      data,
      formHeading:
        typeof payload.formHeading === "string"
          ? payload.formHeading.slice(0, MAX_TOPIC_LENGTH)
          : undefined,
      accessTeamId:
        typeof payload.accessTeamId === "string"
          ? payload.accessTeamId
          : undefined,
      campusId:
        typeof payload.campusId === "string" ? payload.campusId : undefined,
      source: typeof payload.source === "string" ? payload.source : undefined,
      recipientEmail:
        typeof payload.recipientEmail === "string"
          ? payload.recipientEmail
          : undefined,
    },
  };
}

export async function POST(request: Request) {
  // Anonymous endpoint, so the budget keys on the caller IP. See the note on
  // `consume()` about what a per-instance limiter does and does not cover.
  const forwarded = request.headers.get("x-forwarded-for");
  const callerIp =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";
  const budget = consume(
    `form-submit:ip:${callerIp}`,
    RATE_LIMITS.publicFormSubmit
  );

  if (!budget.allowed) {
    return NextResponse.json(
      {
        success: false,
        message: "Too many submissions. Please wait a moment and try again.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(budget.retryAfterSeconds) },
      }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid payload" },
      { status: 400 }
    );
  }

  const validated = validatePayload(raw);
  if (!validated.ok) {
    return NextResponse.json(
      { success: false, message: validated.message },
      { status: 400 }
    );
  }

  const {
    mode,
    topic,
    data,
    formHeading,
    accessTeamId,
    campusId,
    source,
    recipientEmail,
  } = validated.value;

  try {
    const { db, messaging } = await createAdminClient();

    if (mode === "email") {
      if (!recipientEmail) {
        return NextResponse.json(
          { success: false, message: "No recipient email configured" },
          { status: 400 }
        );
      }

      if (!isOrgRecipient(recipientEmail)) {
        console.warn(
          `[form/submit] refused delivery to non-org recipient: ${recipientEmail}`
        );
        return NextResponse.json(
          {
            success: false,
            message: "This form is not configured with a valid recipient.",
          },
          { status: 400 }
        );
      }

      const heading = escapeHtml(
        clampString(formHeading ?? topic, MAX_TOPIC_LENGTH)
      );
      const safeTopic = escapeHtml(clampString(topic, MAX_TOPIC_LENGTH));
      const fieldRows = Object.entries(data)
        .slice(0, MAX_FIELDS)
        .map(([k, v]) => {
          const key = escapeHtml(clampString(k, MAX_TOPIC_LENGTH));
          const value = escapeHtml(clampString(v, MAX_FIELD_LENGTH));
          return `<tr><td style="padding:6px 12px;font-weight:600;color:#555;">${key}</td><td style="padding:6px 12px;">${value}</td></tr>`;
        })
        .join("");

      const html = `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="margin:0 0 4px;font-size:20px;">${heading}</h2>
          <p style="margin:0 0 20px;color:#888;font-size:13px;">New form submission</p>
          <table style="width:100%;border-collapse:collapse;background:#f9f9f9;border-radius:8px;overflow:hidden;">
            <tbody>${fieldRows}</tbody>
          </table>
          <p style="margin:20px 0 0;font-size:11px;color:#aaa;">Sent via BISO page form · Topic: ${safeTopic}</p>
        </div>`;

      await messaging.createEmail(
        ID.unique(),
        `New submission: ${clampString(formHeading ?? topic, MAX_TOPIC_LENGTH)}`,
        html,
        [],
        [],
        [recipientEmail],
        [],
        [],
        [],
        false,
        true,
        new Date(Date.now() + 30_000).toISOString()
      );

      return NextResponse.json({ success: true });
    }

    // Database mode — store submission with row-level permissions
    const rowPermissions: string[] = [
      Permission.read(Role.team(OPERATIONS_UNIT_TEAM_ID)),
      Permission.update(Role.team(OPERATIONS_UNIT_TEAM_ID)),
      Permission.delete(Role.team(OPERATIONS_UNIT_TEAM_ID)),
    ];

    // `accessTeamId` arrives from the browser and is written straight into the
    // row ACL, so it is shape-checked before it becomes a permission. A bad id
    // is dropped rather than rejected: the submission itself is still valuable,
    // and Operations Unit retains access either way.
    if (accessTeamId && TEAM_ID_PATTERN.test(accessTeamId)) {
      rowPermissions.push(Permission.read(Role.team(accessTeamId)));
      rowPermissions.push(Permission.update(Role.team(accessTeamId)));
    } else if (accessTeamId) {
      console.warn(
        `[form/submit] ignored malformed accessTeamId: ${accessTeamId}`
      );
    }

    await db.createRow(
      "app",
      "form_submissions",
      ID.unique(),
      {
        topic,
        form_heading: formHeading ?? topic,
        data_json: JSON.stringify(data),
        status: "new",
        access_team_id: accessTeamId ?? null,
        campus_id: campusId ?? null,
        source: source ?? "multiStepForm",
      },
      rowPermissions
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Form submit error:", error);
    return NextResponse.json(
      { success: false, message: "Submission failed" },
      { status: 500 }
    );
  }
}
