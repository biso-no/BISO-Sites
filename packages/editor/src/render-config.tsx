import type { Config } from "@puckeditor/core";
import {
  ButtonRowRender,
  DividerRender,
  HeadingRender,
  ImageRender,
  TextRender,
  VideoEmbedRender,
} from "./config/basics.render";
import {
  AccordionRender,
  RichTextRender,
  TableOfContentsRender,
  TestimonialsRender,
  TimelineRender,
} from "./config/content.render";
import {
  ArticleDetailRender,
  CollectionRender,
  DepartmentsGridRender,
  EventDetailRender,
  EventsCalendarRender,
  EventsRender,
  FilterBarRender,
  JobsListRender,
  NewsRender,
  ProductsGridRender,
} from "./config/data-display/render";
import { JobDetailRender, ProductDetailRender } from "./config/detail.render";
import {
  AlertCardRender,
  ChecklistCardRender,
  ContactCardsRender,
  DownloadListRender,
  NumberedStepsRender,
  TagListRender,
} from "./config/extras.render";
import {
  FeatureGridRender,
  GridRender,
  LogoGridRender,
  StatsGridRender,
  TeamGridRender,
} from "./config/grids.render";
import {
  BannerRender,
  HeroRender,
  PageHeaderRender,
} from "./config/heroes.render";
import { ContactFormRender, MapEmbedRender } from "./config/interactive.render";
import {
  ColumnsRender,
  SectionRender,
  SpacerRender,
  TabsRender,
} from "./config/layout.render";
import {
  AboutRender,
  CTARender,
  CountdownRender,
  JoinUsRender,
  PricingTableRender,
} from "./config/marketing.render";
import type { Props } from "./config/types";

// Puck injects a `puck` prop ({ renderDropZone, dragRef, isEditing, metadata })
// into every render call. These values are non-serializable functions/refs and
// cannot cross the server→client boundary when the UI component is "use client".
// This wrapper strips the `puck` prop before delegating to the render function.
function sp<T>(fn: (props: T) => React.ReactNode) {
  return ({ puck: _puck, ...rest }: T & { puck?: unknown }) => fn(rest as T);
}

export const renderConfig: Config<Props> = {
  root: { render: ({ children }) => <>{children}</> },
  components: {
    // Basics
    Heading: { render: sp(HeadingRender) as any },
    Text: { render: sp(TextRender) as any },
    Image: { render: sp(ImageRender) as any },
    ButtonRow: { render: sp(ButtonRowRender) as any },
    Divider: { render: sp(DividerRender) as any },
    VideoEmbed: { render: sp(VideoEmbedRender) as any },

    // Layout
    Section: { render: sp(SectionRender) as any },
    Columns: { render: sp(ColumnsRender) as any },
    Spacer: { render: sp(SpacerRender) as any },
    Tabs: { render: sp(TabsRender) as any },

    // Heroes & Headers
    Hero: { render: sp(HeroRender) as any },
    PageHeader: { render: sp(PageHeaderRender) as any },
    Banner: { render: sp(BannerRender) as any },

    // Grids & Lists
    Grid: { render: sp(GridRender) as any },
    FeatureGrid: { render: sp(FeatureGridRender) as any },
    StatsGrid: { render: sp(StatsGridRender) as any },
    TeamGrid: { render: sp(TeamGridRender) as any },
    LogoGrid: { render: sp(LogoGridRender) as any },
    PricingTable: { render: sp(PricingTableRender) as any },

    // Content
    Accordion: { render: sp(AccordionRender) as any },
    Timeline: { render: sp(TimelineRender) as any },
    RichText: { render: sp(RichTextRender) as any },
    TableOfContents: { render: sp(TableOfContentsRender) as any },
    Testimonials: { render: sp(TestimonialsRender) as any },

    // Marketing & CTA
    CTA: { render: sp(CTARender) as any },
    About: { render: sp(AboutRender) as any },
    JoinUs: { render: sp(JoinUsRender) as any },
    Countdown: { render: sp(CountdownRender) as any },

    // Interactive
    ContactForm: { render: sp(ContactFormRender) as any },
    MapEmbed: { render: sp(MapEmbedRender) as any },

    // Data Display
    News: { render: sp(NewsRender) as any },
    Events: { render: sp(EventsRender) as any },
    EventsCalendar: { render: sp(EventsCalendarRender) as any },
    JobsList: { render: sp(JobsListRender) as any },
    ProductsGrid: { render: sp(ProductsGridRender) as any },
    DepartmentsGrid: { render: sp(DepartmentsGridRender) as any },
    FilterBar: { render: sp(FilterBarRender) as any },
    Collection: { render: sp(CollectionRender) as any },

    // Detail Pages
    ArticleDetail: { render: sp(ArticleDetailRender) as any },
    EventDetail: { render: sp(EventDetailRender) as any },
    JobDetail: { render: sp(JobDetailRender) as any },
    ProductDetail: { render: sp(ProductDetailRender) as any },

    // Content Blocks (Extras)
    ContactCards: { render: sp(ContactCardsRender) as any },
    DownloadList: { render: sp(DownloadListRender) as any },
    NumberedSteps: { render: sp(NumberedStepsRender) as any },
    TagList: { render: sp(TagListRender) as any },
    AlertCard: { render: sp(AlertCardRender) as any },
    ChecklistCard: { render: sp(ChecklistCardRender) as any },
  },
};
