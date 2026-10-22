import { type BenefitSection, isBenefitSection } from "./benefit-catalog";
import { resolveBenefitCampusIds } from "./benefit-scope";
import {
  isBenefitVisible,
  orderBenefitsCampusFirst,
} from "./benefit-visibility";

/** Columns the website reads. Never includes redemption_value. */
export const BENEFIT_PUBLIC_COLUMNS: readonly string[] = [
  "campus_id",
  "category",
  "description_en",
  "description_nb",
  "image_url",
  "is_featured",
  "partner_id",
  "publish_end",
  "publish_start",
  "redemption_type",
  "section",
  "sort_order",
  "status",
  "terms_en",
  "terms_nb",
  "title_en",
  "title_nb",
];

export interface BenefitRowInput {
  $createdAt: string;
  $id: string;
  campus_id: string;
  category?: string | null;
  description_en?: string | null;
  description_nb?: string | null;
  image_url?: string | null;
  is_featured?: boolean | null;
  partner_id?: string | null;
  publish_end?: string | null;
  publish_start?: string | null;
  redemption_type?: string | null;
  section?: string | null;
  sort_order?: number | null;
  status: string;
  terms_en?: string | null;
  terms_nb?: string | null;
  title_en?: string | null;
  title_nb?: string | null;
}

export interface BenefitPartnerInput {
  $id: string;
  is_active?: boolean | null;
  logo_url?: string | null;
  name: string;
  website_url?: string | null;
}

export interface PublicBenefit {
  campusId: string;
  category: string | null;
  createdAt: string;
  description: { en: string | null; nb: string | null };
  id: string;
  imageUrl: string | null;
  isFeatured: boolean;
  partner: {
    id: string;
    logoUrl: string | null;
    name: string;
    websiteUrl: string | null;
  } | null;
  publishEnd: string | null;
  redemptionType: "code" | "link" | "none" | "onsite";
  section: BenefitSection;
  sortOrder: number;
  terms: { en: string | null; nb: string | null };
  title: { en: string; nb: string };
}

const REDEMPTION_TYPES = ["code", "link", "onsite"] as const;

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toRedemptionType(
  value: string | null | undefined
): PublicBenefit["redemptionType"] {
  return (REDEMPTION_TYPES as readonly string[]).includes(value ?? "")
    ? (value as (typeof REDEMPTION_TYPES)[number])
    : "none";
}

export function publicBenefitsFromRows(
  rows: BenefitRowInput[],
  partners: BenefitPartnerInput[],
  now: Date
): PublicBenefit[] {
  const partnerById = new Map(partners.map((p) => [p.$id, p]));
  const result: PublicBenefit[] = [];

  for (const row of rows) {
    const partnerRow = row.partner_id
      ? (partnerById.get(row.partner_id) ?? null)
      : null;
    if (!isBenefitVisible(row, partnerRow, now)) {
      continue;
    }
    const nb = clean(row.title_nb);
    const en = clean(row.title_en);
    const fallback = nb ?? en;
    if (!fallback) {
      continue;
    }
    result.push({
      campusId: row.campus_id,
      category: clean(row.category),
      createdAt: row.$createdAt,
      description: {
        en: clean(row.description_en),
        nb: clean(row.description_nb),
      },
      id: row.$id,
      imageUrl: clean(row.image_url),
      isFeatured: row.is_featured === true,
      partner: partnerRow
        ? {
            id: partnerRow.$id,
            logoUrl: clean(partnerRow.logo_url),
            name: partnerRow.name,
            websiteUrl: clean(partnerRow.website_url),
          }
        : null,
      publishEnd: clean(row.publish_end),
      redemptionType: toRedemptionType(row.redemption_type),
      section: isBenefitSection(row.section) ? row.section : "member",
      sortOrder: row.sort_order ?? 0,
      terms: { en: clean(row.terms_en), nb: clean(row.terms_nb) },
      title: { en: en ?? fallback, nb: nb ?? fallback },
    });
  }
  return result;
}

export function benefitsForCampus(
  benefits: PublicBenefit[],
  campusId: string | null | undefined,
  sections?: readonly BenefitSection[]
): PublicBenefit[] {
  const campusIds = resolveBenefitCampusIds(campusId);
  const scoped = benefits.filter(
    (b) =>
      campusIds.includes(b.campusId) &&
      (!sections || sections.includes(b.section))
  );
  const asRows = scoped.map((b) => ({
    $createdAt: b.createdAt,
    campus_id: b.campusId,
    sort_order: b.sortOrder,
    benefit: b,
  }));
  return orderBenefitsCampusFirst(asRows, campusId).map((r) => r.benefit);
}

export function countVisibleMemberBenefits(
  benefits: PublicBenefit[],
  campusId: string | null | undefined
): number {
  return benefitsForCampus(benefits, campusId, ["member"]).length;
}
