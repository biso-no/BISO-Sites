"use client";
import { type Config, registerOverlayPortal, type Slot } from "@measured/puck";
import {
  AccordionBlock,
  type AccordionBlockProps,
} from "@repo/ui/components/puck/accordion";
import { Collection } from "@repo/ui/components/puck/collection/collection";
import type { CollectionProps } from "@repo/ui/components/puck/collection/types";
import { LAYOUT_OPTIONS } from "@repo/ui/components/puck/collection/types";
import { Columns, type ColumnsProps } from "@repo/ui/components/puck/columns";
import { CTA, type CTAProps } from "@repo/ui/components/puck/cta";
import {
  FeatureGrid,
  type FeatureGridProps,
} from "@repo/ui/components/puck/feature-grid";
import {
  FilterBar,
  type FilterBarProps,
} from "@repo/ui/components/puck/filter-bar";
import { FilteredEvents } from "@repo/ui/components/puck/filtered-events";
import { FilteredNews } from "@repo/ui/components/puck/filtered-news";
import { Hero, type HeroProps } from "@repo/ui/components/puck/hero";
import {
  JobsList,
  type JobsListProps,
} from "@repo/ui/components/puck/jobs-list";
import {
  LogoGrid,
  type LogoGridProps,
} from "@repo/ui/components/puck/logo-grid";
import {
  PageHeader,
  type PageHeaderProps,
} from "@repo/ui/components/puck/page-header";
import {
  RichText,
  type RichTextProps,
} from "@repo/ui/components/puck/rich-text";
import { Section, type SectionProps } from "@repo/ui/components/puck/section";
import { Spacer, type SpacerProps } from "@repo/ui/components/puck/spacer";
import {
  StatsGrid,
  type StatsGridProps,
} from "@repo/ui/components/puck/stats-grid";
import {
  TableOfContents,
  type TableOfContentsProps,
} from "@repo/ui/components/puck/table-of-contents";
import { Tabs, type TabsProps } from "@repo/ui/components/puck/tabs";
import {
  TeamGrid,
  type TeamGridProps,
} from "@repo/ui/components/puck/team-grid";
import { About, type AboutProps } from "@repo/ui/components/sections/about";
import type { EventsProps } from "@repo/ui/components/sections/events";
import { JoinUs, type JoinUsProps } from "@repo/ui/components/sections/join-us";
import type { NewsProps } from "@repo/ui/components/sections/news";
import { useEffect, useRef } from "react";
import { getDynamicContent } from "./get-dynamic-content";

type EditorJoinUsProps = Omit<JoinUsProps, "memberFeatures"> & {
  memberFeatures: { feature: string }[];
};

type EditorCollectionProps = CollectionProps & {
  dataMode?: "manual" | "dynamic";
  dataSource?: {
    table?: string;
    filters?: { field: string; operator: string; value: unknown }[];
    sort?: { field: string; direction: "asc" | "desc" };
    limit?: number;
  };
};

type SectionPropsWithSlot = SectionProps & { content?: Slot };
type ColumnsPropsWithSlots = ColumnsProps & {
  "col-0"?: Slot;
  "col-1"?: Slot;
  "col-2"?: Slot;
};

type TabsPropsWithSlots = TabsProps & {
  tab0?: Slot;
  tab1?: Slot;
  tab2?: Slot;
  tab3?: Slot;
};

type HeroPropsWithSlot = HeroProps & {
  rightSlot?: Slot;
  slidesSource?: any;
  statsSource?: any;
  slidesMode?: "manual" | "dynamic";
  statsMode?: "manual" | "dynamic";
  styling?: { padding?: string; className?: string };
};

type DataSourceValue = {
  table?: string;
  filters?: { field: string; operator: string; value: unknown }[];
  sort?: { field: string; direction: "asc" | "desc" };
  limit?: number;
};

type EditorEventsProps = EventsProps & {
  dataMode?: "manual" | "dynamic";
  dataSource?: DataSourceValue;
  limit?: number;
};

type EditorNewsProps = NewsProps & {
  dataMode?: "manual" | "dynamic";
  dataSource?: DataSourceValue;
  limit?: number;
};

type Props = {
  Hero: HeroPropsWithSlot;
  About: AboutProps;
  JoinUs: EditorJoinUsProps;
  News: EditorNewsProps;
  Events: EditorEventsProps;
  Section: SectionPropsWithSlot;
  FeatureGrid: FeatureGridProps;
  CTA: CTAProps;
  Columns: ColumnsPropsWithSlots;
  Accordion: AccordionBlockProps;
  Spacer: SpacerProps;
  Tabs: TabsPropsWithSlots;
  StatsGrid: StatsGridProps;
  TeamGrid: TeamGridProps;
  LogoGrid: LogoGridProps;
  FilterBar: FilterBarProps;
  JobsList: JobsListProps;
  Collection: EditorCollectionProps;
  RichText: RichTextProps;
  PageHeader: PageHeaderProps;
  TableOfContents: TableOfContentsProps;
};

export const config: Config<Props> = {
  components: {
    Accordion: {
      fields: {
        type: {
          type: "radio",
          options: [
            { label: "Single Open", value: "single" },
            { label: "Allow Multiple", value: "multiple" },
          ],
        },
        items: {
          type: "array",
          getItemSummary: (item) => item.title || "Item",
          arrayFields: {
            title: { type: "text" },
            content: { type: "textarea" },
          },
        },
      },
      render: (props) => <AccordionBlock {...props} />,
      defaultProps: {
        type: "single",
        items: [
          { title: "Question 1", content: "Answer to question 1." },
          { title: "Question 2", content: "Answer to question 2." },
        ],
      },
    },
    Spacer: {
      fields: {
        size: {
          type: "select",
          options: [
            { label: "Extra Small (16px)", value: "xs" },
            { label: "Small (32px)", value: "sm" },
            { label: "Medium (64px)", value: "md" },
            { label: "Large (96px)", value: "lg" },
            { label: "Extra Large (128px)", value: "xl" },
            { label: "Huge (192px)", value: "2xl" },
          ],
        },
      },
      render: (props) => <Spacer {...props} />,
      defaultProps: {
        size: "md",
      },
    },
    Tabs: {
      fields: {
        tabs: {
          type: "array",
          getItemSummary: (item) => item.label || "Tab",
          arrayFields: {
            label: { type: "text" },
            value: { type: "text" },
          },
        },
        tab0: { type: "slot" },
        tab1: { type: "slot" },
        tab2: { type: "slot" },
        tab3: { type: "slot" },
      },
      render: ({
        tab0: Tab0,
        tab1: Tab1,
        tab2: Tab2,
        tab3: Tab3,
        tabs,
        ...props
      }) => {
        const ref = useRef<HTMLDivElement>(null);
        useEffect(() => registerOverlayPortal(ref.current), []);
        return (
          <Tabs
            ref={ref as any}
            {...props}
            tab0={Tab0 && <Tab0 />}
            tab1={Tab1 && <Tab1 />}
            tab2={Tab2 && <Tab2 />}
            tab3={Tab3 && <Tab3 />}
            tabs={tabs}
          />
        );
      },
      defaultProps: {
        tabs: [
          { label: "Overview", value: "overview" },
          { label: "Details", value: "details" },
        ],
      },
    },
    Columns: {
      fields: {
        layout: {
          type: "select",
          options: [
            { label: "Two Columns (1:1)", value: "1:1" },
            { label: "Two Columns (2:1)", value: "2:1" },
            { label: "Two Columns (1:2)", value: "1:2" },
            { label: "Three Columns (1:1:1)", value: "1:1:1" },
          ],
        },
        gap: {
          type: "select",
          options: [
            { label: "Small", value: "sm" },
            { label: "Medium", value: "md" },
            { label: "Large", value: "lg" },
          ],
        },
        verticalAlign: {
          type: "select",
          options: [
            { label: "Top", value: "top" },
            { label: "Center", value: "center" },
            { label: "Bottom", value: "bottom" },
          ],
        },
        "col-0": { type: "slot" },
        "col-1": { type: "slot" },
        "col-2": { type: "slot" },
      },
      render: ({
        "col-0": Col0,
        "col-1": Col1,
        "col-2": Col2,
        layout = "1:1",
        ...props
      }) => {
        const colCount = layout.split(":").length;
        return (
          <Columns layout={layout} {...props}>
            {Col0 && <Col0 />}
            {Col1 && <Col1 />}
            {colCount > 2 && Col2 && <Col2 />}
          </Columns>
        );
      },
      defaultProps: {
        layout: "1:1",
        gap: "md",
        verticalAlign: "top",
      },
    },
    FeatureGrid: {
      fields: {
        title: { type: "text", contentEditable: true } as any,
        subtitle: { type: "textarea", contentEditable: true },
        columns: {
          type: "select",
          options: [
            { label: "2", value: 2 },
            { label: "3", value: 3 },
            { label: "4", value: 4 },
          ],
        },
        variant: {
          type: "select",
          options: [
            { label: "Card", value: "card" },
            { label: "Icon", value: "icon" },
            { label: "Simple", value: "simple" },
            { label: "Checklist", value: "checklist" },
            { label: "Project", value: "project" },
            { label: "Process", value: "process" },
          ],
        },
        align: {
          type: "radio",
          options: [
            { label: "Center", value: "center" },
            { label: "Left", value: "left" },
          ],
        },
        items: {
          type: "array",
          getItemSummary: (item) => item.title || "Feature",
          arrayFields: {
            title: { type: "text" },
            description: { type: "textarea" },
            badge: { type: "text" },
            icon: {
              type: "select",
              options: [
                { label: "Sparkles", value: "Sparkles" },
                { label: "Gift", value: "Gift" },
                { label: "Crown", value: "Crown" },
                { label: "Zap", value: "Zap" },
                { label: "Check", value: "Check" },
                { label: "Calendar", value: "Calendar" },
                { label: "Briefcase", value: "Briefcase" },
                { label: "Rocket", value: "Rocket" },
                { label: "Trophy", value: "Trophy" },
                { label: "Megaphone", value: "Megaphone" },
                { label: "Link", value: "Link" },
                { label: "Users", value: "Users" },
                { label: "Globe", value: "Globe" },
                { label: "BookOpen", value: "BookOpen" },
                { label: "Building", value: "Building" },
                { label: "Heart", value: "Heart" },
                { label: "MapPin", value: "MapPin" },
                { label: "CheckCircle", value: "CheckCircle" },
                { label: "ArrowRight", value: "ArrowRight" },
              ],
            },
            href: { type: "link" } as any,
          },
        },
      },
      render: (props) => <FeatureGrid {...props} />,
      defaultProps: {
        columns: 3,
        variant: "card",
        align: "center",
        items: [
          {
            title: "Feature 1",
            description: "Description 1",
            icon: "Sparkles",
          },
          { title: "Feature 2", description: "Description 2", icon: "Zap" },
          { title: "Feature 3", description: "Description 3", icon: "Crown" },
        ],
      },
    },
    StatsGrid: {
      fields: {
        columns: {
          type: "select",
          options: [
            { label: "2", value: 2 },
            { label: "3", value: 3 },
            { label: "4", value: 4 },
          ],
        },
        variant: {
          type: "select",
          options: [
            { label: "Simple", value: "simple" },
            { label: "Card", value: "card" },
            { label: "Floating", value: "floating" },
          ],
        },
        align: {
          type: "radio",
          options: [
            { label: "Center", value: "center" },
            { label: "Left", value: "left" },
          ],
        },
        items: {
          type: "array",
          getItemSummary: (item) => item.label || "Stat",
          arrayFields: {
            value: { type: "text" },
            label: { type: "text" },
            description: { type: "text" },
            icon: {
              type: "select",
              options: [
                { label: "None", value: "" },
                { label: "Users", value: "Users" },
                { label: "Calendar", value: "Calendar" },
                { label: "Trophy", value: "Trophy" },
                { label: "Briefcase", value: "Briefcase" },
                { label: "Globe", value: "Globe" },
                { label: "Building", value: "Building" },
                { label: "Heart", value: "Heart" },
                { label: "Sparkles", value: "Sparkles" },
              ],
            },
          },
        },
      },
      render: (props) => <StatsGrid {...props} />,
      defaultProps: {
        columns: 4,
        variant: "simple",
        items: [
          { value: "100+", label: "Events" },
          { value: "50+", label: "Partners" },
          { value: "1000+", label: "Members" },
          { value: "24/7", label: "Support" },
        ],
      },
    },
    TeamGrid: {
      fields: {
        columns: {
          type: "select",
          options: [
            { label: "2", value: 2 },
            { label: "3", value: 3 },
            { label: "4", value: 4 },
          ],
        },
        variant: {
          type: "select",
          options: [
            { label: "Card", value: "card" },
            { label: "Minimal", value: "minimal" },
          ],
        },
        members: {
          type: "array",
          getItemSummary: (item) => item.name || "Member",
          arrayFields: {
            name: { type: "text" },
            role: { type: "text" },
            image: { type: "image" } as any,
            bio: { type: "textarea" },
            email: { type: "text" },
            linkedin: { type: "text" },
          },
        },
      },
      render: (props) => <TeamGrid {...props} />,
      defaultProps: {
        columns: 3,
        variant: "card",
        members: [
          {
            name: "John Doe",
            role: "President",
            image:
              "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400",
          },
          {
            name: "Jane Smith",
            role: "VP",
            image:
              "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400",
          },
          {
            name: "Bob Johnson",
            role: "Treasurer",
            image:
              "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400",
          },
        ],
      },
    },
    LogoGrid: {
      fields: {
        columns: {
          type: "select",
          options: [
            { label: "3", value: 3 },
            { label: "4", value: 4 },
            { label: "5", value: 5 },
            { label: "6", value: 6 },
          ],
        },
        variant: {
          type: "select",
          options: [
            { label: "Bordered", value: "bordered" },
            { label: "Card", value: "card" },
            { label: "Simple", value: "simple" },
          ],
        },
        grayscale: {
          type: "radio",
          options: [
            { label: "Yes", value: true },
            { label: "No", value: false },
          ],
        },
        items: {
          type: "array",
          getItemSummary: (item) => item.alt || "Logo",
          arrayFields: {
            image: { type: "image" } as any,
            alt: { type: "text" },
            href: { type: "link" } as any,
          },
        },
      },
      render: (props) => <LogoGrid {...props} />,
      defaultProps: {
        columns: 4,
        variant: "bordered",
        grayscale: true,
        items: [
          {
            alt: "Partner 1",
            image: "https://via.placeholder.com/150x80?text=Logo+1",
          },
          {
            alt: "Partner 2",
            image: "https://via.placeholder.com/150x80?text=Logo+2",
          },
          {
            alt: "Partner 3",
            image: "https://via.placeholder.com/150x80?text=Logo+3",
          },
          {
            alt: "Partner 4",
            image: "https://via.placeholder.com/150x80?text=Logo+4",
          },
        ],
      },
    },
    CTA: {
      fields: {
        title: { type: "text", contentEditable: true } as any,
        description: { type: "textarea", contentEditable: true },
        variant: {
          type: "select",
          options: [
            { label: "Default", value: "default" },
            { label: "Card", value: "card" },
            { label: "Brand", value: "brand" },
            { label: "Dark", value: "dark" },
          ],
        },
        align: {
          type: "radio",
          options: [
            { label: "Center", value: "center" },
            { label: "Left", value: "left" },
          ],
        },
        buttons: {
          type: "array",
          arrayFields: {
            label: { type: "text" },
            href: { type: "link" } as any,
            variant: {
              type: "select",
              options: [
                { label: "Default", value: "default" },
                { label: "Outline", value: "outline" },
                { label: "Ghost", value: "ghost" },
                { label: "White", value: "white" },
              ],
            },
          },
          defaultItemProps: {
            label: "Button",
            href: "#",
            variant: "default",
          },
        },
      },
      render: (props) => <CTA {...props} />,
      defaultProps: {
        title: "Ready to join?",
        description: "Get started today.",
        variant: "brand",
        buttons: [{ label: "Join Now", href: "/join", variant: "white" }],
      },
    },
    Section: {
      fields: {
        backgroundColor: {
          type: "select",
          options: [
            { label: "White", value: "white" },
            { label: "Gray", value: "gray" },
            { label: "Primary (Light)", value: "primary" },
            { label: "Primary (Strong)", value: "primary-strong" },
            { label: "Dark", value: "dark" },
          ],
        },
        padding: {
          type: "select",
          options: [
            { label: "None", value: "none" },
            { label: "Small", value: "sm" },
            { label: "Medium", value: "md" },
            { label: "Large", value: "lg" },
            { label: "Extra Large", value: "xl" },
          ],
        },
        maxWidth: {
          type: "select",
          options: [
            { label: "Default", value: "default" },
            { label: "Full", value: "full" },
            { label: "Narrow", value: "narrow" },
          ],
        },
        id: { type: "text" },
        content: { type: "slot" },
      },
      render: ({ content: Content, ...props }) => (
        <Section {...props}>{Content && <Content />}</Section>
      ),
      defaultProps: {
        backgroundColor: "white",
        padding: "md",
        maxWidth: "default",
      },
    },
    Hero: {
      resolveFields: (data) => {
        const fields: any = {
          layout: {
            type: "select",
            options: [
              { label: "Center", value: "center" },
              { label: "Left", value: "left" },
              { label: "Split", value: "split" },
              { label: "Carousel", value: "carousel" },
            ],
          },
          height: {
            type: "select",
            options: [
              { label: "Full Screen", value: "full" },
              { label: "Large", value: "large" },
              { label: "Medium", value: "medium" },
              { label: "Small", value: "small" },
            ],
          },
          title: { type: "text" },
          subtitle: { type: "textarea", contentEditable: true },
          badge: { type: "text" },
          backgroundImage: { type: "image" },
          image: { type: "image" },
          overlay: {
            type: "radio",
            options: [
              { label: "Yes", value: true },
              { label: "No", value: false },
            ],
          },
          buttons: {
            type: "array",
            arrayFields: {
              label: { type: "text" },
              href: { type: "link" },
              variant: {
                type: "select",
                options: [
                  { label: "Default", value: "default" },
                  { label: "Outline", value: "outline" },
                  { label: "Ghost", value: "ghost" },
                  { label: "Link", value: "link" },
                  { label: "Glass", value: "glass" },
                  { label: "Gradient", value: "gradient" },
                ],
              },
            },
            defaultItemProps: {
              label: "New Button",
              href: "#",
              variant: "default",
            },
          },
          styling: {
            type: "object",
            label: "Styling & Design",
            objectFields: {
              padding: {
                type: "select",
                options: [
                  { label: "Default", value: "default" },
                  { label: "Small", value: "py-8" },
                  { label: "Medium", value: "py-16" },
                  { label: "Large", value: "py-24" },
                ],
              },
              className: { type: "text", label: "Custom CSS Class" },
            },
          },
        };

        // Conditional fields
        if (data.props.layout === "split") {
          fields.rightSlot = { type: "slot" };
        }

        if (data.props.layout === "carousel") {
          fields.slidesMode = {
            type: "radio",
            label: "Slides Source",
            options: [
              { label: "Manual", value: "manual" },
              { label: "Dynamic", value: "dynamic" },
            ],
          };

          if (data.props.slidesMode === "dynamic") {
            fields.slidesSource = {
              type: "table-picker",
              label: "Dynamic Slides (Database)",
            };
          } else {
            fields.slides = {
              type: "array",
              getItemSummary: (item: any) => item.title || "Slide",
              arrayFields: {
                title: { type: "text" },
                subtitle: { type: "textarea" },
                image: { type: "image" },
                buttons: {
                  type: "array",
                  arrayFields: {
                    label: { type: "text" },
                    href: { type: "link" },
                    variant: {
                      type: "select",
                      options: [
                        { label: "Default", value: "default" },
                        { label: "Outline", value: "outline" },
                        { label: "Ghost", value: "ghost" },
                        { label: "Link", value: "link" },
                        { label: "Glass", value: "glass" },
                        { label: "Gradient", value: "gradient" },
                      ],
                    },
                  },
                  defaultItemProps: {
                    label: "New Button",
                    href: "#",
                    variant: "default",
                  },
                },
              },
              defaultItemProps: {
                title: "New Slide",
                subtitle: "Description",
                buttons: [],
              },
            };
          }
        }

        // Stats
        fields.statsMode = {
          type: "radio",
          label: "Stats Source",
          options: [
            { label: "Manual", value: "manual" },
            { label: "Dynamic", value: "dynamic" },
          ],
        };

        if (data.props.statsMode === "dynamic") {
          fields.statsSource = {
            type: "table-picker",
            label: "Dynamic Stats (Database)",
          };
        } else {
          fields.stats = {
            type: "array",
            getItemSummary: (item: any) => item.label,
            arrayFields: {
              value: { type: "text" },
              label: { type: "text" },
            },
          };
          fields.statsVariant = {
            type: "radio",
            options: [
              { label: "Pills", value: "pills" },
              { label: "Simple", value: "simple" },
            ],
          };
        }

        // Highlights
        fields.highlights = {
          type: "array",
          getItemSummary: (item: any) => item.text,
          arrayFields: {
            text: { type: "text" },
            icon: {
              type: "select",
              options: [
                { label: "Sparkles", value: "Sparkles" },
                { label: "MapPin", value: "MapPin" },
                { label: "Calendar", value: "Calendar" },
                { label: "Users", value: "Users" },
                { label: "Briefcase", value: "Briefcase" },
                { label: "Trophy", value: "Trophy" },
                { label: "Megaphone", value: "Megaphone" },
                { label: "CheckCircle", value: "CheckCircle" },
                { label: "ArrowRight", value: "ArrowRight" },
                { label: "Heart", value: "Heart" },
              ],
            },
          },
        };

        return fields;
      },
      resolveData: async ({ props }) => {
        const { slidesMode, slidesSource, statsMode, statsSource } = props;
        const resolvedProps: Partial<HeroPropsWithSlot> = {};

        if (slidesMode === "dynamic" && slidesSource) {
          try {
            const items = await getDynamicContent(slidesSource);
            resolvedProps.slides = items.map((item) => ({
              title: item.title,
              subtitle: item.subtitle || "",
              image: item.image,
              buttons: item.href
                ? [{ label: "Learn More", href: item.href, variant: "default" }]
                : [],
            }));
          } catch (e) {
            console.error("Failed to resolve slides", e);
          }
        }

        if (statsMode === "dynamic" && statsSource) {
          try {
            const items = await getDynamicContent(statsSource);
            resolvedProps.stats = items.map((item) => ({
              value: item.value || "0",
              label: item.label || item.title,
            }));
          } catch (e) {
            console.error("Failed to resolve stats", e);
          }
        }

        return { props: resolvedProps };
      },
      fields: {
        layout: {
          type: "select",
          options: [
            { label: "Center", value: "center" },
            { label: "Left", value: "left" },
            { label: "Split", value: "split" },
            { label: "Carousel", value: "carousel" },
          ],
        },
        // Default initial fields if needed, but resolveFields handles mostly
      },
      render: ({ rightSlot: RightSlot, ...props }) => (
        <Hero rightSlot={RightSlot && <RightSlot />} {...props} />
      ),
      defaultProps: {
        layout: "center",
        height: "medium",
        title: "Hero Title",
        subtitle: "This is a generic hero component that can be customized.",
        buttons: [{ label: "Get Started", href: "/", variant: "default" }],
        overlay: true,
        slides: [],
        slidesMode: "manual",
        stats: [],
        statsMode: "manual",
        highlights: [],
      },
    },
    About: {
      fields: {
        stats: {
          type: "array",
          arrayFields: {
            number: { type: "text" },
            label: { type: "text" },
            iconName: {
              type: "select",
              options: [
                { label: "Calendar", value: "Calendar" },
                { label: "Briefcase", value: "Briefcase" },
                { label: "Rocket", value: "Rocket" },
                { label: "Trophy", value: "Trophy" },
              ],
            },
          },
        },
        values: {
          type: "array",
          arrayFields: {
            title: { type: "text" },
            description: { type: "textarea" },
            iconName: {
              type: "select",
              options: [
                { label: "Megaphone", value: "Megaphone" },
                { label: "Link", value: "Link" },
                { label: "Sparkles", value: "Sparkles" },
              ],
            },
            gradient: { type: "text" },
          },
        },
        mainContent: {
          type: "object",
          objectFields: {
            tag: { type: "text" },
            titleLine1: { type: "text", contentEditable: true } as any,
            titleLine2: { type: "text", contentEditable: true } as any,
            paragraph1: { type: "textarea", contentEditable: true },
            paragraph2: { type: "textarea", contentEditable: true },
          },
        },
        videoUrl: { type: "text" },
      },
      render: (props) => <About {...props} />,
      defaultProps: {
        stats: [
          { number: "100+", label: "Events", iconName: "Calendar" },
          { number: "50+", label: "Jobs", iconName: "Briefcase" },
          { number: "20+", label: "Societies", iconName: "Rocket" },
        ],
        values: [
          {
            title: "Impact",
            description: "We make an impact.",
            iconName: "Megaphone",
            gradient: "from-[#3DA9E0] to-[#001731]",
          },
        ],
        mainContent: {
          tag: "About",
          titleLine1: "Premier Student",
          titleLine2: "Community",
          paragraph1: "We are the student union...",
          paragraph2: "Join us today.",
        },
      },
    },
    JoinUs: {
      fields: {
        tag: { type: "text" },
        titleLine1: { type: "text" },
        titleLine2: { type: "text" },
        subtitle: { type: "textarea" },
        heroBadge: { type: "text" },
        heroSubtitle: { type: "textarea" },
        memberFeaturesHeader: { type: "text" },
        memberFeatures: {
          type: "array",
          arrayFields: {
            // Puck array of strings is a bit tricky, usually needs object
            // But I'll assume string support or wrapper
            // Actually Puck requires object for array items usually?
            // Let's use a simple object wrapper in component if needed, but component takes string[]
            // In Puck config, we can adapt.
            // For now, I'll just use text fields in array.
            feature: { type: "text" },
          },
          // I need to map the output
        },
        benefits: {
          type: "array",
          arrayFields: {
            text: { type: "text" },
            iconName: {
              type: "select",
              options: [
                { label: "Sparkles", value: "Sparkles" },
                { label: "Gift", value: "Gift" },
                { label: "Crown", value: "Crown" },
                { label: "Zap", value: "Zap" },
                { label: "Check", value: "Check" },
              ],
            },
          },
        },
        durations: {
          type: "array",
          arrayFields: {
            name: { type: "text" },
            price: { type: "text" },
            period: { type: "text" },
            savings: { type: "text" },
            popular: {
              type: "radio",
              options: [
                { label: "Yes", value: true },
                { label: "No", value: false },
              ],
            },
            gradient: { type: "text" },
          },
        },
        cta: {
          type: "object",
          objectFields: {
            title: { type: "text" },
            subtitle: { type: "textarea" },
            buttonText: { type: "text" },
          },
        },
      },
      render: (props) => {
        const componentProps = {
          ...props,
          memberFeatures: props.memberFeatures?.map((f) => f.feature) || [],
        };
        return <JoinUs {...componentProps} />;
      },
      defaultProps: {
        tag: "Membership",
        titleLine1: "Join the",
        titleLine2: "Community",
        subtitle: "Unlock exclusive benefits.",
        heroBadge: "Why Join?",
        heroSubtitle: "Being a member pays off.",
        memberFeaturesHeader: "All memberships include:",
        memberFeatures: [{ feature: "Event Access" }, { feature: "Discounts" }],
        benefits: [{ text: "Social Events", iconName: "Sparkles" }],
        durations: [
          {
            name: "1 Year",
            price: "200 NOK",
            period: "/year",
            popular: true,
            gradient: "from-purple-600 to-pink-600",
          },
        ],
        cta: {
          title: "Not sure?",
          subtitle: "Contact us.",
          buttonText: "Contact",
        },
      },
    },
    News: {
      resolveFields: (data): any => {
        const fields: Record<string, unknown> = {
          dataMode: {
            type: "radio",
            label: "Data Source",
            options: [
              { label: "Manual Entry", value: "manual" },
              { label: "Dynamic (Database)", value: "dynamic" },
            ],
          },
        };

        if (data.props.dataMode === "dynamic") {
          fields.dataSource = {
            type: "data-source",
            label: "News Source",
          };
          fields.limit = {
            type: "number",
            label: "Max Articles",
          };
        } else {
          fields.news = {
            type: "array",
            getItemSummary: (item: { title?: string }) =>
              item.title || "Article",
            arrayFields: {
              title: { type: "text" },
              description: { type: "textarea" },
              image: { type: "image" },
              content_id: { type: "text" },
              $id: { type: "text" },
              $createdAt: { type: "text" },
            },
          };
        }

        fields.labels = {
          type: "object",
          objectFields: {
            empty: { type: "text" },
            emptyDescription: { type: "text" },
            cta: { type: "text" },
            stayUpdated: { type: "text" },
            titleDefault: { type: "text" },
            readMore: { type: "text" },
            viewAllNews: { type: "text" },
          },
        };

        return fields;
      },
      resolveData: async ({ props }) => {
        if (props.dataMode !== "dynamic" || !props.dataSource?.table) {
          return { props: {} };
        }

        try {
          const items = await getDynamicContent({
            table: "news",
            ...props.dataSource,
            limit: props.limit || 6,
          });

          const news = items.map((item) => ({
            $id: item.id || "",
            content_id: item.id || "",
            title: item.title,
            description: item.description || "",
            image: item.image || "",
            $createdAt: item.date || new Date().toISOString(),
          }));

          return { props: { news } };
        } catch (e) {
          console.error("Failed to resolve news", e);
          return { props: {} };
        }
      },
      render: (props) => <FilteredNews {...props} />,
      defaultProps: {
        dataMode: "manual",
        news: [],
        labels: {
          empty: "No news yet",
          emptyDescription: "Check back later.",
          cta: "Update",
          stayUpdated: "Stay",
          titleDefault: "Updated",
          readMore: "Read More",
          viewAllNews: "View All News",
        },
      },
    },
    FilterBar: {
      fields: {
        title: { type: "text" },
        showSearch: {
          type: "radio",
          options: [
            { label: "Yes", value: true },
            { label: "No", value: false },
          ],
        },
        categories: {
          type: "array",
          getItemSummary: (item) => item.label || "Category",
          arrayFields: {
            label: { type: "text" },
            value: { type: "text" },
          },
        },
      },
      render: (props) => <FilterBar {...props} />,
      defaultProps: {
        showSearch: true,
        categories: [
          { label: "Social", value: "Social" },
          { label: "Career", value: "Career" },
          { label: "Academic", value: "Academic" },
        ],
      },
    },
    JobsList: {
      fields: {
        jobs: {
          type: "array",
          getItemSummary: (item) => item.title || "Job",
          arrayFields: {
            title: { type: "text" },
            department: { type: "text" },
            location: { type: "text" },
            type: { type: "text" },
            paid: {
              type: "radio",
              options: [
                { label: "Yes", value: true },
                { label: "No", value: false },
              ],
            },
            category: { type: "text" },
            description: { type: "textarea" },
            slug: { type: "text" },
            deadline: { type: "text" },
          },
        },
        labels: {
          type: "object",
          objectFields: {
            viewDetails: { type: "text" },
            paid: { type: "text" },
            volunteer: { type: "text" },
            deadline: { type: "text" },
            noJobs: { type: "text" },
          },
        },
      },
      render: (props) => <JobsList {...props} />,
      defaultProps: {
        jobs: [
          {
            title: "Event Coordinator",
            department: "Social Committee",
            location: "Oslo",
            type: "Volunteer",
            paid: false,
            category: "Social",
            description: "Plan amazing events.",
          },
        ],
        labels: {
          viewDetails: "View Details",
          paid: "Paid",
          volunteer: "Volunteer",
          deadline: "Deadline:",
          noJobs: "No positions found.",
        },
      },
    },
    Events: {
      resolveFields: (data): any => {
        const fields: Record<string, unknown> = {
          dataMode: {
            type: "radio",
            label: "Data Source",
            options: [
              { label: "Manual Entry", value: "manual" },
              { label: "Dynamic (Database)", value: "dynamic" },
            ],
          },
        };

        if (data.props.dataMode === "dynamic") {
          fields.dataSource = {
            type: "data-source",
            label: "Events Source",
          };
          fields.limit = {
            type: "number",
            label: "Max Events",
          };
        } else {
          fields.events = {
            type: "array",
            getItemSummary: (item: { title?: string }) => item.title || "Event",
            arrayFields: {
              title: { type: "text" },
              image: { type: "image" },
              start_date: { type: "text" },
              end_date: { type: "text" },
              location: { type: "text" },
              category: {
                type: "select",
                options: [
                  { label: "Social", value: "Social" },
                  { label: "Career", value: "Career" },
                  { label: "Academic", value: "Academic" },
                ],
              },
              attendees: { type: "number" },
              content_id: { type: "text" },
              $id: { type: "text" },
            },
          };
        }

        fields.labels = {
          type: "object",
          objectFields: {
            empty: { type: "text" },
            emptyDescription: { type: "text" },
            upcomingEvents: { type: "text" },
            dontMissOut: { type: "text" },
            amazingExperiences: { type: "text" },
            description: { type: "textarea" },
            registerNow: { type: "text" },
            viewAllEvents: { type: "text" },
          },
        };

        return fields;
      },
      resolveData: async ({ props }) => {
        if (props.dataMode !== "dynamic" || !props.dataSource?.table) {
          return { props: {} };
        }

        try {
          const items = await getDynamicContent({
            table: "events",
            ...props.dataSource,
            limit: props.limit || 6,
          });

          const events = items.map((item) => ({
            $id: item.id || "",
            content_id: item.id || "",
            title: item.title,
            image: item.image,
            start_date: item.date,
            location: item.location,
            category: item.category,
          }));

          return { props: { events } };
        } catch (e) {
          console.error("Failed to resolve events", e);
          return { props: {} };
        }
      },
      render: (props) => <FilteredEvents {...props} />,
      defaultProps: {
        dataMode: "manual",
        events: [],
        labels: {
          empty: "No events",
          emptyDescription: "Check back later",
          upcomingEvents: "Upcoming Events",
          dontMissOut: "Don't miss out on",
          amazingExperiences: "amazing experiences",
          description: "Join us at our events.",
          registerNow: "Register Now",
          viewAllEvents: "View All Events",
        },
      },
    },
    Collection: {
      label: "Collection",
      resolveFields: (data): any => {
        const fields: Record<string, unknown> = {
          title: { type: "text", label: "Title" },
          subtitle: { type: "textarea", label: "Subtitle" },
          layout: {
            type: "select",
            label: "Layout",
            options: LAYOUT_OPTIONS,
          },
          columns: {
            type: "select",
            label: "Columns",
            options: [
              { label: "2 Columns", value: 2 },
              { label: "3 Columns", value: 3 },
              { label: "4 Columns", value: 4 },
              { label: "5 Columns", value: 5 },
              { label: "6 Columns", value: 6 },
            ],
          },
          dataMode: {
            type: "radio",
            label: "Data Source",
            options: [
              { label: "Manual Entry", value: "manual" },
              { label: "Dynamic (Database)", value: "dynamic" },
            ],
          },
        };

        if (data.props.dataMode === "dynamic") {
          fields.dataSource = {
            type: "data-source",
            label: "Data Source",
          };
        } else {
          fields.items = {
            type: "array",
            label: "Items",
            getItemSummary: (item: { title?: string }) => item.title || "Item",
            arrayFields: {
              title: { type: "text", label: "Title" },
              subtitle: { type: "text", label: "Subtitle" },
              description: { type: "textarea", label: "Description" },
              image: { type: "image", label: "Image" },
              icon: { type: "text", label: "Icon (e.g., star, heart, users)" },
              href: { type: "text", label: "Link URL" },
              date: { type: "text", label: "Date" },
              badge: { type: "text", label: "Badge" },
            },
          };
        }

        // Display options
        fields.emptyMessage = { type: "text", label: "Empty Message" };
        fields.ctaLabel = { type: "text", label: "CTA Button Label" };
        fields.ctaHref = { type: "text", label: "CTA Button Link" };

        // Layout-specific options
        if (data.props.layout === "logo-grid") {
          fields.grayscale = {
            type: "radio",
            label: "Grayscale",
            options: [
              { label: "Yes", value: true },
              { label: "No", value: false },
            ],
          };
        }

        if (data.props.layout === "card-grid") {
          fields.cardVariant = {
            type: "select",
            label: "Card Style",
            options: [
              { label: "Default", value: "default" },
              { label: "Bordered", value: "bordered" },
              { label: "Elevated", value: "elevated" },
            ],
          };
          fields.imageAspect = {
            type: "select",
            label: "Image Aspect",
            options: [
              { label: "Video (16:9)", value: "video" },
              { label: "Square", value: "square" },
              { label: "Portrait (3:4)", value: "portrait" },
            ],
          };
        }

        return fields;
      },
      resolveData: async ({ props }) => {
        if (props.dataMode !== "dynamic" || !props.dataSource?.table) {
          return { props: {} };
        }

        try {
          const items = await getDynamicContent({
            ...props.dataSource,
          });

          const collectionItems = items.map((item) => ({
            id: item.id || crypto.randomUUID(),
            title: item.title,
            subtitle: item.subtitle,
            description: item.description,
            image: item.image,
            href: item.href,
            date: item.date,
            badge: item.badge,
          }));

          return { props: { items: collectionItems } };
        } catch (e) {
          console.error("Failed to resolve collection", e);
          return { props: {} };
        }
      },
      render: (props) => <Collection {...props} />,
      defaultProps: {
        layout: "card-grid",
        dataMode: "manual",
        items: [],
        emptyMessage: "No items to display",
        emptyDescription: "Check back later.",
      },
    },
    RichText: {
      fields: {
        content: {
          type: "textarea",
          label: "Content (Markdown)",
        },
        variant: {
          type: "select",
          options: [
            { label: "Default", value: "default" },
            { label: "Compact", value: "compact" },
            { label: "Legal Document", value: "legal" },
          ],
        },
        columns: {
          type: "radio",
          options: [
            { label: "Single Column", value: 1 },
            { label: "Two Columns", value: 2 },
          ],
        },
      },
      render: (props) => <RichText {...props} />,
      defaultProps: {
        content:
          "## Section Title\n\nThis is a paragraph of text. You can use **bold** and *italic* formatting.\n\n### Subsection\n\n- List item 1\n- List item 2\n- List item 3\n\nLearn more at [our website](https://example.com).",
        variant: "default",
        columns: 1,
      },
    },
    PageHeader: {
      fields: {
        title: { type: "text" },
        subtitle: { type: "textarea" },
        lastUpdated: { type: "text", label: "Last Updated Date" },
        breadcrumbs: {
          type: "array",
          getItemSummary: (item) => item.label || "Breadcrumb",
          arrayFields: {
            label: { type: "text" },
            href: { type: "text" },
          },
        },
        variant: {
          type: "select",
          options: [
            { label: "Default (Left)", value: "default" },
            { label: "Centered", value: "centered" },
            { label: "Minimal", value: "minimal" },
          ],
        },
        showDivider: {
          type: "radio",
          options: [
            { label: "Yes", value: true },
            { label: "No", value: false },
          ],
        },
      },
      render: (props) => <PageHeader {...props} />,
      defaultProps: {
        title: "Privacy Policy",
        subtitle:
          "This policy describes how we collect, use, and protect your personal information.",
        lastUpdated: "November 2024",
        breadcrumbs: [{ label: "Privacy Policy" }],
        variant: "default",
        showDivider: true,
      },
    },
    TableOfContents: {
      fields: {
        title: { type: "text" },
        items: {
          type: "array",
          getItemSummary: (item) => item.title || "Section",
          arrayFields: {
            title: { type: "text" },
            anchor: { type: "text", label: "Anchor ID (without #)" },
            level: {
              type: "select",
              options: [
                { label: "Level 1 (Main)", value: 1 },
                { label: "Level 2 (Sub)", value: 2 },
                { label: "Level 3 (Nested)", value: 3 },
              ],
            },
          },
        },
        variant: {
          type: "select",
          options: [
            { label: "Default", value: "default" },
            { label: "Card", value: "card" },
            { label: "Sticky Sidebar", value: "sticky" },
          ],
        },
        showIcon: {
          type: "radio",
          options: [
            { label: "Yes", value: true },
            { label: "No", value: false },
          ],
        },
      },
      render: (props) => <TableOfContents {...props} />,
      defaultProps: {
        title: "Table of Contents",
        items: [
          { title: "Introduction", anchor: "introduction", level: 1 },
          { title: "Data Collection", anchor: "data-collection", level: 1 },
          { title: "Personal Information", anchor: "personal-info", level: 2 },
          { title: "Your Rights", anchor: "your-rights", level: 1 },
          { title: "Contact Us", anchor: "contact", level: 1 },
        ],
        variant: "card",
        showIcon: true,
      },
    },
  },
};

export default config;
