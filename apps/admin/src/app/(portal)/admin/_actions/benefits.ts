"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import {
  getUserAuthContext,
  type UserAuthContext,
} from "@/lib/authorization";
import {
  applyScopeQueries,
  assertWriteAccess,
} from "@/lib/utils/authorization";
import type {
  CampusBenefits,
  CampusBenefitStatus,
  Partners,
} from "@repo/api/types/appwrite";
import { benefitSchema, type BenefitFormValues } from "./schemas";


async function requireAuth(): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) redirect("/auth/login");
  return ctx;
}

export async function listBenefits(opts?: {
  campusId?: string;
  status?: string;
  kind?: string;
}) {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  const queries: string[] = [
    Query.orderAsc("sort_order"),
    Query.orderDesc("$updatedAt"),
    Query.limit(100),
  ];

  if (opts?.status && opts.status !== "all") {
    queries.push(Query.equal("status", opts.status));
  }

  if (opts?.kind) {
    queries.push(Query.equal("kind", opts.kind));
  }

  // Scope by campus for non-global admins
  if (ctx.managedCampusIds.length > 0) {
    queries.push(Query.equal("campus_id", ctx.managedCampusIds));
  } else if (!ctx.roles.includes("globaladmin")) {
    if (ctx.resolvedCampusIds.length > 0) {
      queries.push(Query.equal("campus_id", ctx.resolvedCampusIds));
    }
  }

  const response = await db.listRows<CampusBenefits>(
    "app",
    "campus_benefits",
    queries
  );
  return response.rows;
}

export async function getBenefit(id: string) {
  await requireAuth();
  const { db } = await createSessionClient();

  const response = await db.listRows<CampusBenefits>("app", "campus_benefits", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  return response.rows[0] ?? null;
}

export async function createBenefit(values: BenefitFormValues) {
  const ctx = await requireAuth();
  const validated = benefitSchema.safeParse(values);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  assertWriteAccess(ctx, validated.data.campus_id);

  const { db } = await createSessionClient();

  const benefit = await db.createRow("app", "campus_benefits", "unique()", {
    campus_id: validated.data.campus_id,
    status: "draft" as CampusBenefitStatus,
    kind: validated.data.kind,
    redemption_type: validated.data.redemption_type,
    redemption_value: validated.data.redemption_value ?? null,
    category: validated.data.category,
    partner_name: validated.data.partner_name ?? null,
    title_nb: validated.data.title_nb,
    title_en: validated.data.title_en,
    description_nb: validated.data.description_nb,
    description_en: validated.data.description_en,
    teaser_nb: validated.data.teaser_nb ?? null,
    teaser_en: validated.data.teaser_en ?? null,
    image_url: validated.data.image_url || null,
    is_featured: validated.data.is_featured ?? false,
    is_member_only: validated.data.is_member_only ?? true,
    publish_start: validated.data.publish_start ?? null,
    publish_end: validated.data.publish_end ?? null,
    sort_order: validated.data.sort_order ?? 0,
  });

  revalidatePath("/admin/benefits");
  return { data: benefit.$id };
}

export async function updateBenefit(id: string, values: BenefitFormValues) {
  const ctx = await requireAuth();
  const validated = benefitSchema.safeParse(values);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  const { db } = await createSessionClient();

  const existing = await db.listRows<CampusBenefits>("app", "campus_benefits", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const benefit = existing.rows[0];
  if (!benefit) return { error: "Benefit not found" };

  assertWriteAccess(ctx, benefit.campus_id);

  await db.updateRow("app", "campus_benefits", id, {
    campus_id: validated.data.campus_id,
    status: validated.data.status as CampusBenefitStatus,
    kind: validated.data.kind,
    redemption_type: validated.data.redemption_type,
    redemption_value: validated.data.redemption_value ?? null,
    category: validated.data.category,
    partner_name: validated.data.partner_name ?? null,
    title_nb: validated.data.title_nb,
    title_en: validated.data.title_en,
    description_nb: validated.data.description_nb,
    description_en: validated.data.description_en,
    teaser_nb: validated.data.teaser_nb ?? null,
    teaser_en: validated.data.teaser_en ?? null,
    image_url: validated.data.image_url || null,
    is_featured: validated.data.is_featured ?? false,
    is_member_only: validated.data.is_member_only ?? true,
    publish_start: validated.data.publish_start ?? null,
    publish_end: validated.data.publish_end ?? null,
    sort_order: validated.data.sort_order ?? 0,
  });

  revalidatePath("/admin/benefits");
  revalidatePath(`/admin/benefits/${id}`);
  return { data: id };
}

export async function deleteBenefit(id: string) {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  const existing = await db.listRows<CampusBenefits>("app", "campus_benefits", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const benefit = existing.rows[0];
  if (!benefit) return { error: "Benefit not found" };

  assertWriteAccess(ctx, benefit.campus_id);

  await db.deleteRow("app", "campus_benefits", id);

  revalidatePath("/admin/benefits");
  return { data: true };
}

export async function listPartners(opts?: { campusId?: string }) {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  const queries: string[] = [
    Query.orderAsc("name"),
    Query.limit(100),
  ];

  if (opts?.campusId) {
    queries.push(Query.equal("campus_id", opts.campusId));
  } else if (ctx.managedCampusIds.length > 0 && !ctx.roles.includes("globaladmin")) {
    queries.push(Query.equal("campus_id", ctx.managedCampusIds));
  }

  const response = await db.listRows<Partners>("app", "partners", queries);
  return response.rows;
}
