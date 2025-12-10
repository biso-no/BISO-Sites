import { NextResponse } from 'next/server';
import { createAdminClient } from "@repo/api/server";
import { createGraphClient } from "@repo/connectors/azure";
import { ResponseType } from '@microsoft/microsoft-graph-client';

// --- Types ---
interface DepartmentMember {
  name: string;
  email: string;
  phone: string;
  role: string;
  officeLocation: string;
  profilePhotoUrl?: string;
}

const CAMPUS_MAPPINGS = [
  { id: "1", name: "Oslo", defaultDepartment: "Ledelsen Oslo", officeFilter: "Oslo", managementDepartmentId: "2" },
  { id: "2", name: "Bergen", defaultDepartment: "Ledelsen Bergen", officeFilter: "Bergen", managementDepartmentId: "301" },
  { id: "3", name: "Trondheim", defaultDepartment: "Ledelsen Trondheim", officeFilter: "Trondheim", managementDepartmentId: "601" },
  { id: "4", name: "Stavanger", defaultDepartment: "Ledelsen Stavanger", officeFilter: "Stavanger", managementDepartmentId: "801" },
  { id: "5", name: "National", defaultDepartment: "Operations Unit", officeFilter: "National", managementDepartmentId: "1002" }
];

// --- Helper: Get Campus Info ---
function getCampusInfo(campusId: string) {
  return CAMPUS_MAPPINGS.find(c => 
    c.id === campusId || c.name.toLowerCase() === campusId.toLowerCase()
  ) || { id: campusId, name: "Unknown", defaultDepartment: "Campus Management", officeFilter: "Unknown" };
}

// --- Main Route Handler ---
export async function GET(
  request: Request,
  { params }: { params: Promise<{ campusId: string; departmentId?: string }> }
) {
  try {
    const { campusId, departmentId } = await params;
    const campusInfo = getCampusInfo(campusId);

    // 1. Determine Department Name and Trim Whitespace
    let departmentName = campusInfo.defaultDepartment;

    if (departmentId && departmentId !== 'undefined') {
      const { db } = await createAdminClient();
      try {
        const department = await db.getRow('app', 'departments', departmentId);
        departmentName = department.Name || departmentId; 
      } catch (error) {
        return NextResponse.json({ success: false, message: `Department ${departmentId} not found` }, { status: 404 });
      }
    }
    
    // FIX: Remove any leading/trailing whitespace before creating the filter string
    departmentName = departmentName.trim();

    // Override for Operations Unit (synced name differs from Azure)
    if (departmentName === 'Operations Unit / Administration') {
      departmentName = 'Operations Unit';
    }

    // 2. Initialize Graph Client
    const graphClient = createGraphClient(
      process.env.AZURE_TENANT_ID!,
      process.env.AZURE_APP_ID!,
      process.env.AZURE_CLIENT_SECRET!
    );

    // 3. Fetch Users using Advanced Query Capabilities (Server-side filtering)
    // Using 'startswith' is more robust for department matching.
const combinedFilterValue = 
  `officeLocation eq '${campusInfo.officeFilter}' and startswith(department, '${departmentName}') and accountEnabled eq true`;
    
    console.log('[DEBUG] Campus Office Filter:', campusInfo.officeFilter);
    console.log('[DEBUG] Target Department Name (TRIMMED):', departmentName);
    console.log('[DEBUG] Combined Filter Value (CLEAN):', combinedFilterValue); 
    
    const response = await graphClient
      .api('/users')
      .header('ConsistencyLevel', 'eventual') // Required for filtering on officeLocation
      .query({
          '$filter': combinedFilterValue, // Combined filter on officeLocation AND department
          '$count': 'true'                // Required when using ConsistencyLevel: eventual
      })
      .select('displayName,mail,businessPhones,mobilePhone,jobTitle,officeLocation,department')
      .top(999)
      .get();
    
    // 4. Map Users (Filtering is done by Graph)
    const matchedUsers = response.value || [];
    console.log('[DEBUG] Users returned from Graph:', matchedUsers.length);
    console.log('[DEBUG] @odata.count:', response['@odata.count']);

    const members: DepartmentMember[] = matchedUsers.map((user: any) => ({
      name: user.displayName || '',
      email: user.mail || '',
      phone: user.businessPhones?.[0] || user.mobilePhone || '',
      role: user.jobTitle || '',
      officeLocation: user.officeLocation || campusInfo.officeFilter 
    }));

    // Sort: Managers/Presidents first
    members.sort((a, b) => {
      const isManagerA = /manager|president/i.test(a.role) || /manager|president/i.test(a.email);
      const isManagerB = /manager|president/i.test(b.role) || /manager|president/i.test(b.email);
      return (isManagerA === isManagerB) ? 0 : isManagerA ? -1 : 1;
    });

    // 5. Fetch Photos (Parallelized)
    await Promise.all(members.map(async (member) => {
      if (!member.email) return;
      try {
        const photoStream = await graphClient
          .api(`/users/${member.email}/photo/$value`)
          .responseType(ResponseType.ARRAYBUFFER)
          .get();
        
        const base64 = Buffer.from(photoStream).toString('base64');
        member.profilePhotoUrl = `data:image/jpeg;base64,${base64}`;
      } catch (e) {
        // No photo found, skip silently
      }
    }));

    return NextResponse.json({
      success: true,
      members,
      count: members.length,
      departmentName,
      campus: campusInfo.name
    });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}