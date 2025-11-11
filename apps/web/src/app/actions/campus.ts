"use server"

import { createAdminClient, createSessionClient } from "@repo/api/server"
import { Campus } from "@repo/api/types/appwrite"
import { CampusData } from "@/lib/types/campus-data"
import { Query, Models } from "@repo/api"

export type CampusMetadata = Models.Document & {
  campus_id: string
  campus_name: string
  tagline_nb?: string
  tagline_en?: string
  description_nb?: string
  description_en?: string
  highlights_nb?: string[]
  highlights_en?: string[]
  focusAreas_nb?: string[]
  focusAreas_en?: string[]
  services_nb?: string
  services_en?: string
}

export async function getCampusMetadata(): Promise<Record<string, CampusMetadata>> {
  try {
    const { db } = await createAdminClient()
    
    const result = await db.listRows('app', 'campus_metadata')
    
    const metadata: Record<string, CampusMetadata> = {}
    
    for (const doc of result.rows) {
      const campusMetadata = doc as unknown as CampusMetadata
      // Index by both campus_id and campus_name for easy lookup
      metadata[campusMetadata.campus_id] = campusMetadata
      metadata[campusMetadata.campus_name] = campusMetadata
    }
    
    return metadata
  } catch (error) {
    console.error('Failed to fetch campus metadata:', error)
    return {}
  }
}

export async function getCampusMetadataById(campusId: string): Promise<CampusMetadata | null> {
  try {
    const { db } = await createAdminClient()
    
    const result = await db.listRows('app', 'campus_metadata', [
      Query.equal('campus_id', campusId)
    ])
    
    if (result.rows.length > 0) {
      return result.rows[0] as unknown as CampusMetadata
    }
    
    return null
  } catch (error) {
    console.error('Failed to fetch campus metadata by ID:', error)
    return null
  }
}

export async function getCampusMetadataByName(campusName: string): Promise<CampusMetadata | null> {
  try {
    const { db } = await createAdminClient()
    
    const result = await db.listRows('app', 'campus_metadata', [
      Query.equal('campus_name', campusName.toLowerCase())
    ])
    
    if (result.rows.length > 0) {
      return result.rows[0] as unknown as CampusMetadata
    }
    
    return null
  } catch (error) {
    console.error('Failed to fetch campus metadata by name:', error)
    return null
  }
}

export async function getCampuses({ 
  includeNational = true, 
  selectedCampusId = "all",
  includeDepartments = false 
}: { 
  includeNational?: boolean; 
  selectedCampusId?: string;
  includeDepartments?: boolean;
} = {}) {
  const { db } = await createSessionClient();

  const query: string[] = [];
  
  // Filter by National if specified
  if (!includeNational) {
    query.push(Query.notEqual('name', 'National'));
  }

  if (selectedCampusId && selectedCampusId !== "all") {
    query.push(Query.equal('$id', selectedCampusId));
  }

  if (includeDepartments) {
    query.push(Query.select(['departments.$id', 'departments.Name', 'departments.active']));
  }

  const campuses = await db.listRows(
    'app',
    'campus',
    query
  );

  return campuses.rows as unknown as Campus[];
}

/**
 * Get a single campus with its departments
 */
export async function getCampusWithDepartments(campusId: string) {
  try {
    const { db } = await createSessionClient();

    const campus = await db.getRow<Campus>(
      'app',
      'campus',
      campusId,
      [
        Query.select([
          '$id',
          'name',
          'departments.$id',
          'departments.Name',
          'departments.active',
        ])
      ]
    );

    return {
      success: true,
      campus,
    };
  } catch (error) {
    console.error("Error fetching campus with departments:", error);
    return {
      success: false,
      campus: null,
      error: error instanceof Error ? error.message : "Failed to fetch campus",
    };
  }
}

export async function getCampusData() {
  const { db } = await createSessionClient();
  const campuses = await db.listRows(
    'app',
    'campus_data'
  );

  return campuses.rows as unknown as CampusData[];
}
