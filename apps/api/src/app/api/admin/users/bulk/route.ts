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
interface BulkCreateResult {
  error?: string;
  groupsAssigned?: string[];
  index: number;
  input: BulkCreateInput;
  success: boolean;
  temporaryPassword?: string;
  user?: { id: string; displayName: string; upn: string };
}

interface CreateUserContext {
  adminDb: Awaited<ReturnType<typeof createAdminClient>>["db"];
  campusMap: Map<string, Campus>;
  deptMap: Map<string, Departments>;
  graphService: GraphUserService;
  scope: NonNullable<Awaited<ReturnType<typeof getAdminScope>>>;
}

async function assignUserGroups(
  graphService: GraphUserService,
  userId: string,
  campusName: string,
  departmentId: string,
  additionalGroupIds: string[]
): Promise<string[]> {
  const requiredGroups = getRequiredSecurityGroups(campusName, departmentId);

  for (const groupName of requiredGroups) {
    try {
      const group = await graphService.findGroupByName(groupName);
      if (group) {
        await graphService.addUserToGroup(userId, group.id);
      }
    } catch {
      console.warn(`Failed to add user to group ${groupName}`);
    }
  }

  if (additionalGroupIds.length > 0) {
    await graphService.addUserToGroups(userId, additionalGroupIds);
  }

  return requiredGroups;
}

async function createSingleUser(
  index: number,
  input: BulkCreateInput,
  ctx: CreateUserContext
): Promise<BulkCreateResult> {
  const result: BulkCreateResult = { index, success: false, input };

  const campus = ctx.campusMap.get(input.campusId);
  if (!campus) {
    result.error = `Campus not found: ${input.campusId}`;
    return result;
  }

  if (!canManageCampus(ctx.scope, campus.name)) {
    result.error = `Forbidden: Cannot create users in campus ${campus.name}`;
    return result;
  }

  const department = ctx.deptMap.get(input.departmentId);
  if (!department) {
    result.error = `Department not found: ${input.departmentId}`;
    return result;
  }

  const upn = generateUpn(input.firstName, input.lastName, M365_DOMAIN);
  const password = generateTemporaryPassword();
  const displayName = `${input.firstName} ${input.lastName}`;

  const graphUser = await ctx.graphService.createUser({
    displayName,
    userPrincipalName: upn,
    mailNickname: upn.split("@")[0],
    password,
    department: department.Name,
    officeLocation: campus.name,
    forceChangePasswordNextSignIn: true,
  });

  if (input.managerId) {
    try {
      await ctx.graphService.setManager(graphUser.id, input.managerId);
    } catch {
      console.warn(`Failed to set manager for ${upn}`);
    }
  }

  const requiredGroups = await assignUserGroups(
    ctx.graphService,
    graphUser.id,
    campus.name,
    department.Id,
    input.additionalGroupIds
  );

  await ctx.adminDb.createRow("app", "user", graphUser.id, {
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
  return result;
}

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

    const campusResponse = await db.listRows<Campus>("app", "campus");
    const campusMap = new Map(campusResponse.rows.map((c) => [c.$id, c]));

    const deptResponse = await db.listRows<Departments>("app", "departments", [
      Query.limit(1000),
    ]);
    const deptMap = new Map(deptResponse.rows.map((d) => [d.$id, d]));

    const graphService = new GraphUserService(
      AZURE_GRAPH_TENANT_ID,
      AZURE_GRAPH_CLIENT_ID,
      AZURE_GRAPH_CLIENT_SECRET
    );

    const ctx: CreateUserContext = {
      adminDb,
      campusMap,
      deptMap,
      graphService,
      scope,
    };
    const results: BulkCreateResult[] = [];

    for (let i = 0; i < usersToCreate.length; i++) {
      try {
        const result = await createSingleUser(i, usersToCreate[i], ctx);
        results.push(result);
      } catch (error) {
        results.push({
          index: i,
          success: false,
          input: usersToCreate[i],
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

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
  } catch (error) {
    console.error("Error in bulk user creation:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process bulk creation",
      },
      { status: 500 }
    );
  }
}
