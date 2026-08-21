import { ResponseType } from "@microsoft/microsoft-graph-client";
import { createAdminClient } from "@repo/api/server";
import { createGraphClient } from "@repo/connectors/azure";
import { type NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth";

export const maxDuration = 300; // 5 minutes for fetching/buffering images

// Top-level regex for manager/president role detection
const MANAGER_ROLE_REGEX = /manager|president/i;

// Numeric department ids resolve to a `departments` DB row; anything else is
// treated as a literal Azure AD `department` name (e.g. "Control Committee").
const NUMERIC_ID_REGEX = /^\d+$/;

// Escape a value for use inside an OData single-quoted string literal by
// doubling embedded single quotes. Prevents a crafted (non-numeric) route
// segment from breaking out of the quoted literal in the Graph `$filter`.
const escapeODataLiteral = (v: string) => v.replace(/'/g, "''");

// --- Types ---
interface DepartmentMember {
  email: string;
  name: string;
  officeLocation: string;
  phone: string;
  profilePhotoUrl?: string;
  role: string;
}

/**
 * What an unauthenticated visitor receives. The campus page and the mobile
 * campus screen render name, role, and photo only — `email`/`phone` are fetched
 * from Graph because they are needed server-side (email keys the photo lookup
 * and the manager-first sort) but they are not part of the public payload.
 */
type PublicDepartmentMember = Omit<DepartmentMember, "email" | "phone">;

function toPublicMember(member: DepartmentMember): PublicDepartmentMember {
  const { email: _email, phone: _phone, ...rest } = member;
  return rest;
}

/**
 * This directory is intentionally public — campus leadership is shown to
 * signed-out visitors on the web and in the app. Contact details are not:
 * returning staff email and phone to anonymous callers turns the endpoint into
 * a scrapeable address book for every volunteer in the organisation. Signed-in
 * callers still get the full record, so member-facing contact UIs keep working.
 *
 * An anonymous Appwrite session does not count — the web app provisions those
 * for every visitor, so treating them as authenticated would defeat the check.
 * A real account always carries an email.
 */
async function callerIsAuthenticated(request: NextRequest): Promise<boolean> {
  try {
    const { account } = await createAuthenticatedClient(request);
    const user = await account.get();
    return Boolean(user.email && user.email.length > 0);
  } catch {
    return false;
  }
}

const CAMPUS_MAPPINGS = [
  {
    id: "1",
    name: "Oslo",
    defaultDepartment: "Ledelsen Oslo",
    officeFilter: "Oslo",
    managementDepartmentId: "2",
  },
  {
    id: "2",
    name: "Bergen",
    defaultDepartment: "Ledelsen Bergen",
    officeFilter: "Bergen",
    managementDepartmentId: "301",
  },
  {
    id: "3",
    name: "Trondheim",
    defaultDepartment: "Ledelsen Trondheim",
    officeFilter: "Trondheim",
    managementDepartmentId: "601",
  },
  {
    id: "4",
    name: "Stavanger",
    defaultDepartment: "Ledelsen Stavanger",
    officeFilter: "Stavanger",
    managementDepartmentId: "801",
  },
  {
    id: "5",
    name: "National",
    defaultDepartment: "Operations Unit",
    officeFilter: "National",
    managementDepartmentId: "1002",
  },
];

// --- Helper: Get Campus Info ---
function getCampusInfo(campusId: string) {
  return (
    CAMPUS_MAPPINGS.find(
      (c) =>
        c.id === campusId || c.name.toLowerCase() === campusId.toLowerCase()
    ) || {
      id: campusId,
      name: "Unknown",
      defaultDepartment: "Campus Management",
      officeFilter: "Unknown",
    }
  );
}

// --- Main Route Handler ---
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campusId: string; departmentId?: string }> }
) {
  try {
    const { campusId, departmentId } = await params;
    const campusInfo = getCampusInfo(campusId);

    // 1. Determine Department Name and Trim Whitespace
    let departmentName = campusInfo.defaultDepartment;

    if (departmentId && departmentId !== "undefined") {
      if (NUMERIC_ID_REGEX.test(departmentId)) {
        const { db } = await createAdminClient();
        try {
          const department = await db.getRow(
            "app",
            "departments",
            departmentId
          );
          departmentName = department.Name || departmentId;
        } catch (_error) {
          return NextResponse.json(
            { success: false, message: `Department ${departmentId} not found` },
            { status: 404 }
          );
        }
      } else {
        // Non-numeric segment: use it directly as the Azure department name.
        // Next.js has already URL-decoded the route param.
        departmentName = departmentId;
      }
    }

    // FIX: Remove any leading/trailing whitespace before creating the filter string
    departmentName = departmentName.trim();

    // Override for Operations Unit (synced name differs from Azure)
    if (departmentName === "Operations Unit / Administration") {
      departmentName = "Operations Unit";
    }

    const azureTenantId = process.env.AZURE_TENANT_ID;
    const azureAppId = process.env.AZURE_APP_ID;
    const azureClientSecret = process.env.AZURE_CLIENT_SECRET;

    if (!(azureTenantId && azureAppId && azureClientSecret)) {
      throw new Error("Missing Azure credentials in environment variables");
    }

    // 2. Initialize Graph Client
    const graphClient = createGraphClient(
      azureTenantId,
      azureAppId,
      azureClientSecret
    );

    // 3. Fetch Users using Advanced Query Capabilities (Server-side filtering)
    // Using 'startswith' is more robust for department matching.
    const combinedFilterValue = `officeLocation eq '${escapeODataLiteral(campusInfo.officeFilter)}' and startswith(department, '${escapeODataLiteral(departmentName)}') and accountEnabled eq true`;

    const response = await graphClient
      .api("/users")
      .header("ConsistencyLevel", "eventual") // Required for filtering on officeLocation
      .query({
        $filter: combinedFilterValue, // Combined filter on officeLocation AND department
        $count: "true", // Required when using ConsistencyLevel: eventual
      })
      .select(
        "displayName,mail,businessPhones,mobilePhone,jobTitle,officeLocation,department"
      )
      .top(999)
      .get();

    // 4. Map Users (Filtering is done by Graph)
    const matchedUsers = response.value || [];
    const members: DepartmentMember[] = matchedUsers.map(
      (user: Record<string, unknown>) => {
        const businessPhones = Array.isArray(user.businessPhones)
          ? user.businessPhones
          : [];
        const phone =
          typeof businessPhones[0] === "string" ? businessPhones[0] : "";
        const fallbackPhone =
          phone ||
          (typeof user.mobilePhone === "string" ? user.mobilePhone : "");
        return {
          name: typeof user.displayName === "string" ? user.displayName : "",
          email: typeof user.mail === "string" ? user.mail : "",
          phone: fallbackPhone,
          role: typeof user.jobTitle === "string" ? user.jobTitle : "",
          officeLocation:
            typeof user.officeLocation === "string"
              ? user.officeLocation
              : campusInfo.officeFilter,
        };
      }
    );

    // Sort: Managers/Presidents first
    members.sort((a, b) => {
      const isManagerA =
        MANAGER_ROLE_REGEX.test(a.role) || MANAGER_ROLE_REGEX.test(a.email);
      const isManagerB =
        MANAGER_ROLE_REGEX.test(b.role) || MANAGER_ROLE_REGEX.test(b.email);
      const aFirst = isManagerA && !isManagerB;
      const bFirst = isManagerB && !isManagerA;
      if (aFirst) {
        return -1;
      }
      if (bFirst) {
        return 1;
      }
      return 0;
    });

    // 5. Fetch Photos (Parallelized)
    await Promise.all(
      members.map(async (member) => {
        if (!member.email) {
          return;
        }
        try {
          const photoStream = await graphClient
            .api(`/users/${member.email}/photo/$value`)
            .responseType(ResponseType.ARRAYBUFFER)
            .get();

          const base64 = Buffer.from(photoStream).toString("base64");
          member.profilePhotoUrl = `data:image/jpeg;base64,${base64}`;
        } catch (_e) {
          // No photo found, skip silently
        }
      })
    );

    const includeContactDetails = await callerIsAuthenticated(request);

    return NextResponse.json({
      success: true,
      members: includeContactDetails ? members : members.map(toPublicMember),
      count: members.length,
      departmentName,
      campus: campusInfo.name,
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
