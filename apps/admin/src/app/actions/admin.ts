"use server";
import { ID, Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import {
  type Campus,
  type ContentTranslations,
  type Departments,
  ExpenseAttachments,
  type Expenses,
  type News,
  type Users,
} from "@repo/api/types/appwrite";
import { revalidatePath } from "next/cache";
import { attachmentImage } from "@/lib/types/attachmentImage";

export async function getUserRoles() {
  const availableRoles = ["Admin", "pr", "finance", "hr", "users", "Control Committee"];

  const { teams } = await createSessionClient();

  const response = await teams.list([Query.equal("name", availableRoles)]);
  return response.teams.map((team) => team.name);
}

export async function getUsers() {
  const { db } = await createSessionClient();
  const response = await db.listRows<Users>("app", "user", [Query.limit(100)]);

  return response.rows;
}

export async function getPosts() {
  const { db } = await createSessionClient();
  const response = await db.listRows<News>("app", "news", [Query.limit(100)]);

  return response.rows;
}

export async function getPost(postId: string) {
  const { db } = await createSessionClient();
  const response = await db.getRow<News>("app", "news", postId);

  return response;
}

export async function updatePost(postId: string, post: News) {
  const { db } = await createSessionClient();
  const response = await db.getRow<News>("app", "news", postId);
  revalidatePath("/admin/posts");

  // First we map over the tanslation_refs array, and create an array of all objects with existing and updated values
  const translationRefs = response.translation_refs.map((translation: ContentTranslations) => {
    if (typeof translation === "string") return translation; // Should not happen in getRow response but safe to handle

    const matchingRef = Array.isArray(post.translation_refs)
      ? (post.translation_refs as ContentTranslations[]).find(
          (t) => typeof t !== "string" && t.locale === translation.locale,
        )
      : undefined;

    return {
      $id: translation.$id,
      locale: translation.locale,
      title: matchingRef?.title ?? translation.title,
      description: matchingRef?.description ?? translation.description,
    };
  });

  await Promise.all(
    translationRefs.map((ref) => {
      if (typeof ref === "string") return Promise.resolve();
      return db.updateRow("app", "content_translations", ref.$id, {
        title: ref.title,
        description: ref.description,
      });
    }),
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
      department_id: typeof post.department === "string" ? post.department : post.department.$id,
    }, // data (optional)
  );
}

export async function createPost(post: News) {
  const { db } = await createSessionClient();

  // Safely get relationship IDs
  const departmentId = typeof post.department === "string" ? post.department : post.department?.$id;
  const campusId = typeof post.campus === "string" ? post.campus : post.campus?.$id;

  const result = await db.createRow<News>(
    "app", // databaseId
    "news", // collectionId
    "unique()",
    {
      url: post.url,
      status: post.status,
      image: post.image,
      campus_id: post.campus_id,
      department_id: departmentId,
      campus: campusId, // Set relationship using ID
      department: departmentId, // Set relationship using ID
      slug: post.slug,
      sticky: post.sticky,
      metadata: post.metadata,
      translation_refs: [], // Initialize empty translation refs
    }, // data (optional)
  );
  revalidatePath("/admin/posts");
  return result;
}

export async function deletePost(postId: string) {
  const { db } = await createSessionClient();

  const result = await db.deleteRow(
    "app", // databaseId
    "news", // collectionId
    postId, // documentId
  );
  revalidatePath("/admin/posts");
  return result;
}

export async function getExpenses(fieldsToSelect?: string[]) {
  const { db } = await createSessionClient();
  const queries = [Query.limit(100)];
  if (fieldsToSelect) {
    queries.push(Query.select(fieldsToSelect));
  }
  const response = await db.listRows<Expenses>("app", "expense", queries);

  return response.rows;
}

async function getExpensesByLoggedInUser() {
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
  const response = await db.listRows<Departments>("app", "departments", [Query.limit(1000)]);

  return response.rows;
}

export async function getCampuses() {
  const { db } = await createSessionClient();
  const response = await db.listRows<Campus>("app", "campus", [Query.limit(100)]);

  return response.rows;
}
