export const MEMBERSHIP_TEXT_SPOTS = [
  "home_join",
  "plan_card",
  "portal_locked",
  "onboarding",
  "shop_callout",
  "business",
  "business_hotspot",
] as const;

export type MembershipTextSpot = (typeof MEMBERSHIP_TEXT_SPOTS)[number];

export const MEMBERSHIP_TEXT_MAX_ITEMS = 12;
export const MEMBERSHIP_TEXT_TITLE_MAX = 200;
export const MEMBERSHIP_TEXT_BODY_MAX = 500;

export interface MembershipTextSpotMeta {
  /** i18n key paths (first segment is the namespace), in display order. */
  defaults: { body?: string; title: string }[];
  hasBody: boolean;
  labelEn: string;
  labelNb: string;
  path: string;
}

const lines = (prefix: string, keys: string[]) =>
  keys.map((key) => ({ title: `${prefix}${key}` }));

const businessItem = (key: string) => ({
  body: `partner.benefits.items.${key}.description`,
  title: `partner.benefits.items.${key}.title`,
});

export const MEMBERSHIP_TEXT_SPOT_META: Record<
  MembershipTextSpot,
  MembershipTextSpotMeta
> = {
  home_join: {
    defaults: ["social", "career", "student", "safety", "business"].map(
      (key) => ({ title: `membership.benefits.categories.${key}.global` })
    ),
    hasBody: false,
    labelEn: "Home page - Join",
    labelNb: "Forsiden – «Bli med»",
    path: "/",
  },
  plan_card: {
    defaults: lines("memberPortal.cta.benefits.", [
      "discounts",
      "events",
      "career",
      "card",
      "priority",
    ]),
    hasBody: false,
    labelEn: "Membership cards",
    labelNb: "Medlemskapskortene",
    path: "/member",
  },
  portal_locked: {
    defaults: lines("memberPortal.locked.quickBenefits.", [
      "discounts",
      "card",
      "priority",
      "career",
    ]),
    hasBody: false,
    labelEn: "Locked content in the member portal",
    labelNb: "Låst innhold i medlemsportalen",
    path: "/member",
  },
  onboarding: {
    defaults: lines("onboarding.student.benefits.", [
      "membership",
      "events",
      "sso",
    ]),
    hasBody: false,
    labelEn: "Welcome flow",
    labelNb: "Velkomstflyten",
    path: "/onboarding",
  },
  shop_callout: {
    defaults: lines("shop.member.", [
      "benefitDiscounts",
      "benefitEvents",
      "benefitPriority",
      "benefitPartner",
    ]),
    hasBody: false,
    labelEn: "Web shop - member box",
    labelNb: "Nettbutikken – medlemsboksen",
    path: "/shop",
  },
  business: {
    defaults: ["colleagues", "values", "match"].map(businessItem),
    hasBody: true,
    labelEn: "For businesses",
    labelNb: "For bedrifter",
    path: "/business",
  },
  business_hotspot: {
    defaults: lines("businessHotspot.benefits.", [
      "access",
      "recruitment",
      "booking",
      "engage",
      "partnership",
      "visibility",
    ]),
    hasBody: false,
    labelEn: "Business Hotspot",
    labelNb: "Business Hotspot",
    path: "/business-hotspot",
  },
};

export interface MembershipTextItem {
  body: string | null;
  title: string;
}

export interface MembershipTextRowInput {
  body_en?: string | null;
  body_nb?: string | null;
  sort_order?: number | null;
  spot: string;
  title_en?: string | null;
  title_nb: string;
}

const localized = (
  en: string | null | undefined,
  nb: string | null | undefined,
  locale: "en" | "no"
): string => {
  const nbText = nb?.trim() ?? "";
  if (locale === "no") {
    return nbText;
  }
  return en?.trim() || nbText;
};

const orderOf = (row: MembershipTextRowInput): number =>
  row.sort_order ?? Number.POSITIVE_INFINITY;

/** Items for a spot, or null when the spot has no (usable) rows. */
export function membershipTextItems(
  rows: MembershipTextRowInput[],
  spot: MembershipTextSpot,
  locale: "en" | "no"
): MembershipTextItem[] | null {
  const { hasBody } = MEMBERSHIP_TEXT_SPOT_META[spot];
  const items: MembershipTextItem[] = [];
  const spotRows = rows
    .filter((row) => row.spot === spot)
    .sort((a, b) => {
      const left = orderOf(a);
      const right = orderOf(b);
      if (left === right) {
        return 0;
      }
      return left < right ? -1 : 1;
    });
  for (const row of spotRows) {
    const title = localized(row.title_en, row.title_nb, locale);
    if (!title) {
      continue;
    }
    const body = hasBody
      ? localized(row.body_en, row.body_nb, locale) || null
      : null;
    items.push({ body, title });
  }
  return items.length > 0 ? items : null;
}

const lookup = (messages: Record<string, unknown>, path: string): string => {
  let node: unknown = messages;
  for (const segment of path.split(".")) {
    if (typeof node !== "object" || node === null || !(segment in node)) {
      throw new Error(`Missing membership text default: ${path}`);
    }
    node = (node as Record<string, unknown>)[segment];
  }
  if (typeof node !== "string") {
    throw new Error(`Membership text default is not a string: ${path}`);
  }
  return node;
};

/** The built-in text for a spot, read from a messages object keyed by namespace. */
export function resolveDefaultItems(
  spot: MembershipTextSpot,
  messages: Record<string, unknown>
): MembershipTextItem[] {
  return MEMBERSHIP_TEXT_SPOT_META[spot].defaults.map((entry) => ({
    body: entry.body ? lookup(messages, entry.body) : null,
    title: lookup(messages, entry.title),
  }));
}

export function membershipTextRowId(
  spot: MembershipTextSpot,
  index: number
): string {
  return `${spot.replaceAll("_", "-")}-${index}`;
}
