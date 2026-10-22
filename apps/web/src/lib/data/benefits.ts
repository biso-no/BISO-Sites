/**
 * Public benefit readers. The two row readers are `"use cache"` entries on the
 * guest client; they THROW on failure (a cached `[]` would outlive the blip).
 * `getPublicBenefits` is deliberately NOT cached: it evaluates the publish
 * window against `new Date()` at request time, which `"use cache"` forbids.
 * It awaits `connection()` first, so it is request-time by construction and
 * callers need no Suspense/dynamic handling of their own for the clock.
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
import { connection } from "next/server";

// Well above the real row count; ordered newest-first so truncation drops the oldest.
const BENEFIT_LIMIT = 1000;
// Well above the real partner count.
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
      Query.orderDesc("$createdAt"),
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
  // Opt out of prerendering before reading the clock, so any caller is safe
  // under Cache Components (no `blocking-prerender-current-time`).
  await connection();
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
    Query.select([
      "$id",
      "name",
      "url",
      "image_url",
      "campus_id",
      "sort_order",
    ]),
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
