"use server";

import { getStorageFileUrl, Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import {
  type ContentTranslations,
  ContentType,
  type Departments,
  Locale,
} from "@repo/api/types/appwrite";

type GetDepartmentsParams = {
  campusId?: string;
  active?: boolean;
  type?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export async function getDepartments(params: GetDepartmentsParams = {}) {
  const { db } = await createSessionClient();
  const { campusId, active, type, search, limit = 20, offset = 0 } = params;

  const queries: string[] = [];

  // Select department fields + relationships + all translations
  queries.push(
    Query.select([
      "$id",
      "Id",
      "Name",
      "active",
      "type",
      "logo",
      "campus_id",
      "campus.$id",
      "campus.name",
      "translations.*",
      "boardMembers.*",
      "socials.*",
      "users.*",
    ])
  );

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
  queries.push(Query.limit(limit));
  queries.push(Query.offset(offset));
  queries.push(Query.orderAsc("Name"));

  const departments = await db.listRows<Departments>(
    "app",
    "departments",
    queries
  );
  return departments.rows;
}

// Client-callable version that returns transformed data
export async function getDepartmentsClient(
  params: GetDepartmentsParams & { limit?: number; offset?: number } = {}
) {
  const departments = await getDepartments(params);

  // Transform departments to include computed fields
  const transformedDepartments = departments.map((dept) => {
    // Get English translation as default for display
    const enTranslation =
      dept.translations?.find((t) => t.locale === "en") ||
      dept.translations?.[0];

    return {
      ...dept,
      name: dept.Name,
      displayTitle: enTranslation?.title || dept.Name,
      campusName: dept.campus?.name || "Unknown",
      userCount: dept.users?.length || 0,
      boardMemberCount: dept.boardMembers?.length || 0,
      socialsCount: dept.socials?.length || 0,
    };
  });

  return {
    departments: transformedDepartments,
    hasMore: departments.length === (params.limit || 20),
  };
}

export async function getDepartmentById(id: string) {
  const { db } = await createSessionClient();

  const department = await db.getRow<Departments>("app", "departments", id, [
    Query.select([
      "$id",
      "Id",
      "Name",
      "active",
      "type",
      "logo",
      "campus_id",
      "campus.$id",
      "campus.name",
      "translations.*",
      "boardMembers.*",
      "socials.*",
    ]),
  ]);

  return department;
}

export async function getDepartmentTypes(): Promise<string[]> {
  const { db } = await createSessionClient();

  const departments = await db.listRows<Departments>("app", "departments", [
    Query.select(["type"]),
    Query.limit(1000),
  ]);

  const types = new Set<string>();
  departments.rows.forEach((dept) => {
    if (dept.type && dept.type !== "") {
      types.add(dept.type);
    }
  });

  return Array.from(types).sort();
}

async function _updateDepartment(
  id: string,
  data: {
    Name?: string;
    active?: boolean;
    type?: string;
    logo?: string;
    campus_id?: string;
  }
) {
  const { db } = await createSessionClient();

  await db.updateRow("app", "departments", id, data);
}

export async function createDepartment(data: {
  Id: string;
  Name: string;
  campus_id: string;
  active?: boolean;
  type?: string;
  logo?: string;
  translations: Array<{
    locale: "en" | "no";
    title: string;
    description: string;
    short_description?: string;
  }>;
}) {
  const { db } = await createSessionClient();

  // Build translation_refs array
  const translationRefs: ContentTranslations[] = data.translations.map(
    (t) =>
      ({
        content_type: ContentType.DEPARTMENT,
        content_id: "unique()",
        locale: t.locale === "en" ? Locale.EN : Locale.NO,
        title: t.title,
        description: t.description,
        short_description: t.short_description || null,
      }) as ContentTranslations
  );

  // Create department with translations
  const department = await db.createRow<Departments>(
    "app",
    "departments",
    "unique()",
    {
      Id: data.Id,
      Name: data.Name,
      campus_id: data.campus_id,
      active: data.active ?? true,
      type: data.type || null,
      logo: data.logo || null,
      translation_refs: translationRefs,
    } as any
  );

  return department;
}

export async function updateDepartmentWithTranslations(
  departmentId: string,
  departmentData: {
    Name?: string;
    active?: boolean;
    type?: string;
    logo?: string;
    campus_id?: string;
  },
  translations: Array<{
    id?: string;
    locale: "en" | "no";
    title: string;
    description: string;
    short_description?: string;
  }>
) {
  const { db } = await createSessionClient();

  // Update department basic data
  if (Object.keys(departmentData).length > 0) {
    await db.updateRow("app", "departments", departmentId, departmentData);
  }

  // Update or create translations
  for (const translation of translations) {
    if (translation.id) {
      // Update existing translation
      await db.updateRow("app", "content_translations", translation.id, {
        title: translation.title,
        description: translation.description,
        short_description: translation.short_description || null,
      });
    } else {
      // Create new translation
      await db.createRow<ContentTranslations>(
        "app",
        "content_translations",
        "unique()",
        {
          content_type: ContentType.DEPARTMENT,
          content_id: departmentId,
          locale: translation.locale === "en" ? Locale.EN : Locale.NO,
          title: translation.title,
          description: translation.description,
          short_description: translation.short_description || null,
        } as any
      );
    }
  }
}

// Storage bucket IDs
const DEPARTMENT_LOGO_BUCKET = "units";
const DEPARTMENT_HERO_BUCKET = "content";

/**
 * Upload a department logo image
 */
export async function uploadDepartmentLogo(formData: FormData) {
  const file = formData.get("file");
  if (!(file && file instanceof File)) {
    throw new Error("No file provided");
  }

  const { storage } = await createSessionClient();
  const uploaded = await storage.createFile(
    DEPARTMENT_LOGO_BUCKET,
    "unique()",
    file
  );
  const url = getStorageFileUrl(DEPARTMENT_LOGO_BUCKET, uploaded.$id);

  return { id: uploaded.$id, url };
}

/**
 * Upload a department hero image
 */
export async function uploadDepartmentHero(formData: FormData) {
  const file = formData.get("file");
  if (!(file && file instanceof File)) {
    throw new Error("No file provided");
  }

  const { storage } = await createSessionClient();
  const uploaded = await storage.createFile(
    DEPARTMENT_HERO_BUCKET,
    "unique()",
    file
  );
  const url = getStorageFileUrl(DEPARTMENT_HERO_BUCKET, uploaded.$id);

  return { id: uploaded.$id, url };
}
