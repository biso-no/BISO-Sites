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
import type { AboutProps } from "@repo/ui/components/sections/about";
import type { EventsProps } from "@repo/ui/components/sections/events";
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

export type EditorMetadata = {
  locale?: string;
  page?: { campusId?: string | null; departmentId?: string | null };
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
};
