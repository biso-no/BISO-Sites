import { Query } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { Campus, Departments } from "@repo/api/types/appwrite";
import {
  GraphUserService,
  generateTemporaryPassword,
  generateUpn,
  getRequiredSecurityGroups,
} from "@repo/connectors/azure/users";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  canManageCampus,
  createAuditLog,
  getAdminScope,
} from "@/lib/admin-auth";

// Graph credentials
const AZURE_GRAPH_TENANT_ID =
  process.env.AZURE_GRAPH_TENANT_ID || process.env.AZURE_TENANT_ID || "";
const AZURE_GRAPH_CLIENT_ID =
  process.env.AZURE_GRAPH_CLIENT_ID || process.env.AZURE_APP_ID || "";
const AZURE_GRAPH_CLIENT_SECRET =
  process.env.AZURE_GRAPH_CLIENT_SECRET ||
  process.env.SHAREPOINT_CLIENT_SECRET ||
  "";
const M365_DOMAIN = process.env.M365_DOMAIN || "biso.no";

// Zod schema for bulk user creation
const bulkCreateUserRowSchema = z.object({
  firstName: z.string().min(1).max(64),
  lastName: z.string().min(1).max(64),
  campusId: z.string().min(1),
  departmentId: z.string().min(1),
  managerId: z.string().optional(),
  additionalGroupIds: z.array(z.string()).default([]),
});

const bulkCreateUsersSchema = z.object({
  users: z.array(bulkCreateUserRowSchema).min(1).max(100),
});

type BulkCreateInput = z.infer<typeof bulkCreateUserRowSchema>;
type BulkCreateResult = {
  index: number;
  success: boolean;
  input: BulkCreateInput;
  user?: { id: string; displayName: string; upn: string };
  temporaryPassword?: string;
  groupsAssigned?: string[];
  error?: string;
};

/**
 * POST /api/admin/users/bulk
 * Bulk create users in M365 and sync to Appwrite.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const scope = await getAdminScope(request);
    if (!scope) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate Graph credentials
    if (
      !(
        AZURE_GRAPH_TENANT_ID &&
        AZURE_GRAPH_CLIENT_ID &&
        AZURE_GRAPH_CLIENT_SECRET
      )
    ) {
      return NextResponse.json(
        { error: "Server configuration error: Missing Graph credentials" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const parseResult = bulkCreateUsersSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { users: usersToCreate } = parseResult.data;
    const { db } = await createSessionClient();
    const { db: adminDb } = await createAdminClient();

    // Pre-fetch campuses and departments for validation
    const campusResponse = await db.listRows<Campus>("app", "campus");
    const campusMap = new Map(campusResponse.rows.map((c) => [c.$id, c]));

    const deptResponse = await db.listRows<Departments>("app", "departments", [
      Query.limit(1000),
    ]);
    const deptMap = new Map(deptResponse.rows.map((d) => [d.$id, d]));

    // Initialize Graph service
    const graphService = new GraphUserService(
      AZURE_GRAPH_TENANT_ID,
      AZURE_GRAPH_CLIENT_ID,
      AZURE_GRAPH_CLIENT_SECRET
    );

    const results: BulkCreateResult[] = [];

    // Process each user sequentially to avoid rate limiting
    for (let i = 0; i < usersToCreate.length; i++) {
      const input = usersToCreate[i];
      const result: BulkCreateResult = { index: i, success: false, input };

      try {
        // Validate campus
        const campus = campusMap.get(input.campusId);
        if (!campus) {
          result.error = `Campus not found: ${input.campusId}`;
          results.push(result);
          continue;
        }

        // Check authorization
        if (!canManageCampus(scope, campus.name)) {
          result.error = `Forbidden: Cannot create users in campus ${campus.name}`;
          results.push(result);
          continue;
        }

        // Validate department
        const department = deptMap.get(input.departmentId);
        if (!department) {
          result.error = `Department not found: ${input.departmentId}`;
          results.push(result);
          continue;
        }

        // Generate UPN and password
        const upn = generateUpn(input.firstName, input.lastName, M365_DOMAIN);
        const password = generateTemporaryPassword();
        const displayName = `${input.firstName} ${input.lastName}`;

        // Create user in M365
        const graphUser = await graphService.createUser({
          displayName,
          userPrincipalName: upn,
          mailNickname: upn.split("@")[0],
          password,
          department: department.Name,
          officeLocation: campus.name,
          forceChangePasswordNextSignIn: true,
        });

        // Set manager if provided
        if (input.managerId) {
          try {
            await graphService.setManager(graphUser.id, input.managerId);
          } catch {
            console.warn(`Failed to set manager for ${upn}`);
          }
        }

        // Get required security groups
        const requiredGroups = getRequiredSecurityGroups(
          campus.name,
          department.Id
        );

        // Add to required security groups
        for (const groupName of requiredGroups) {
          try {
            const group = await graphService.findGroupByName(groupName);
            if (group) {
              await graphService.addUserToGroup(graphUser.id, group.id);
            }
          } catch {
            console.warn(`Failed to add user to group ${groupName}`);
          }
        }

        // Add optional groups
        if (input.additionalGroupIds.length > 0) {
          await graphService.addUserToGroups(
            graphUser.id,
            input.additionalGroupIds
          );
        }

        // Create user document in Appwrite
        await adminDb.createRow("app", "user", graphUser.id, {
          name: displayName,
          email: upn,
          campus_id: input.campusId,
          department_ids: [input.departmentId],
          isActive: true,
        });

        result.success = true;
        result.user = { id: graphUser.id, displayName, upn };
        result.temporaryPassword = password;
        result.groupsAssigned = requiredGroups;
      } catch (error: any) {
        result.error = error.message || "Unknown error";
      }

      results.push(result);
    }

    // Create audit log for bulk operation
    await createAuditLog({
      actorId: scope.userId,
      action: "bulk-create",
      resourceType: "user",
      payload: {
        totalRequested: usersToCreate.length,
        totalSucceeded: results.filter((r) => r.success).length,
        totalFailed: results.filter((r) => !r.success).length,
      },
    });

    return NextResponse.json({
      totalRequested: usersToCreate.length,
      totalSucceeded: results.filter((r) => r.success).length,
      totalFailed: results.filter((r) => !r.success).length,
      results,
    });
  } catch (error: any) {
    console.error("Error in bulk user creation:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process bulk creation" },
      { status: 500 }
    );
  }
}
