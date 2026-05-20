import { ID, Permission, Role } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
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

export async function POST(request: Request) {
  let payload: SubmitPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid payload" },
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
  } = payload;

  if (!(topic && data)) {
    return NextResponse.json(
      { success: false, message: "Missing required fields" },
      { status: 400 }
    );
  }

  try {
    const { db, messaging } = await createAdminClient();

    if (mode === "email") {
      if (!recipientEmail) {
        return NextResponse.json(
          { success: false, message: "No recipient email configured" },
          { status: 400 }
        );
      }

      const fieldRows = Object.entries(data)
        .map(
          ([k, v]) =>
            `<tr><td style="padding:6px 12px;font-weight:600;color:#555;">${k}</td><td style="padding:6px 12px;">${String(v ?? "")}</td></tr>`
        )
        .join("");

      const html = `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="margin:0 0 4px;font-size:20px;">${formHeading ?? topic}</h2>
          <p style="margin:0 0 20px;color:#888;font-size:13px;">New form submission</p>
          <table style="width:100%;border-collapse:collapse;background:#f9f9f9;border-radius:8px;overflow:hidden;">
            <tbody>${fieldRows}</tbody>
          </table>
          <p style="margin:20px 0 0;font-size:11px;color:#aaa;">Sent via BISO page form · Topic: ${topic}</p>
        </div>`;

      await messaging.createEmail(
        ID.unique(),
        `New submission: ${formHeading ?? topic}`,
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
      Permission.read(Role.team("admin")),
      Permission.update(Role.team("admin")),
      Permission.delete(Role.team("admin")),
    ];

    if (accessTeamId) {
      rowPermissions.push(Permission.read(Role.team(accessTeamId)));
      rowPermissions.push(Permission.update(Role.team(accessTeamId)));
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
