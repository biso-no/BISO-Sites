"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import { Departments } from "@repo/api/types/appwrite";

interface GetDepartmentsParams {
  campusId?: string;
  active?: boolean;
  type?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function getDepartments(params: GetDepartmentsParams = {}) {
  const { db } = await createSessionClient();
  const { campusId, active, type, search, limit, offset } = params;
  
  const queries: string[] = [];
  
  // Always select department fields + campus relationship
  queries.push(Query.select([
    '$id',
    'Name',
    'active',
    'type',
    'logo',
    'description',
    'campus_id',
    'campus.$id',
    'campus.name'
  ]));
  
  // Filtering
  if (active !== undefined) {
    queries.push(Query.equal("active", active));
  }
  
  if (campusId && campusId !== "all") {
    queries.push(Query.equal("campus_id", campusId));
  }
  
  if (type && type !== "all") {
    queries.push(Query.equal("type", type));
  }
  
  if (search) {
    queries.push(Query.search("Name", search));
  }
  
  // Pagination
  if (limit) {
    queries.push(Query.limit(limit));
  }
  
  if (offset) {
    queries.push(Query.offset(offset));
  }
  
  const departments = await db.listRows<Departments>("app", "departments", queries);
  return departments.rows;
}

export async function getDepartmentTypes(): Promise<string[]> {
  const { db } = await createSessionClient();
  
  const departments = await db.listRows<Departments>('app', 'departments', [
    Query.select(['type']),
    Query.limit(1000),
  ]);
  
  const types = new Set<string>();
  departments.rows.forEach(dept => {
    if (dept.type && dept.type !== '') {
      types.add(dept.type);
    }
  });
  
  return Array.from(types).sort();
}