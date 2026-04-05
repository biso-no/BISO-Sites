import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog, getAdminScope } from "@/lib/admin-auth";

// Get webhook URL from environment
const AZURE_ACCOUNT_TURNOVER_WEBHOOK_URL =
  process.env.AZURE_ACCOUNT_TURNOVER_WEBHOOK_URL || "";

// Zod schema for bulk account turnover
const turnoverOperationSchema = z.object({
  roleMailboxUpn: z.string().email("Valid role mailbox UPN required"),
  incomingUserUpn: z.string().email("Valid incoming user UPN required"),
  ensureShared: z.boolean().default(true),
  dryRun: z.boolean().default(false),
});

const bulkTurnoverSchema = z.object({
  operations: z.array(turnoverOperationSchema).min(1).max(50),
  dryRunAll: z.boolean().default(false),
});

interface TurnoverResult {
  dryRun: boolean;
  error?: string;
  incomingUserUpn: string;
  index: number;
  roleMailboxUpn: string;
  success: boolean;
  webhookResponse?: unknown;
}

/**
 * POST /api/admin/account-turnover/bulk
 * Bulk initiate account turnovers by calling the Azure Automation webhook for each.
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
    const parseResult = bulkTurnoverSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { operations, dryRunAll } = parseResult.data;
    const results: TurnoverResult[] = [];

    // Process each operation sequentially
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      const dryRun = dryRunAll || op.dryRun;
      const result: TurnoverResult = {
        index: i,
        success: false,
        roleMailboxUpn: op.roleMailboxUpn,
        incomingUserUpn: op.incomingUserUpn,
        dryRun,
      };

      try {
        // Build webhook payload
        const webhookPayload = {
          RoleMailboxUPN: op.roleMailboxUpn,
          IncomingUserUPN: op.incomingUserUpn,
          EnsureShared: op.ensureShared,
          DryRun: dryRun,
        };

        // Call Azure Automation webhook
        const webhookResponse = await fetch(
          AZURE_ACCOUNT_TURNOVER_WEBHOOK_URL,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(webhookPayload),
          }
        );

        if (webhookResponse.ok) {
          result.success = true;
          try {
            result.webhookResponse = await webhookResponse.json();
          } catch {
            result.webhookResponse = { status: "accepted" };
          }
        } else {
          const errorText = await webhookResponse.text();
          result.error = `Webhook failed: ${webhookResponse.status} - ${errorText}`;
        }
      } catch (error) {
        result.error = error instanceof Error ? error.message : "Unknown error";
      }

      results.push(result);
    }

    // Create audit log for bulk operation
    await createAuditLog({
      actorId: scope.userId,
      action: "bulk-turnover",
      resourceType: "mailbox",
      payload: {
        totalRequested: operations.length,
        totalSucceeded: results.filter((r) => r.success).length,
        totalFailed: results.filter((r) => !r.success).length,
        dryRunAll,
      },
    });

    return NextResponse.json({
      totalRequested: operations.length,
      totalSucceeded: results.filter((r) => r.success).length,
      totalFailed: results.filter((r) => !r.success).length,
      results,
    });
  } catch (error) {
    console.error("Error in bulk account turnover:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process bulk turnover",
      },
      { status: 500 }
    );
  }
}
