import type { PuckMetadata, SlotComponent } from "@puckeditor/core";
import type { AccordionBlockProps } from "@repo/ui/components/puck/accordion";
import type { ButtonRowProps } from "@repo/ui/components/puck/button-row";
import type {
  CollectionItem,
  CollectionProps,
} from "@repo/ui/components/puck/collection/types";
import type { ColumnsProps } from "@repo/ui/components/puck/columns";
import type { CTAProps } from "@repo/ui/components/puck/cta";
import type { DividerProps } from "@repo/ui/components/puck/divider";
import type { FeatureGridProps } from "@repo/ui/components/puck/feature-grid";
import type { FilterBarProps } from "@repo/ui/components/puck/filter-bar";
import type { HeadingProps } from "@repo/ui/components/puck/heading";
import type { HeroProps } from "@repo/ui/components/puck/hero";
import type { ImageProps as PuckImageProps } from "@repo/ui/components/puck/image";
import type { JobsListProps } from "@repo/ui/components/puck/jobs-list";
import type { LogoGridProps } from "@repo/ui/components/puck/logo-grid";
import type { PageHeaderProps } from "@repo/ui/components/puck/page-header";
import type { ProductsGridProps } from "@repo/ui/components/puck/products-grid";
import type { RichTextProps } from "@repo/ui/components/puck/rich-text";
import type { SectionProps } from "@repo/ui/components/puck/section";
import type { SpacerProps } from "@repo/ui/components/puck/spacer";
import type { StatsGridProps } from "@repo/ui/components/puck/stats-grid";
import type { TableOfContentsProps } from "@repo/ui/components/puck/table-of-contents";
import type { TabsProps } from "@repo/ui/components/puck/tabs";
import type { TeamGridProps } from "@repo/ui/components/puck/team-grid";
import type { TextProps } from "@repo/ui/components/puck/text";
import type { TimelineProps } from "@repo/ui/components/puck/timeline";
import type { AboutProps } from "@repo/ui/components/sections/about";
import type {
  EventItem,
  EventsProps,
} from "@repo/ui/components/sections/events";
import type { JoinUsProps } from "@repo/ui/components/sections/join-us";
import type { NewsProps } from "@repo/ui/components/sections/news";
import type { JobDetailProps, ProductDetailProps } from "./detail";
import type {
  AlertCardProps,
  ChecklistCardProps,
  ContactCardsProps,
  DownloadListProps,
  NumberedStepsProps,
  TagListProps,
} from "./extras";

export interface DataSourceValue {
  filters?: { field: string; operator: string; value: unknown }[];
  limit?: number;
  locale?: string;
  offset?: number;
  sort?: { field: string; direction: "asc" | "desc" };
  table?: string;
}

/**
 * EditorMetadata is an alias for PuckMetadata (augmented in puck-augments.d.ts).
 * Kept for backwards compatibility in config files — prefer importing
 * `PuckMetadata` from `@puckeditor/core` directly in new code.
 */
export type EditorMetadata = PuckMetadata;

export type SectionPropsWithSlot = SectionProps & { content?: SlotComponent };

export type ColumnsPropsWithSlots = ColumnsProps & {
  "col-0"?: SlotComponent;
  "col-1"?: SlotComponent;
  "col-2"?: SlotComponent;
};

export type TabsPropsWithSlots = Omit<
  TabsProps,
  "tab0" | "tab1" | "tab2" | "tab3" | "ref"
> & {
  tab0?: SlotComponent;
  tab1?: SlotComponent;
  tab2?: SlotComponent;
  tab3?: SlotComponent;
};

export type HeroPropsWithSlot = HeroProps & {
  rightSlot?: SlotComponent;
  slidesSource?: DataSourceValue;
  statsSource?: DataSourceValue;
  slidesMode?: "manual" | "dynamic";
  statsMode?: "manual" | "dynamic";
  styling?: { padding?: string; className?: string };
};

export type EditorEventsProps = EventsProps & {
  dataMode?: "manual" | "dynamic";
  dataSource?: DataSourceValue;
  scope?: "page" | "all";
};

export type EditorNewsProps = NewsProps & {
  dataMode?: "manual" | "dynamic";
  dataSource?: DataSourceValue;
  scope?: "page" | "all";
};

export type EditorJobsListProps = JobsListProps & {
  dataMode?: "manual" | "dynamic";
  dataSource?: DataSourceValue;
  scope?: "page" | "all";
};

export type EditorProductsGridProps = ProductsGridProps & {
  dataMode?: "manual" | "dynamic";
  dataSource?: DataSourceValue;
  scope?: "page" | "all";
};

export type TimelinePropsWithSlot = TimelineProps & {
  dataMode?: "manual" | "dynamic";
  dataSource?: DataSourceValue;
};

export type EditorCollectionProps = CollectionProps & {
  dataMode?: "manual" | "dynamic";
  dataSource?: DataSourceValue;
  scope?: "page" | "all";
};

export type EditorJoinUsProps = Omit<JoinUsProps, "memberFeatures"> & {
  memberFeatures: { feature: string }[];
};

export interface PricingTableProps {
  plans?: {
    name: string;
    price: string;
    currency?: string;
    period?: string;
    /** Array items are objects with a `value` string — matches the Puck array field shape */
    features?: { value: string }[];
    highlighted?: boolean;
    ctaLabel?: string;
    ctaHref?: string;
  }[];
  subtitle?: string;
  title?: string;
  variant?: "cards" | "table";
}

export interface CountdownProps {
  completedMessage?: string;
  subtitle?: string;
  targetDate?: string;
  title?: string;
  variant?: "default" | "card" | "minimal";
}

export interface VideoEmbedProps {
  aspect?: "16:9" | "4:3" | "1:1";
  autoplay?: boolean;
  caption?: string;
  url?: string;
}

export interface BannerProps {
  dismissible?: boolean;
  link?: string;
  linkLabel?: string;
  message?: string;
  variant?: "info" | "warning" | "success" | "brand";
}

export interface TestimonialsProps {
  columns?: 2 | 3;
  items?: { quote: string; author: string; role?: string; avatar?: string }[];
  title?: string;
  variant?: "carousel" | "grid" | "single";
}

export interface DepartmentsGridProps {
  columns?: 2 | 3 | 4;
  dataMode?: "manual" | "dynamic";
  dataSource?: DataSourceValue;
  items?: CollectionItem[];
  scope?: "page" | "all";
  showFilters?: boolean;
  subtitle?: string;
  title?: string;
  variant?: "card" | "compact";
}

export interface EventsCalendarProps {
  dataMode?: "manual" | "dynamic";
  dataSource?: DataSourceValue;
  events?: EventItem[];
  showFilters?: boolean;
  title?: string;
  view?: "calendar" | "list" | "timeline";
}

export interface ArticleDetailProps {
  author?: string;
  content?: string;
  dataMode?: "manual" | "dynamic";
  dataSource?: DataSourceValue;
  date?: string;
  image?: string;
  layout?: "standard" | "wide";
  relatedItems?: { title: string; href: string; image?: string }[];
  showRelated?: boolean;
  title?: string;
}

export interface EventDetailProps {
  dataMode?: "manual" | "dynamic";
  dataSource?: DataSourceValue;
  date?: string;
  description?: string;
  endDate?: string;
  image?: string;
  location?: string;
  price?: string;
  showMap?: boolean;
  showRegistration?: boolean;
  ticketUrl?: string;
  title?: string;
}

export interface ContactFormProps {
  contactCards?: { title: string; value: string; icon: string }[];
  fields?: { name: string; label: string; type: string; required?: boolean }[];
  formAction?: string;
  showMap?: boolean;
  subtitle?: string;
  title?: string;
}

export interface MapEmbedProps {
  height?: string;
  lat?: number;
  lng?: number;
  title?: string;
  zoom?: number;
}

/** Binding config stored in Grid.dataSource when dataMode === "table" */
export interface GridDataBinding {
  limit?: number;
  sortDirection?: "asc" | "desc";
  sortField?: string;
  tableId: string;
  tableLabel: string;
}

/**
 * Preset layout names for the Grid component.
 * "cards"    — equal-width card columns (reference: campus overview sections)
 * "masonry"  — variable-height Pinterest-style grid (reference: news listing)
 * "featured" — one large hero cell + smaller supporting cells (reference: homepage hero grid)
 */
export type GridPreset = "cards" | "masonry" | "featured";

export interface GridProps {
  columns?: 2 | 3 | 4;
  /** "manual" — items populated by hand; "table" — bound to a database table */
  dataMode?: "manual" | "table";
  /** Set when dataMode === "table" */
  dataSource?: GridDataBinding | null;
  /** Manual items (used when dataMode === "manual") */
  items?: {
    title?: string;
    description?: string;
    image?: string;
    badge?: string;
    href?: string;
  }[];
  preset?: GridPreset;
  subtitle?: string;
  title?: string;
}

export interface Props {
  About: AboutProps;
  Accordion: AccordionBlockProps;
  AlertCard: AlertCardProps;
  ArticleDetail: ArticleDetailProps;
  Banner: BannerProps;
  ButtonRow: ButtonRowProps;
  ChecklistCard: ChecklistCardProps;
  Collection: EditorCollectionProps;
  Columns: ColumnsPropsWithSlots;
  // New content blocks
  ContactCards: ContactCardsProps;
  ContactForm: ContactFormProps;
  Countdown: CountdownProps;
  CTA: CTAProps;
  DepartmentsGrid: DepartmentsGridProps;
  Divider: DividerProps;
  DownloadList: DownloadListProps;
  EventDetail: EventDetailProps;
  Events: EditorEventsProps;
  EventsCalendar: EventsCalendarProps;
  FeatureGrid: FeatureGridProps;
  FilterBar: FilterBarProps;
  Grid: GridProps;
  Heading: HeadingProps;
  Hero: HeroPropsWithSlot;
  Image: PuckImageProps;
  // New detail blocks
  JobDetail: JobDetailProps;
  JobsList: EditorJobsListProps;
  JoinUs: EditorJoinUsProps;
  LogoGrid: LogoGridProps;
  MapEmbed: MapEmbedProps;
  News: EditorNewsProps;
  NumberedSteps: NumberedStepsProps;
  PageHeader: PageHeaderProps;
  PricingTable: PricingTableProps;
  ProductDetail: ProductDetailProps;
  ProductsGrid: EditorProductsGridProps;
  RichText: RichTextProps;
  Section: SectionPropsWithSlot;
  Spacer: SpacerProps;
  StatsGrid: StatsGridProps;
  TableOfContents: TableOfContentsProps;
  Tabs: TabsPropsWithSlots;
  TagList: TagListProps;
  TeamGrid: TeamGridProps;
  Testimonials: TestimonialsProps;
  Text: TextProps;
  Timeline: TimelinePropsWithSlot;
  VideoEmbed: VideoEmbedProps;
}
