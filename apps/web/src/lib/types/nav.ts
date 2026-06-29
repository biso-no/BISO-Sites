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
