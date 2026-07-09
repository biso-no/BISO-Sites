import { Query } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { Campus, Departments, Users } from "@repo/api/types/appwrite";
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
  extractJwtFromRequest,
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

// Zod schema for user creation
const createUserSchema = z.object({
  firstName: z.string().min(1).max(64),
  lastName: z.string().min(1).max(64),
  campusId: z.string().min(1),
  departmentId: z.string().min(1),
  managerId: z.string().optional(),
  additionalGroupIds: z.array(z.string()).default([]),
});

/**
 * GET /api/admin/users
 * List users with authorization scoping.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const scope = await getAdminScope(request);
    if (!scope) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const jwt = extractJwtFromRequest(request);
    const { db } = await createSessionClient(jwt);
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(
      Number.parseInt(searchParams.get("limit") || "50", 10),
      100
    );
    const offset = Number.parseInt(searchParams.get("offset") || "0", 10);

    const queries = [Query.limit(limit), Query.offset(offset)];

    // Add campus filter if specified
    const campusId = searchParams.get("campusId");
    if (campusId) {
      queries.push(Query.equal("campus_id", campusId));
    }

    const response = await db.listRows<Users>("app", "user", queries);
    let users = response.rows;

    // Filter by scope if not global admin
    if (!scope.canManageAnyCampus) {
      // Get campus names for the managed campus IDs
      const campusResponse = await db.listRows<Campus>("app", "campus");
      const campusMap = new Map(
        campusResponse.rows.map((c) => [c.$id, c.name])
      );

      users = users.filter((user) => {
        if (!user.campus_id) {
          return false;
        }
        const campusName = campusMap.get(user.campus_id);
        return campusName ? canManageCampus(scope, campusName) : false;
      });
    }

    const mapped = users.map((user) => ({
      id: user.$id,
      name: user.name,
      email: user.email,
      campusId: user.campus_id,
      departmentIds: user.department_ids,
      isActive: user.isActive,
      avatar: user.avatar,
      roles: user.roles,
    }));

    return NextResponse.json({
      users: mapped,
      total: response.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/users
 * Create a new user in M365 and sync to Appwrite.
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

    // Parse and validate request body
    const body = await request.json();
    const parseResult = createUserSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const input = parseResult.data;
    const jwt = extractJwtFromRequest(request);
    const { db } = await createSessionClient(jwt);
    const { db: adminDb } = await createAdminClient();

    // Get campus to check authorization and get name
    const campus = await db.getRow<Campus>("app", "campus", input.campusId);
    if (!canManageCampus(scope, campus.name)) {
      return NextResponse.json(
        { error: "Forbidden: You cannot create users in this campus" },
        { status: 403 }
      );
    }

    // Get department info
    const department = await db.getRow<Departments>(
      "app",
      "departments",
      input.departmentId
    );

    // Initialize Graph service
    const graphService = new GraphUserService(
      AZURE_GRAPH_TENANT_ID,
      AZURE_GRAPH_CLIENT_ID,
      AZURE_GRAPH_CLIENT_SECRET
    );

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
      } catch (error) {
        console.error("Failed to set manager:", error);
      }
    }

    // Get required security groups based on campus/department
    const requiredGroups = getRequiredSecurityGroups(
      campus.name,
      department.Id
    );
    const groupsToAssign = [...requiredGroups];

    // Find and add required security groups
    const groupPromises = requiredGroups.map(async (groupName) => {
      const group = await graphService.findGroupByName(groupName);
      if (group) {
        await graphService.addUserToGroup(graphUser.id, group.id);
      } else {
        console.warn(`Required group not found: ${groupName}`);
      }
    });
    await Promise.all(groupPromises);

    // Add optional groups
    if (input.additionalGroupIds.length > 0) {
      await graphService.addUserToGroups(
        graphUser.id,
        input.additionalGroupIds
      );
    }

    // Create user document in Appwrite
    const _appwriteUser = await adminDb.createRow("app", "user", graphUser.id, {
      name: displayName,
      email: upn,
      campus_id: input.campusId,
      department_ids: [input.departmentId],
      isActive: true,
    });

    // Create audit log
    await createAuditLog({
      actorId: scope.userId,
      action: "create-user",
      resourceId: graphUser.id,
      resourceType: "user",
      payload: {
        firstName: input.firstName,
        lastName: input.lastName,
        upn,
        campusId: input.campusId,
        departmentId: input.departmentId,
        managerId: input.managerId,
        additionalGroupIds: input.additionalGroupIds,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: graphUser.id,
        displayName,
        upn,
        campusId: input.campusId,
        departmentId: input.departmentId,
      },
      temporaryPassword: password,
      groupsAssigned: groupsToAssign,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create user",
      },
      { status: 500 }
    );
  }
}
