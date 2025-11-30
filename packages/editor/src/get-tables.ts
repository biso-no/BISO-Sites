"use server";

import type { Models } from "@repo/api";
import { createAdminClient } from "@repo/api/server";

export async function getTables(): Promise<Models.TableList> {
  // Hardcoded for now, but could be fetched from Appwrite or config
  // If you want to fetch from Appwrite, you would need an Admin Client to list collections/databases
  // For now, we'll return the known collections as per the user request context (e.g. events, news)
  const { db } = await createAdminClient();

  const response = await db.listTables({
    databaseId: "app",
  });

  return response;
}
