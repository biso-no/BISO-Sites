import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog, getAdminScope } from "@/lib/admin-auth";
import { invalidateAppwriteUser } from "./appwrite-invalidation";

// Get webhook URL from environment
const AZURE_ACCOUNT_TURNOVER_WEBHOOK_URL =
  process.env.AZURE_ACCOUNT_TURNOVER_WEBHOOK_URL || "";

// Zod schema for account turnover
const accountTurnoverSchema = z.object({
  roleMailboxUpn: z.string().email("Valid role mailbox UPN required"),
  incomingUserUpn: z.string().email("Valid incoming user UPN required"),
  ensureShared: z.boolean().default(true),
  dryRun: z.boolean().default(false),
});

/**
 * POST /api/admin/account-turnover
 * Initiate account turnover by calling the Azure Automation webhook.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const scope = await getAdminScope(request);
    if (!scope) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate webhook URL is configured
    if (!AZURE_ACCOUNT_TURNOVER_WEBHOOK_URL) {
      return NextResponse.json(
        {
          error:
            "Server configuration error: Account turnover webhook not configured",
        },
        { status: 500 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parseResult = accountTurnoverSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { roleMailboxUpn, incomingUserUpn, ensureShared, dryRun } =
      parseResult.data;

    // Build webhook payload
    const webhookPayload = {
      RoleMailboxUPN: roleMailboxUpn,
      IncomingUserUPN: incomingUserUpn,
      EnsureShared: ensureShared,
      DryRun: dryRun,
    };

    // Call Azure Automation webhook
    const webhookResponse = await fetch(AZURE_ACCOUNT_TURNOVER_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(webhookPayload),
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error("Webhook call failed:", webhookResponse.status, errorText);

      // Create audit log for failed turnover
      await createAuditLog({
        actorId: scope.userId,
        action: "turnover",
        resourceType: "mailbox",
        payload: {
          roleMailboxUpn,
          incomingUserUpn,
          ensureShared,
          dryRun,
          success: false,
          error: errorText,
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: `Webhook call failed: ${webhookResponse.status}`,
          roleMailboxUpn,
          incomingUserUpn,
          dryRun,
        },
        { status: 502 }
      );
    }

    // Parse webhook response (if any)
    let responseData: Record<string, unknown> | null = null;
    try {
      responseData = await webhookResponse.json();
    } catch {
      // Webhook might not return JSON
      responseData = { status: "accepted" };
    }

    // Create audit log for successful turnover
    await createAuditLog({
      actorId: scope.userId,
      action: "turnover",
      resourceType: "mailbox",
      payload: {
        roleMailboxUpn,
        incomingUserUpn,
        ensureShared,
        dryRun,
        success: true,
        webhookResponse: responseData,
      },
    });

    if (!dryRun) {
      await invalidateAppwriteUser(roleMailboxUpn);
    }

    return NextResponse.json({
      success: true,
      roleMailboxUpn,
      incomingUserUpn,
      dryRun,
      webhookResponse: responseData,
    });
  } catch (error) {
    console.error("Error in account turnover:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process account turnover",
      },
      { status: 500 }
    );
  }
}
