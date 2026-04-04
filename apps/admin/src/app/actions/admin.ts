"use server";
import { ID, Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type {
  Campus,
  ContentTranslations,
  Departments,
  Expenses,
  News,
  Users,
} from "@repo/api/types/appwrite";
import { ContentType, Locale } from "@repo/api/types/appwrite";
import { revalidatePath } from "next/cache";

import { getUserAuthContext, getUserRolesForClient } from "@/lib/authorization";
import { getCampusManagementTeamId } from "@/lib/campus-constants";
import { buildContentPermissions } from "@/lib/permissions";
import { DEPARTMENT_ROLE } from "@/lib/roles";
import {
  applyScopeQueries,
  assertWriteAccess,
} from "@/lib/utils/authorization";

/**
 * Get user roles for client-side navigation.
 * Returns standardized role names derived from Azure AD Security Groups.
 */
export async function getUserRoles(): Promise<string[]> {
  const { roles, hasDepartmentMembership } = await getUserRolesForClient();

  // Add department pseudo-role if user has department membership
  if (hasDepartmentMembership) {
    return [...roles, DEPARTMENT_ROLE];
  }

  return roles;
}

export async function getUsers() {
  const { db } = await createSessionClient();
  const response = await db.listRows<Users>("app", "user", [Query.limit(100)]);

  return response.rows;
}

export async function getPosts() {
  const { db } = await createSessionClient();
  const ctx = await getUserAuthContext();

  const queries: string[] = [Query.limit(100)];
  if (ctx) {
    queries.push(...applyScopeQueries(ctx));
  }

  const response = await db.listRows<News>("app", "news", queries);
  return response.rows;
}

export async function getPost(postId: string) {
  const { db } = await createSessionClient();
  const response = await db.getRow<News>("app", "news", postId);

  return response;
}

export async function updatePost(postId: string, post: News) {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    throw new Error("Unauthorized");
  }

  const { db } = await createSessionClient();
  const response = await db.getRow<News>("app", "news", postId);

  const existingDeptId =
    typeof response.department === "string"
      ? response.department
      : response.department?.$id;
  assertWriteAccess(ctx, response.campus_id, existingDeptId ?? undefined);

  revalidatePath("/posts");

  // First we map over the tanslation_refs array, and create an array of all objects with existing and updated values
  const translationRefs = response.translation_refs.map(
    (translation: ContentTranslations) => {
      if (typeof translation === "string") {
        return translation; // Should not happen in getRow response but safe to handle
      }

      const matchingRef = Array.isArray(post.translation_refs)
        ? (post.translation_refs as ContentTranslations[]).find(
            (t) => typeof t !== "string" && t.locale === translation.locale
          )
        : undefined;

      return {
        $id: translation.$id,
        locale: translation.locale,
        title: matchingRef?.title ?? translation.title,
        description: matchingRef?.description ?? translation.description,
      };
    }
  );

  await Promise.all(
    translationRefs.map((ref) => {
      if (typeof ref === "string") {
        return Promise.resolve();
      }
      return db.updateRow("app", "content_translations", ref.$id, {
        title: ref.title,
        description: ref.description,
      });
    })
  );

  return db.updateRow<News>(
    "app", // databaseId
    "news", // collectionId
    postId, // documentId
    {
      url: post.url,
      status: post.status,
      image: post.image,
      campus_id: post.campus_id,
      department_id:
        typeof post.department === "string"
          ? post.department
          : post.department.$id,
    } // data (optional)
  );
}

export async function createPost(post: News) {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    throw new Error("Unauthorized");
  }

  const departmentId =
    typeof post.department === "string"
      ? post.department
      : post.department?.$id;
  const campusId =
    typeof post.campus === "string" ? post.campus : post.campus?.$id;

  assertWriteAccess(ctx, post.campus_id, departmentId ?? undefined);

  const campusManagementTeamId = getCampusManagementTeamId(post.campus_id);

  const permissions = buildContentPermissions({
    status: post.status ?? "draft",
    departmentTeamId: ctx.departmentTeamIds[0] ?? null,
    campusManagementTeamId,
  });

  const { db } = await createSessionClient();

  const result = await db.createRow<News>(
    "app",
    "news",
    "unique()",
    {
      url: post.url,
      status: post.status,
      image: post.image,
      campus_id: post.campus_id,
      department_id: departmentId,
      campus: campusId,
      department: departmentId,
      slug: post.slug,
      sticky: post.sticky,
      metadata: post.metadata,
      translation_refs: [],
    },
    permissions
  );
  revalidatePath("/posts");
  return result;
}

// ── Typed post save ────────────────────────────────────────────────────────
// Replaces the old createPost/updatePost which required casting to `News`.

export type PostFormInput = {
  translations: {
    en: { title: string; description: string };
    no: { title: string; description: string };
  };
  status: "draft" | "published";
  campus_id: string;
  department_id?: string;
  image?: string;
  slug?: string;
  sticky?: boolean;
  author?: string;
};

export async function createPostFromForm(data: PostFormInput): Promise<News> {
  const ctx = await getUserAuthContext();
  if (!ctx) throw new Error("Unauthorized");

  assertWriteAccess(ctx, data.campus_id, data.department_id);

  const campusManagementTeamId = getCampusManagementTeamId(data.campus_id);
  const permissions = buildContentPermissions({
    status: data.status,
    departmentTeamId: ctx.departmentTeamIds[0] ?? null,
    campusManagementTeamId,
  });

  const { db } = await createSessionClient();
  const newsId = ID.unique();

  const translationRefs: ContentTranslations[] = [
    {
      content_id: newsId,
      content_type: ContentType.NEWS,
      locale: Locale.EN,
      title: data.translations.en.title,
      description: data.translations.en.description,
      $permissions: permissions,
    } as ContentTranslations,
    {
      content_id: newsId,
      content_type: ContentType.NEWS,
      locale: Locale.NO,
      title: data.translations.no.title,
      description: data.translations.no.description,
      $permissions: permissions,
    } as ContentTranslations,
  ];

  const result = await db.createRow<News>(
    "app",
    "news",
    newsId,
    {
      slug: data.slug ?? null,
      status: data.status,
      image: data.image ?? null,
      campus_id: data.campus_id,
      department_id: data.department_id ?? null,
      campus: data.campus_id,
      department: data.department_id ?? null,
      sticky: data.sticky ?? false,
      author: data.author ?? null,
      translation_refs: translationRefs,
    },
    permissions,
  );

  revalidatePath("/posts");
  return result;
}

export async function updatePostFromForm(
  postId: string,
  data: PostFormInput,
): Promise<void> {
  const ctx = await getUserAuthContext();
  if (!ctx) throw new Error("Unauthorized");

  const { db } = await createSessionClient();

  // Get existing post to verify access
  const existing = await db.getRow<News>("app", "news", postId);
  const existingDeptId =
    typeof existing.department === "string"
      ? existing.department
      : existing.department?.$id;
  assertWriteAccess(ctx, existing.campus_id, existingDeptId ?? undefined);

  // Update translations
  const campusManagementTeamId = getCampusManagementTeamId(data.campus_id);
  const permissions = buildContentPermissions({
    status: data.status,
    departmentTeamId: ctx.departmentTeamIds[0] ?? null,
    campusManagementTeamId,
  });

  const existingRefs = Array.isArray(existing.translation_refs)
    ? (existing.translation_refs as ContentTranslations[]).filter(
        (r): r is ContentTranslations => typeof r !== "string",
      )
    : [];

  const buildRef = (locale: Locale, title: string, description: string) => {
    const found = existingRefs.find((r) => r.locale === locale);
    return {
      ...(found?.$id ? { $id: found.$id } : {}),
      content_id: postId,
      content_type: ContentType.NEWS,
      locale,
      title,
      description,
      $permissions: permissions,
    } as ContentTranslations;
  };

  const translationRefs = [
    buildRef(Locale.EN, data.translations.en.title, data.translations.en.description),
    buildRef(Locale.NO, data.translations.no.title, data.translations.no.description),
  ];

  await db.updateRow<News>("app", "news", postId, {
    status: data.status,
    image: data.image ?? null,
    campus_id: data.campus_id,
    department_id: data.department_id ?? null,
    campus: data.campus_id,
    department: data.department_id ?? null,
    sticky: data.sticky ?? false,
    author: data.author ?? null,
    translation_refs: translationRefs,
  });

  revalidatePath("/posts");
}
// ── End typed post save ────────────────────────────────────────────────────

export async function deletePost(postId: string) {
  const { db } = await createSessionClient();

  const result = await db.deleteRow(
    "app", // databaseId
    "news", // collectionId
    postId // documentId
  );
  revalidatePath("/posts");
  return result;
}

export async function getExpenses(fieldsToSelect?: string[]) {
  const { db } = await createSessionClient();
  const ctx = await getUserAuthContext();

  const queries: string[] = [Query.limit(100)];
  if (fieldsToSelect) {
    queries.push(Query.select(fieldsToSelect));
  }

  // Global admins see all expenses; campus admins see their campus;
  // department users see their department only.
  // The expense table uses string field "campus" (not campus_id), so we map
  // the scope queries from campus_id -> campus field name.
  if (ctx && !ctx.roles.includes("globaladmin")) {
    if (ctx.managedCampuses.length > 0) {
      queries.push(Query.equal("campus", ctx.managedCampuses));
    } else if (ctx.departmentNames.length > 0) {
      queries.push(Query.equal("department", ctx.departmentNames));
    }
  }

  const response = await db.listRows<Expenses>("app", "expense", queries);
  return response.rows;
}

async function _getExpensesByLoggedInUser() {
  //console.log(user.user.$id)
  //console.log("here")
  const { db, account } = await createSessionClient();
  const user = await account.get();
  //console.log(user.$id)
  const response = await db.listRows<Expenses>("app", "expense", [
    Query.equal("userId", user.$id),
    Query.limit(100),
  ]);

  return response.rows;
}

export async function getExpense(id: string) {
  const { db } = await createSessionClient();
  const response = await db.getRow<Expenses>("app", "expense", id, [
    Query.select([
      "$id",
      "user.*",
      "department",
      "campus",
      "campusRel.name",
      "departmentRel.Name",
      "campusRel.$id",
      "departmentRel.$id",
      "total",
      "prepayment_amount",
      "description",
      "expenseAttachments.*",
      "bank_account",
      "invoice_id",
      "status",
      "$createdAt",
      "$updatedAt",
      "userId",
      "user.name",
      "user.email",
      "user.$id",
    ]),
  ]);

  return response;
}

export async function getDepartments() {
  const { db } = await createSessionClient();
  const response = await db.listRows<Departments>("app", "departments", [
    Query.limit(1000),
  ]);

  return response.rows;
}

export async function getCampuses() {
  const { db } = await createSessionClient();
  const response = await db.listRows<Campus>("app", "campus", [
    Query.limit(100),
  ]);

  return response.rows;
}
