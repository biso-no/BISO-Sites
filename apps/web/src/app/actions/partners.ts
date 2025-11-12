"use server";

import { createAdminClient } from "@repo/api/server";
import { Query, Models } from "@repo/api";
import { Partners } from "@repo/api/types/appwrite";

export async function listPartners(level?: "national" | "campus") {
  const { db } = await createAdminClient();
  const queries = [Query.limit(200), Query.orderAsc("name")];
  if (level) queries.push(Query.equal("level", level));
  const res = await db.listRows<Partners>("app", "partners", queries);
  return res.rows;
}

export async function createPartner(formData: FormData) {
  const { db } = await createAdminClient();
  const data = {
    name: String(formData.get("name") || "").trim(),
    url: (formData.get("url") ? String(formData.get("url")) : undefined) as string | undefined,
    level: (String(formData.get("level") || "national") as "national" | "campus"),
    image_bucket: String(formData.get("image_bucket") || "partners").trim(),
    image_file_id: String(formData.get("image_file_id") || "").trim(),
    campus: undefined as any,
  };

  const campusId = String(formData.get("campus_id") || "").trim();
  if (campusId) {
    // relationship expects document id reference
    (data as any).campus = campusId;
  }

  if (!data.name || !data.level || !data.image_bucket || !data.image_file_id) {
    throw new Error("Missing required fields");
  }

  await db.createRow<Partners>("app", "partners", "unique()", data);
}

export async function deletePartner(formData: FormData) {
  const { db } = await createAdminClient();
  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Missing id");
  await db.deleteRow("app", "partners", id);
}


