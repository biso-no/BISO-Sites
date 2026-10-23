// Core domain types for the BISO page editor.
// All mutations go through operations.ts; this file is pure types only.

import type { BlockLayout } from "@/blocks/_primitives/layout-types";

export type BlockType =
  | "marquee"
  | "text"
  | "heading"
  | "quote"
  | "callout"
  | "twoCol"
  | "team"
  | "stats"
  | "highlights"
  | "facts"
  | "divider"
  | "timeline"
  | "image"
  | "gallery"
  | "video"
  | "events"
  | "jobs"
  | "news"
  | "buttons"
  | "ctaBand"
  | "faq"
  | "contact"
  | "signup"
  | "featureGrid"
  | "partners"
  | "linkTileGrid"
  | "tabs"
  | "departmentGrid"
  | "documents"
  | "featuredCards"
  | "campusSelector"
  | "stepGrid"
  | "scrollRow"
  | "productGrid"
  | "filterBar"
  | "profileHeader"
  | "multiStepForm";

// ── Shared v2 shapes ─────────────────────────────────────────────────────────

export interface LinkButton {
  href: string;
  label: string;
  style: "primary" | "secondary";
}

export type FrameRatio =
  | "21/9"
  | "16/9"
  | "3/2"
  | "4/3"
  | "1/1"
  | "4/5"
  | "3/4";

export interface MediaRef {
  alt?: string;
  fileId?: string;
  kind: "image" | "video";
  /** The uploaded file's type; an SVG or GIF skips the raster preview. */
  mime?: string;
  poster?: string;
  posterFileId?: string;
  /** The uploaded poster's type, as `mime`. */
  posterMime?: string;
  src: string;
}

// ── Per-block shapes ─────────────────────────────────────────────────────────

export interface MarqueeBlock {
  id: string;
  text: string;
  type: "marquee";
}

export interface TextBodyItem {
  text: string;
  type: "h" | "h3" | "p" | "li";
}

export interface TextBlock {
  body: TextBodyItem[];
  id: string;
  type: "text";
}

export interface HeadingBlock {
  eyebrow: string;
  id: string;
  intro: string;
  link?: { href: string; label: string };
  size: "small" | "medium" | "large";
  title: string;
  type: "heading";
}

export interface QuoteBlock {
  author: string;
  id: string;
  role: string;
  text: string;
  type: "quote";
}

export interface CalloutBlock {
  body: string;
  id: string;
  title: string;
  tone: "info" | "warn" | "tip";
  type: "callout";
}

export interface TwoColBlock {
  id: string;
  left: string;
  right: string;
  type: "twoCol";
  variant?: "equal" | "leftWide" | "rightWide";
}

export interface TeamMember {
  email?: string;
  name: string;
  phone?: string;
  photo?: { fileId?: string; mime?: string; src: string };
  role: string;
}

export interface TeamBlock {
  heading?: string;
  id: string;
  members: TeamMember[];
  /** Show email and phone links on each card. */
  showContact: boolean;
  /** `board` reads the page department's board from the live feed. */
  source: "manual" | "board";
  type: "team";
}

export interface StatItem {
  label: string;
  num: string;
}
export interface StatsBlock {
  id: string;
  items: StatItem[];
  type: "stats";
}

export interface HighlightsBlock {
  id: string;
  items: { text: string }[];
  type: "highlights";
}

export interface FactItem {
  href?: string;
  label: string;
  /** Named `text`, not `value`: the admin translator skips `value`. */
  text: string;
}
export interface FactsBlock {
  id: string;
  items: FactItem[];
  type: "facts";
}

export interface DividerBlock {
  id: string;
  spacing: "small" | "medium" | "large";
  type: "divider";
}

export interface TimelineItem {
  text: string;
  year: string;
}
export interface TimelineBlock {
  heading: string;
  id: string;
  items: TimelineItem[];
  type: "timeline";
}

export interface ImageBlock {
  alt: string;
  caption: string;
  /** Marks the image as decoration: it then renders with an empty alt. */
  decorative?: boolean;
  fileId?: string; // Appwrite "media" bucket file ID
  frame: "chevron" | "plain";
  id: string;
  lean: "left" | "right";
  /** The uploaded file's type; an SVG or GIF skips the raster preview. */
  mime?: string;
  ratio: FrameRatio;
  src?: string; // public view URL (set on upload) or external URL
  type: "image";
}

export interface GalleryImage {
  alt?: string;
  fileId?: string;
  /** The uploaded file's type; an SVG or GIF skips the raster preview. */
  mime?: string;
  src: string;
}
export interface GalleryBlock {
  id: string;
  images: GalleryImage[];
  layout: "collage" | "grid" | "row";
  type: "gallery";
}

export interface VideoBlock {
  caption: string;
  fileId?: string; // Appwrite "media" bucket file ID
  id: string;
  label?: string;
  poster?: string;
  posterFileId?: string;
  /** The uploaded poster's type; an SVG or GIF skips the raster preview. */
  posterMime?: string;
  ratio: "16/9" | "21/9";
  style: "featured" | "inline" | "loop";
  type: "video";
  url?: string; // external URL or public view URL
}

/** Shared by the three live feed blocks. */
interface LiveFeedBlock {
  heading: string;
  id: string;
  /** How many cards to show, and how many rows the feed request asks for. */
  limit: 3 | 6;
  /** Adds a "see all" link to the section's listing page. */
  seeAll: boolean;
  /** `auto` follows the page's department; anything else is a department id. */
  source: string;
}

export interface EventsBlock extends LiveFeedBlock {
  type: "events";
}

export interface JobsBlock extends LiveFeedBlock {
  type: "jobs";
}

export interface NewsBlock extends LiveFeedBlock {
  type: "news";
}

export interface ButtonsBlock {
  align: "start" | "center";
  id: string;
  items: LinkButton[];
  type: "buttons";
}

export interface CtaBandBlock {
  buttons: LinkButton[];
  eyebrow: string;
  id: string;
  text: string;
  title: string;
  type: "ctaBand";
}

export interface FaqItem {
  a: string;
  q: string;
}
export interface FaqBlock {
  heading: string;
  id: string;
  items: FaqItem[];
  type: "faq";
  variant?: "list" | "accordion-themed";
}

export interface ContactBlock {
  address: string;
  email: string;
  heading: string;
  hours: string;
  id: string;
  instagram: string;
  phone: string;
  type: "contact";
}

export interface SignupBlock {
  heading: string;
  id: string;
  placeholder: string;
  recipientEmail?: string;
  submitMode?: "email" | "database";
  topic?: string;
  type: "signup";
}

// ── New block shapes (Phase C) ────────────────────────────────────────────────

export interface FeatureGridItem {
  body: string;
  href?: string;
  icon: string;
  title: string;
}
export interface FeatureGridBlock {
  columns: 2 | 3 | 4;
  heading?: string;
  id: string;
  intro?: string;
  items: FeatureGridItem[];
  type: "featureGrid";
  variant?: "bordered" | "cards" | "minimal";
}

export interface PartnerItem {
  href?: string;
  logo?: { fileId?: string; mime?: string; src: string };
  /** Legacy flat logo URL: older documents and the auto feed carry this. */
  logoSrc?: string;
  name: string;
}
export interface PartnersBlock {
  heading?: string;
  id: string;
  items?: PartnerItem[];
  source: "auto" | "manual";
  type: "partners";
}

export interface LinkTileItem {
  description?: string;
  href: string;
  icon: string;
  title: string;
}
export interface LinkTileGridBlock {
  heading?: string;
  id: string;
  items: LinkTileItem[];
  type: "linkTileGrid";
}

export interface TabItem {
  body: string;
  label: string;
}
export interface TabsBlock {
  id: string;
  tabs: TabItem[];
  type: "tabs";
  variant?: "pills" | "underline" | "cards";
}

export interface DepartmentGridBlock {
  /** A `UnitCategory`; empty or absent shows every category. */
  category?: string;
  heading?: string;
  id: string;
  limit: number;
  /** `campus` narrows to the page's own campus. */
  scope: "campus" | "all";
  type: "departmentGrid";
}

export interface DocumentItem {
  fileId: string;
  size?: string;
  title: string;
}
export interface DocumentsBlock {
  heading?: string;
  id: string;
  items: DocumentItem[];
  type: "documents";
}

export interface FeaturedCardItem {
  body: string;
  eyebrow?: string;
  href?: string;
  stripeAccent: string;
  title: string;
}
export interface FeaturedCardsBlock {
  heading?: string;
  id: string;
  items: FeaturedCardItem[];
  type: "featuredCards";
}

export interface CampusSelectorBlock {
  heading?: string;
  id: string;
  mode: "switcher" | "cards";
  type: "campusSelector";
}

export interface StepGridItem {
  body: string;
  number: string;
  title: string;
}
export interface StepGridBlock {
  heading?: string;
  id: string;
  items: StepGridItem[];
  type: "stepGrid";
}

export interface ScrollRowItem {
  body: string;
  href?: string;
  icon?: string;
  title: string;
}
export interface ScrollRowBlock {
  heading?: string;
  id: string;
  items: ScrollRowItem[];
  type: "scrollRow";
}

export interface ProductGridBlock {
  heading?: string;
  id: string;
  limit: 4 | 8;
  /** `auto` follows the page's department; otherwise a department id. */
  source: string;
  type: "productGrid";
}

export interface FilterBarBlock {
  id: string;
  target: "news" | "jobs" | "units";
  type: "filterBar";
}

export interface ProfileHeaderBlock {
  heading?: string;
  id: string;
  showAvatar: boolean;
  showStats: boolean;
  type: "profileHeader";
}

export type FormFieldType =
  | "checkbox"
  | "email"
  | "hidden"
  | "radio"
  | "select"
  | "text"
  | "textarea";

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormField {
  fieldType: FormFieldType;
  label: string;
  name: string;
  options?: FormFieldOption[];
  placeholder?: string;
  required?: boolean;
}

export interface FormStep {
  fields: FormField[];
  title: string;
}

export interface MultiStepFormBlock {
  accessTeamId?: string;
  adminLabel?: string;
  heading?: string;
  id: string;
  recipientEmail?: string;
  steps: FormStep[];
  submitMode?: "email" | "database";
  submitTarget: { collection: string; topic?: string };
  type: "multiStepForm";
}

export type Block = (
  | MarqueeBlock
  | TextBlock
  | HeadingBlock
  | QuoteBlock
  | CalloutBlock
  | TwoColBlock
  | TeamBlock
  | StatsBlock
  | HighlightsBlock
  | FactsBlock
  | DividerBlock
  | TimelineBlock
  | ImageBlock
  | GalleryBlock
  | VideoBlock
  | EventsBlock
  | JobsBlock
  | NewsBlock
  | ButtonsBlock
  | CtaBandBlock
  | FaqBlock
  | ContactBlock
  | SignupBlock
  | FeatureGridBlock
  | PartnersBlock
  | LinkTileGridBlock
  | TabsBlock
  | DepartmentGridBlock
  | DocumentsBlock
  | FeaturedCardsBlock
  | CampusSelectorBlock
  | StepGridBlock
  | ScrollRowBlock
  | ProductGridBlock
  | FilterBarBlock
  | ProfileHeaderBlock
  | MultiStepFormBlock
) & { hideOnPhone?: boolean; layout?: BlockLayout };

// ── Page document ────────────────────────────────────────────────────────────

export interface PageMeta {
  accentColor: string;
  /**
   * Campus id the page belongs to; "" for a national page. Absent on
   * documents saved before campus lived on the document.
   */
  campus?: string;
  department: string;
  description?: string;
  slug: string;
  status: "draft" | "published";
  title: string;
}

export const PAGE_DOC_VERSION = 2;

export type SectionColumns = "1" | "1-1" | "2-1" | "1-2" | "1-1-1" | "1-1-1-1";
export type SectionBackground = "white" | "tinted" | "dark" | "photo";
export type SectionSpacing = "tight" | "normal" | "roomy";
export type SectionAlign = "top" | "middle" | "bottom";
export type SectionTablet = "row" | "stack";

/** The full-bleed image behind a Photo section. */
export interface SectionBackgroundImage {
  /** Empty or absent marks the photo decorative. */
  alt?: string;
  /** Appwrite "media" bucket file ID, when uploaded. */
  fileId?: string;
  /** The uploaded file's type; an SVG or GIF skips the raster preview. */
  mime?: string;
  src: string;
}

export interface SectionLayout {
  align: SectionAlign;
  background: SectionBackground;
  /** Shown only while `background` is "photo"; kept when switching away. */
  backgroundImage?: SectionBackgroundImage;
  columns: SectionColumns;
  hideOnPhone: boolean;
  phoneReverse: boolean;
  spacing: SectionSpacing;
  tablet: SectionTablet;
}

export interface Column {
  blocks: Block[];
  id: string;
}

export interface Section {
  anchor?: string;
  columns: Column[];
  id: string;
  layout: SectionLayout;
}

export interface HeaderCrumb {
  /** Absent on the current page, which is not a link. */
  href?: string;
  label: string;
}

export type HeaderVariant = "split" | "full" | "plain";

/**
 * The navy band at the top of the page: breadcrumb, eyebrow, the page's only
 * `<h1>`, lede, buttons and optional media. A header video always plays as a
 * muted loop (its poster stands in under reduced motion).
 */
export interface PageHeader {
  buttons: LinkButton[];
  crumbs: HeaderCrumb[];
  eyebrow: string;
  lede: string;
  /** Shown beside the text (split) or behind it (full); plain shows none. */
  media?: MediaRef;
  title: string;
  variant: HeaderVariant;
}

export interface PageDoc {
  /** Absent on pages without a header; the first section then clears the nav. */
  header?: PageHeader;
  meta: PageMeta;
  sections: Section[];
  version: 2;
}

/** Where to insert a block; no `beforeBlockId` means the end of the column. */
export interface InsertTarget {
  beforeBlockId?: string;
  columnId: string;
}

// ── Editor UI state (not persisted) ─────────────────────────────────────────

export type EditorMode = "edit" | "preview";
export type EditorViewport = "desk" | "tab" | "mob";
export type SavingState = "idle" | "pending" | "saved" | "error";

// ── Host-provided data types ─────────────────────────────────────────────────

export interface EditorDepartment {
  /** Campus the department belongs to; null for rows without one. */
  campusId: string | null;
  id: string;
  name: string;
}

export interface EditorCampus {
  id: string;
  name: string;
}

export type EditorLocale = "no" | "en";

export interface EditorLocaleOption {
  hasDraft: boolean;
  label: string;
  locale: EditorLocale;
}
