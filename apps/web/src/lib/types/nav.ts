/**
 * Compact shapes for the navigation "featured" slots. These deliberately avoid
 * carrying full Appwrite rows across the RSC boundary — only the few fields the
 * mega-menu cards render are included.
 */
export interface NavFeaturedItem {
  image: string | null;
  slug: string;
  startDate?: string | null;
  title: string;
}

export interface NavFeatured {
  event: NavFeaturedItem | null;
  news: NavFeaturedItem | null;
  project: NavFeaturedItem | null;
}

/**
 * Minimal, serializable account shape handed to the (client) navigation.
 * Deliberately not the raw Appwrite account row — only the fields the account
 * menu renders cross the RSC boundary, and never anything sensitive beyond the
 * email the user already sees on their own profile.
 *
 * `null` for anonymous visitors: `getLoggedInUser()` already applies
 * `isAuthenticatedAccount`, so a lazily-provisioned anonymous session never
 * produces one of these.
 */
export interface NavAccount {
  email: string | null;
  /** Precomputed on the server so the client never re-derives it per render. */
  initials: string;
  name: string;
  /** `expenses_module` flag state — gates the Financial Services entry. */
  showFinancialServices: boolean;
}
