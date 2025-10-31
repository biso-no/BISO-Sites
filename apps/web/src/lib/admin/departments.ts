"use server"
import { Query } from "@repo/api/server";
import { createSessionClient, createAdminClient } from "../appwrite";
import { Models } from "@repo/api/client"

export type Department = {
  $id: string
  $createdAt: string
  name: string
  campus_id: string
  campusName?: string
  logo: string
  type: string
  description: string
  active: boolean
  userCount?: number
}

export async function convertDocumentToDepartment(doc: Models.Document, includeCampusName: boolean = false): Promise<Department> {
  let campusName = '';
  
  if (includeCampusName && doc.campus_id) {
    try {
      const { db } = await createSessionClient();
      const campus = await db.getDocument("app", "campus", doc.campus_id);
      campusName = campus.name;
    } catch (error) {
      console.error("Error fetching campus name:", error);
    }
  }

  return {
    $id: doc.$id,
    $createdAt: doc.$createdAt,
    name: doc.Name,
    campus_id: doc.campus_id,
    campusName: campusName,
    logo: doc.logo || '',
    type: doc.type || '',
    description: doc.description || '',
    active: doc.active === false ? false : true,
    userCount: doc.users?.length || 0
  }
}

export async function getDepartments(filters?: {
  active?: boolean;
  campus_id?: string;
  type?: string;
  searchTerm?: string;
  limit?: number;
  offset?: number;
}) {
  const { db } = await createSessionClient();
  
  const queries = [
    Query.limit(filters?.limit || 300),
    Query.offset(filters?.offset || 0),
    Query.equal("active", true),
    Query.select(["$id", "Name", "campus_id", "logo", "type", "description", "active"])
  ];
  
  if (filters?.active !== undefined) {
    if (filters.active) {
      queries.push(Query.or([
        Query.equal("active", true),
        Query.isNull("active")
      ]));
    } else {
      queries.push(Query.equal("active", false));
    }
  }
  
  if (filters?.campus_id) {
    queries.push(Query.equal("campus_id", filters.campus_id));
  }
  
  if (filters?.type) {
    queries.push(Query.equal("type", filters.type));
  }
  
  if (filters?.searchTerm) {
    queries.push(Query.search("Name", filters.searchTerm));
  }

  const departments = await db.listRows("app", "departments", queries);
  
  // Process the results to include campus names
  const departmentsWithDetails = await Promise.all(
    departments.rows.map(doc => convertDocumentToDepartment(doc, true))
  );
  
  return departmentsWithDetails;
}

export async function getDepartmentTypes() {
  const { db } = await createSessionClient();
  const departments = await db.listRows("app", "departments", [
    Query.limit(300),
    Query.select(["type"]),
  ]);
  
  // Extract unique types
  const uniqueTypes = new Set<string>();
  departments.rows.forEach((dept) => {
    if (dept.type) uniqueTypes.add(dept.type);
  });
  
  return Array.from(uniqueTypes);
}

export async function updateDepartment(departmentId: string, data: Partial<Department>) {
  const { db } = await createSessionClient();
  return db.updateDocument(
    'app',
    'departments',
    departmentId,
    {
      Name: data.name,
      campus_id: data.campus_id,
      logo: data.logo,
      type: data.type,
      description: data.description,
      active: data.active
    }
  );
}

export async function createDepartment(data: Omit<Department, 'id'>) {
  const { db } = await createSessionClient();
  return db.createDocument(
    'app',
    'departments',
    'unique()',
    {
      Name: data.name,
      campus_id: data.campus_id,
      logo: data.logo || '',
      type: data.type || '',
      description: data.description || '',
      active: data.active !== undefined ? data.active : true
    }
  );
} 