/**
 * Expense cost-type → GL account mapping (pure, framework-agnostic).
 *
 * A "cost type" is a human-friendly label (Travel, Social event, …) that resolves
 * to a 24SevenOffice general-ledger account + tax code. The authoritative list
 * lives in the `expense_cost_types` Appwrite table (editable by accounting); the
 * seed below is the initial data and a safe in-code fallback.
 *
 * Account numbers here are STARTING DEFAULTS; accounting can adjust them in the
 * table without a code change.
 */

export interface CostTypeOption {
  /** Default debit GL account number for receipts of this cost type. */
  accountNumber: number;
  active?: boolean;
  /** Ask the submitter which occasion (event/meeting) the receipt belongs to. */
  askOccasion?: boolean;
  description?: string | null;
  label: string;
  labelNo?: string | null;
  /** OCR category this cost type is the default for. */
  ocrCategory?: string | null;
  slug: string;
  sortOrder?: number;
  /** Tax code number (see GET /taxes); 0 = no tax. */
  taxCode?: number | null;
}

/** Minimum AI confidence for its suggested type to be applied on its own. */
export const AI_TYPE_CONFIDENCE_THRESHOLD = 0.8;

/** How many of the latest booked examples the AI re-run check scores. */
export const AI_RERUN_LIMIT = 200;

/**
 * Owner-reviewable starting list. Seeds the `expense_cost_types` table; the
 * table is authoritative once seeded and accounting edits it there.
 */
export const STARTING_EXPENSE_COST_TYPES = [
  {
    slug: "travel",
    label: "Travel",
    labelNo: "Reise",
    accountNumber: 7140,
    taxCode: 0,
    askOccasion: false,
    active: true,
    sortOrder: 0,
    description: "Flights, train, bus, hotel and taxi",
  },
  {
    slug: "travel-food",
    label: "Food while travelling",
    labelNo: "Mat på reise",
    accountNumber: 7160,
    taxCode: 0,
    askOccasion: false,
    active: true,
    sortOrder: 1,
    description: "Meals bought while travelling for BISO",
  },
  {
    slug: "car-transport",
    label: "Car rental, fuel and parking",
    labelNo: "Leiebil, drivstoff og parkering",
    accountNumber: 6430,
    taxCode: 0,
    askOccasion: false,
    active: true,
    sortOrder: 2,
    description: "Hired cars or vans, fuel, tolls and parking",
  },
  {
    slug: "meeting-food",
    label: "Food during meetings",
    labelNo: "Møtemat",
    accountNumber: 7360,
    taxCode: 0,
    askOccasion: true,
    active: true,
    sortOrder: 3,
    description: "Food or drinks for a meeting; not social events",
  },
  {
    slug: "board-event",
    label: "Board or internal event",
    labelNo: "Styre- eller internarrangement",
    accountNumber: 7300,
    taxCode: 0,
    askOccasion: true,
    active: true,
    sortOrder: 4,
    description: "Food and activities for a board or committee's own members",
  },
  {
    slug: "social",
    label: "Social event",
    labelNo: "Sosialt arrangement",
    accountNumber: 7310,
    taxCode: 0,
    askOccasion: true,
    active: true,
    sortOrder: 5,
    description: "Parties and social events for students",
  },
  {
    slug: "academic",
    label: "Academic event",
    labelNo: "Faglig arrangement",
    accountNumber: 7305,
    taxCode: 0,
    askOccasion: false,
    active: true,
    sortOrder: 6,
    description: "Talks, seminars, case competitions and other academic events",
  },
  {
    slug: "open-day",
    label: "Open day, stands and recruitment",
    labelNo: "Stand, åpen dag og rekruttering",
    accountNumber: 7315,
    taxCode: 0,
    askOccasion: false,
    active: true,
    sortOrder: 7,
    description: "Stands, open days and recruitment days",
  },
  {
    slug: "general-assembly",
    label: "General assembly",
    labelNo: "Generalforsamling",
    accountNumber: 7316,
    taxCode: 0,
    askOccasion: false,
    active: true,
    sortOrder: 8,
    description: "Food and costs for general assemblies",
  },
  {
    slug: "venue-rental",
    label: "Venue rental",
    labelNo: "Leie av lokale",
    accountNumber: 6310,
    taxCode: 0,
    askOccasion: false,
    active: true,
    sortOrder: 9,
    description: "Renting a room or venue",
  },
  {
    slug: "equipment",
    label: "Equipment and inventory",
    labelNo: "Utstyr og inventar",
    accountNumber: 6540,
    taxCode: 0,
    askOccasion: false,
    active: true,
    sortOrder: 10,
    description: "Equipment, adapters, microphones and other inventory",
  },
  {
    slug: "office-supplies",
    label: "Office supplies",
    labelNo: "Kontorrekvisita",
    accountNumber: 6800,
    taxCode: 0,
    askOccasion: false,
    active: true,
    sortOrder: 11,
    description: "Office supplies and small items for the office",
  },
  {
    slug: "digital-services",
    label: "Digital services and software",
    labelNo: "Digitale tjenester og programvare",
    accountNumber: 6810,
    taxCode: 0,
    askOccasion: false,
    active: true,
    sortOrder: 12,
    description: "Software, subscriptions and online services",
  },
  {
    slug: "marketing",
    label: "Marketing and print",
    labelNo: "Markedsføring og trykk",
    accountNumber: 7320,
    taxCode: 0,
    askOccasion: false,
    active: true,
    sortOrder: 13,
    description: "Posters, banners, ads and printing",
  },
  {
    slug: "merch",
    label: "Merch and clothing",
    labelNo: "Merch og klær",
    accountNumber: 7325,
    taxCode: 0,
    askOccasion: false,
    active: true,
    sortOrder: 14,
    description: "Sweaters, T-shirts and other branded clothing",
  },
  {
    slug: "prizes",
    label: "Prizes",
    labelNo: "Premier",
    accountNumber: 7330,
    taxCode: 0,
    askOccasion: false,
    active: true,
    sortOrder: 15,
    description: "Prizes for competitions",
  },
  {
    slug: "gifts-external",
    label: "Gifts to external people",
    labelNo: "Gaver til eksterne",
    accountNumber: 7420,
    taxCode: 0,
    askOccasion: false,
    active: true,
    sortOrder: 16,
    description: "Flowers and gifts for speakers, partners and guests",
  },
  {
    slug: "gifts-volunteers",
    label: "Gifts to volunteers and board",
    labelNo: "Gaver til frivillige og styret",
    accountNumber: 5900,
    taxCode: 0,
    askOccasion: true,
    active: true,
    sortOrder: 17,
    description: "Gifts for BISO volunteers and board members",
  },
  {
    slug: "shipping",
    label: "Shipping and postage",
    labelNo: "Frakt og porto",
    accountNumber: 6100,
    taxCode: 0,
    askOccasion: false,
    active: true,
    sortOrder: 18,
    description: "Sending parcels and freight",
  },
  {
    slug: "cabin-rental",
    label: "Cabin rental",
    labelNo: "Hytteleie",
    accountNumber: 6490,
    taxCode: 0,
    askOccasion: false,
    active: true,
    sortOrder: 19,
    description: "Renting a cabin",
  },
  {
    slug: "courses",
    label: "Courses and training",
    labelNo: "Kurs og opplæring",
    accountNumber: 6860,
    taxCode: 0,
    askOccasion: false,
    active: true,
    sortOrder: 20,
    description: "Courses, training and first aid",
  },
  {
    slug: "other",
    label: "Other",
    labelNo: "Annet",
    accountNumber: 6555,
    taxCode: 0,
    askOccasion: false,
    active: true,
    sortOrder: 21,
    description: "Anything that does not fit the types above",
  },
] as const satisfies readonly CostTypeOption[];

const [TRAVEL, , , , , SOCIAL, ACADEMIC, , , , , , , , , , , , , , , OTHER] =
  STARTING_EXPENSE_COST_TYPES;

/** Fallback used where the table is unavailable (the web form until it reads the table). */
export const DEFAULT_EXPENSE_COST_TYPES = [
  TRAVEL,
  SOCIAL,
  ACADEMIC,
  OTHER,
] as const satisfies readonly CostTypeOption[];

/** Norwegian label for the "no" locale when set, otherwise the English label. */
export function costTypeLabel(
  option: Pick<CostTypeOption, "label" | "labelNo">,
  locale: string
): string {
  return locale === "no" && option.labelNo ? option.labelNo : option.label;
}

export const DEFAULT_COST_TYPE_SLUG = "other";

/** Maps every OCR category to a default cost-type slug. */
const OCR_CATEGORY_TO_SLUG: Record<string, string> = {
  travel: "travel",
  accommodation: "travel",
  meal: "social",
  "event-materials": "academic",
  supplies: "other",
  fee: "other",
  other: "other",
};

export function findCostType(
  slug: string | null | undefined,
  options: readonly CostTypeOption[] = DEFAULT_EXPENSE_COST_TYPES
): CostTypeOption | undefined {
  if (!slug) {
    return undefined;
  }
  return options.find((option) => option.slug === slug);
}

/**
 * Picks the default cost-type slug for an OCR category, constrained to the cost
 * types that actually exist in `options`. Falls back to "other" (or the first
 * available option) when no mapping resolves.
 */
export function defaultCostTypeSlugForCategory(
  category: string | null | undefined,
  options: readonly CostTypeOption[] = DEFAULT_EXPENSE_COST_TYPES
): string {
  const mapped = category ? OCR_CATEGORY_TO_SLUG[category] : undefined;
  if (mapped && options.some((option) => option.slug === mapped)) {
    return mapped;
  }
  if (options.some((option) => option.slug === DEFAULT_COST_TYPE_SLUG)) {
    return DEFAULT_COST_TYPE_SLUG;
  }
  return options[0]?.slug ?? DEFAULT_COST_TYPE_SLUG;
}

export interface ResolvedReceiptAccount {
  accountNumber: number;
  taxCode: number;
}

/**
 * Resolves the GL account + tax code for a chosen cost type. Throws when the
 * slug is unknown so a submission never posts to an unintended account.
 */
export function resolveReceiptAccount(
  slug: string | null | undefined,
  options: readonly CostTypeOption[] = DEFAULT_EXPENSE_COST_TYPES
): ResolvedReceiptAccount {
  const costType = findCostType(slug, options);
  if (!costType) {
    throw new Error(`Unknown expense cost type "${slug}"`);
  }
  return {
    accountNumber: costType.accountNumber,
    taxCode: costType.taxCode ?? 0,
  };
}
