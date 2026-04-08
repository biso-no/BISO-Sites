export type MembershipDuration = "semester" | "year" | "three-year";

export const SHOP_CATEGORIES = [
  "All",
  "Merch",
  "Trips",
  "Lockers",
  "Membership",
] as const;

export type ShopCategory = (typeof SHOP_CATEGORIES)[number];

export function getInitialShopCategory(
  rawCategory?: string | null
): ShopCategory {
  return SHOP_CATEGORIES.find((category) => category === rawCategory) ?? "All";
}

export function getMembershipShopHref(plan?: MembershipDuration): string {
  const searchParams = new URLSearchParams({ category: "Membership" });

  if (plan) {
    searchParams.set("plan", plan);
  }

  return `/shop?${searchParams.toString()}`;
}

export function shouldShowEstimatedSavings(
  value?: number | null
): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
