/**
 * Public benefit readers. The two row readers are `"use cache"` entries on the
 * guest client; they THROW on failure (a cached `[]` would outlive the blip).
 * `getPublicBenefits` is deliberately NOT cached: it evaluates the publish
 * window against `new Date()` at request time, which `"use cache"` forbids.
 */

import { type Models, Query } from "@repo/api";
import { createPublicClient } from "@repo/api/server";
import type { Partners } from "@repo/api/types/appwrite";
import {
  BENEFIT_PUBLIC_COLUMNS,
  type BenefitPartnerInput,
  type BenefitRowInput,
  type PublicBenefit,
  publicBenefitsFromRows,
} from "@repo/shared/utils/benefit-public";
import { cacheLife, cacheTag } from "next/cache";

const BENEFIT_LIMIT = 1000;
const BENEFIT_PARTNER_LIMIT = 500;
const CAMPUS_LOGO_LIMIT = 500;

export interface CampusLogo {
  campusId: string;
  id: string;
  imageUrl: string;
  name: string;
  url: string | null;
}

export async function cachedBenefitRows(): Promise<BenefitRowInput[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("benefits");
  const { db } = await createPublicClient();
  const { rows } = await db.listRows<BenefitRowInput & Models.Row>(
    "app",
    "campus_benefits",
    [
      Query.equal("status", "published"),
      Query.select(["$id", "$createdAt", ...BENEFIT_PUBLIC_COLUMNS]),
      Query.limit(BENEFIT_LIMIT),
    ]
  );
  return rows;
}

export async function cachedBenefitPartners(): Promise<BenefitPartnerInput[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("benefits");
  const { db } = await createPublicClient();
  const { rows } = await db.listRows<BenefitPartnerInput & Models.Row>(
    "app",
    "benefit_partners",
    [Query.limit(BENEFIT_PARTNER_LIMIT)]
  );
  return rows;
}

export async function getPublicBenefits(): Promise<PublicBenefit[]> {
  const [rows, partners] = await Promise.all([
    cachedBenefitRows(),
    cachedBenefitPartners(),
  ]);
  return publicBenefitsFromRows(rows, partners, new Date());
}

export async function cachedCampusLogos(): Promise<CampusLogo[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("partners");
  const { db } = await createPublicClient();
  const { rows } = await db.listRows<Partners>("app", "partners", [
    Query.equal("level", "campus"),
    Query.orderAsc("campus_id"),
    Query.orderAsc("sort_order"),
    Query.limit(CAMPUS_LOGO_LIMIT),
  ]);
  return rows.map((row) => ({
    campusId: row.campus_id,
    id: row.$id,
    imageUrl: row.image_url,
    name: row.name,
    url: row.url ?? null,
  }));
}
