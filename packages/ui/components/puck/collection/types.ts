/** Layout patterns - named by visual structure, not content */
export type CollectionLayout =
  | "card-grid"      // Image cards (events, news)
  | "compact-card"   // Small info cards (career days)
  | "icon-feature"   // Icon + text (benefits)
  | "logo-grid"      // Logos only (partners)
  | "team-grid"      // Person cards (team)
  | "stacked-list";  // Vertical list (FAQ)

/** Base item shape - all layouts derive from this */
export type CollectionItem = {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  image?: string;
  icon?: string;
  href?: string;
  date?: string;
  badge?: string;
  metadata?: Record<string, unknown>;
};

/** Props for the Collection block */
export type CollectionProps = {
  // Header
  title?: string;
  subtitle?: string;
  
  // Layout
  layout: CollectionLayout;
  columns?: 2 | 3 | 4 | 5 | 6;
  
  // Items (resolved from manual or dynamic)
  items: CollectionItem[];
  
  // Display options
  showFilters?: boolean;
  showSearch?: boolean;
  emptyIcon?: string;
  emptyMessage?: string;
  emptyDescription?: string;
  
  // CTA
  ctaLabel?: string;
  ctaHref?: string;
  
  // Layout-specific options
  grayscale?: boolean;        // logo-grid
  cardVariant?: "default" | "bordered" | "elevated";
  imageAspect?: "square" | "video" | "portrait";
};

/** Props for individual layout renderers */
export type LayoutRendererProps = {
  items: CollectionItem[];
  columns: number;
  cardVariant?: CollectionProps["cardVariant"];
  imageAspect?: CollectionProps["imageAspect"];
  grayscale?: boolean;
};

/** Default column counts per layout */
export const DEFAULT_COLUMNS: Record<CollectionLayout, number> = {
  "card-grid": 3,
  "compact-card": 4,
  "icon-feature": 3,
  "logo-grid": 4,
  "team-grid": 4,
  "stacked-list": 1,
};

/** Layout labels for the editor */
export const LAYOUT_OPTIONS: { label: string; value: CollectionLayout }[] = [
  { label: "Card Grid", value: "card-grid" },
  { label: "Compact Cards", value: "compact-card" },
  { label: "Icon Features", value: "icon-feature" },
  { label: "Logo Grid", value: "logo-grid" },
  { label: "Team Grid", value: "team-grid" },
  { label: "Stacked List", value: "stacked-list" },
];
