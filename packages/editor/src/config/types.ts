import type { SlotComponent } from "@puckeditor/core";
import type { AccordionBlockProps } from "@repo/ui/components/puck/accordion";
import type { ButtonRowProps } from "@repo/ui/components/puck/button-row";
import type { CollectionProps } from "@repo/ui/components/puck/collection/types";
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
import type { CollectionItem } from "@repo/ui/components/puck/collection/types";
import type { AboutProps } from "@repo/ui/components/sections/about";
import type { EventItem, EventsProps } from "@repo/ui/components/sections/events";
import type { JoinUsProps } from "@repo/ui/components/sections/join-us";
import type { NewsProps } from "@repo/ui/components/sections/news";

export type DataSourceValue = {
  table?: string;
  filters?: { field: string; operator: string; value: unknown }[];
  sort?: { field: string; direction: "asc" | "desc" };
  limit?: number;
  offset?: number;
  locale?: string;
};

/**
 * EditorMetadata is the shape of the `metadata` prop passed to <Puck>.
 * It mirrors EditorContext (from editor-context.ts) plus locale.
 * resolveData, resolveFields, and resolvePermissions receive this via params.metadata.
 */
export type EditorMetadata = {
  locale?: string;
  mode?: "direct";
  contentType?: string;
  page?: {
    id?: string;
    status?: string;
    scope?: string;
    campusId?: string | null;
    departmentId?: string | null;
  };
  user?: {
    isGlobalAdmin: boolean;
    isCampusAdmin: boolean;
    campusNames: string[];
    departmentNames: string[];
    managedCampuses: string[];
  };
  constraints?: {
    slugLocked: boolean;
  };
};

export type SectionPropsWithSlot = SectionProps & { content?: SlotComponent };

export type ColumnsPropsWithSlots = ColumnsProps & {
  "col-0"?: SlotComponent;
  "col-1"?: SlotComponent;
  "col-2"?: SlotComponent;
};

export type TabsPropsWithSlots = Omit<TabsProps, "tab0" | "tab1" | "tab2" | "tab3" | "ref"> & {
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

export type PricingTableProps = {
  plans?: {
    name: string;
    price: string;
    currency?: string;
    period?: string;
    features?: string[];
    highlighted?: boolean;
    ctaLabel?: string;
    ctaHref?: string;
  }[];
  variant?: "cards" | "table";
  title?: string;
  subtitle?: string;
};

export type CountdownProps = {
  targetDate?: string;
  title?: string;
  subtitle?: string;
  completedMessage?: string;
  variant?: "default" | "card" | "minimal";
};

export type VideoEmbedProps = {
  url?: string;
  aspect?: "16:9" | "4:3" | "1:1";
  caption?: string;
  autoplay?: boolean;
};

export type BannerProps = {
  message?: string;
  variant?: "info" | "warning" | "success" | "brand";
  dismissible?: boolean;
  link?: string;
  linkLabel?: string;
};

export type TestimonialsProps = {
  items?: { quote: string; author: string; role?: string; avatar?: string }[];
  variant?: "carousel" | "grid" | "single";
  columns?: 2 | 3;
  title?: string;
};

export type DepartmentsGridProps = {
  dataMode?: "manual" | "dynamic";
  dataSource?: DataSourceValue;
  scope?: "page" | "all";
  showFilters?: boolean;
  columns?: 2 | 3 | 4;
  variant?: "card" | "compact";
  title?: string;
  subtitle?: string;
  items?: CollectionItem[];
};

export type EventsCalendarProps = {
  dataMode?: "manual" | "dynamic";
  dataSource?: DataSourceValue;
  view?: "calendar" | "list" | "timeline";
  showFilters?: boolean;
  title?: string;
  events?: EventItem[];
};

export type ArticleDetailProps = {
  dataMode?: "manual" | "dynamic";
  dataSource?: DataSourceValue;
  showRelated?: boolean;
  layout?: "standard" | "wide";
  title?: string;
  author?: string;
  date?: string;
  image?: string;
  content?: string;
  relatedItems?: { title: string; href: string; image?: string }[];
};

export type EventDetailProps = {
  dataMode?: "manual" | "dynamic";
  dataSource?: DataSourceValue;
  showRegistration?: boolean;
  showMap?: boolean;
  title?: string;
  date?: string;
  endDate?: string;
  location?: string;
  image?: string;
  description?: string;
  ticketUrl?: string;
  price?: string;
};

export type ContactFormProps = {
  fields?: { name: string; label: string; type: string; required?: boolean }[];
  contactCards?: { title: string; value: string; icon: string }[];
  showMap?: boolean;
  formAction?: string;
  title?: string;
  subtitle?: string;
};

export type MapEmbedProps = {
  lat?: number;
  lng?: number;
  zoom?: number;
  height?: string;
  title?: string;
};

export type Props = {
  Heading: HeadingProps;
  Text: TextProps;
  Image: PuckImageProps;
  ButtonRow: ButtonRowProps;
  Divider: DividerProps;
  Hero: HeroPropsWithSlot;
  About: AboutProps;
  JoinUs: EditorJoinUsProps;
  News: EditorNewsProps;
  Events: EditorEventsProps;
  ProductsGrid: EditorProductsGridProps;
  Section: SectionPropsWithSlot;
  FeatureGrid: FeatureGridProps;
  CTA: CTAProps;
  Columns: ColumnsPropsWithSlots;
  Accordion: AccordionBlockProps;
  Spacer: SpacerProps;
  Tabs: TabsPropsWithSlots;
  StatsGrid: StatsGridProps;
  TeamGrid: TeamGridProps;
  Timeline: TimelinePropsWithSlot;
  LogoGrid: LogoGridProps;
  FilterBar: FilterBarProps;
  JobsList: EditorJobsListProps;
  Collection: EditorCollectionProps;
  RichText: RichTextProps;
  PageHeader: PageHeaderProps;
  TableOfContents: TableOfContentsProps;
  PricingTable: PricingTableProps;
  Countdown: CountdownProps;
  VideoEmbed: VideoEmbedProps;
  Banner: BannerProps;
  Testimonials: TestimonialsProps;
  DepartmentsGrid: DepartmentsGridProps;
  EventsCalendar: EventsCalendarProps;
  ArticleDetail: ArticleDetailProps;
  EventDetail: EventDetailProps;
  ContactForm: ContactFormProps;
  MapEmbed: MapEmbedProps;
};
