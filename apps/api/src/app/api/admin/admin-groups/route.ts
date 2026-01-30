import { GraphUserService } from "@repo/connectors/azure/users";
import { type NextRequest, NextResponse } from "next/server";
import { getAdminScope } from "@/lib/admin-auth";

// Get Graph credentials from environment
const AZURE_GRAPH_TENANT_ID =
  process.env.AZURE_GRAPH_TENANT_ID || process.env.AZURE_TENANT_ID || "";
const AZURE_GRAPH_CLIENT_ID =
  process.env.AZURE_GRAPH_CLIENT_ID || process.env.AZURE_APP_ID || "";
const AZURE_GRAPH_CLIENT_SECRET =
  process.env.AZURE_GRAPH_CLIENT_SECRET ||
  process.env.SHAREPOINT_CLIENT_SECRET ||
  "";

/**
 * GET /api/admin/admin-groups
 * List M365 security groups that the current admin is a member of.
 * These groups can be assigned to new users (least privilege approach).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
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
      console.error("Missing Azure Graph credentials");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const graphService = new GraphUserService(
      AZURE_GRAPH_TENANT_ID,
      AZURE_GRAPH_CLIENT_ID,
      AZURE_GRAPH_CLIENT_SECRET
    );

    // Get groups the admin user is a member of
    const groups = await graphService.getUserGroups(scope.userId);

    // Filter to security groups and exclude system groups
    const assignableGroups = groups
      .filter((group) => group.securityEnabled)
      .filter((group) => !group.displayName.startsWith("SG-App-Campus-"))
      .filter((group) => !group.displayName.startsWith("SG-App-Dept-"))
      .map((group) => ({
        id: group.id,
        displayName: group.displayName,
        description: group.description,
      }));

    return NextResponse.json({ groups: assignableGroups });
  } catch (error) {
    console.error("Error fetching admin groups:", error);
    return NextResponse.json(
      { error: "Failed to fetch groups" },
      { status: 500 }
    );
  }
}
