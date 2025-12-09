"use server";
import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { Campus } from "@repo/api/types/appwrite";

const _databaseId = "app";
const _collectionId = "campus";

export async function getCampuses() {
  const { db } = await createSessionClient();
  const campuses = await db.listRows<Campus>("app", "campus", [
    Query.select(["name", "$id"]),
  ]);
  return campuses.rows;
}
