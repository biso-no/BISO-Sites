"use client";
import { type Config, registerOverlayPortal, type Slot } from "@measured/puck";
import { FileUpload } from "@repo/ui/components/file-upload";
import {
  AccordionBlock,
  type AccordionBlockProps,
} from "@repo/ui/components/puck/accordion";
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
import {
  Hero as GenericHero,
  type HeroProps as GenericHeroProps,
} from "@repo/ui/components/puck/hero";
import {
  JobsList,
  type JobsListProps,
} from "@repo/ui/components/puck/jobs-list";
import {
  LogoGrid,
  type LogoGridProps,
} from "@repo/ui/components/puck/logo-grid";
import { Section, type SectionProps } from "@repo/ui/components/puck/section";
import { Spacer, type SpacerProps } from "@repo/ui/components/puck/spacer";
import {
  StatsGrid,
  type StatsGridProps,
} from "@repo/ui/components/puck/stats-grid";
import { Tabs, type TabsProps } from "@repo/ui/components/puck/tabs";
import {
  TeamGrid,
  type TeamGridProps,
} from "@repo/ui/components/puck/team-grid";
import { About, type AboutProps } from "@repo/ui/components/sections/about";
import { Events, type EventsProps } from "@repo/ui/components/sections/events";
import { Hero, type HeroProps } from "@repo/ui/components/sections/hero";
import { JoinUs, type JoinUsProps } from "@repo/ui/components/sections/join-us";
import { News, type NewsProps } from "@repo/ui/components/sections/news";
import { useEffect, useRef } from "react";

type EditorJoinUsProps = Omit<JoinUsProps, "memberFeatures"> & {
  memberFeatures: { feature: string }[];
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

type GenericHeroPropsWithSlot = GenericHeroProps & { rightSlot?: Slot };

type Props = {
  Hero: HeroProps;
  About: AboutProps;
  JoinUs: EditorJoinUsProps;
  News: NewsProps;
  Events: EventsProps;
  Section: SectionPropsWithSlot;
  GenericHero: GenericHeroPropsWithSlot;
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
        useEffect(() => registerOverlayPortal(ref.current), [ref.current]);
        return (
          <Tabs
            ref={ref as any}
            {...props}
            tabs={tabs}
            tab0={Tab0 && <Tab0 />}
            tab1={Tab1 && <Tab1 />}
            tab2={Tab2 && <Tab2 />}
            tab3={Tab3 && <Tab3 />}
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
        title: { type: "text" },
        subtitle: { type: "textarea" },
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
            href: { type: "text" },
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
            href: { type: "text" },
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
        title: { type: "text" },
        description: { type: "textarea" },
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
            href: { type: "text" },
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
    GenericHero: {
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
        subtitle: { type: "textarea" },
        badge: { type: "text" },
        backgroundImage: { type: "image" } as any,
        image: { type: "image" } as any,
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
            href: { type: "text" },
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
        },
        // Carousel Slides
        slides: {
          type: "array",
          getItemSummary: (item) => item.title || "Slide",
          arrayFields: {
            title: { type: "text" },
            subtitle: { type: "textarea" },
            image: { type: "image" } as any,
            buttons: {
              type: "array",
              arrayFields: {
                label: { type: "text" },
                href: { type: "text" },
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
            },
          },
        },
        // Stats Overlay
        stats: {
          type: "array",
          getItemSummary: (item) => item.label,
          arrayFields: {
            value: { type: "text" },
            label: { type: "text" },
          },
        },
        statsVariant: {
          type: "radio",
          options: [
            { label: "Pills", value: "pills" },
            { label: "Simple", value: "simple" },
          ],
        },
        // Highlights List
        highlights: {
          type: "array",
          getItemSummary: (item) => item.text,
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
        },
        // Slot for Split Layout
        rightSlot: { type: "slot" },
      },
      render: ({ rightSlot: RightSlot, ...props }) => (
        <GenericHero rightSlot={RightSlot && <RightSlot />} {...props} />
      ),
      defaultProps: {
        layout: "center",
        height: "medium",
        title: "Hero Title",
        subtitle: "This is a generic hero component that can be customized.",
        buttons: [{ label: "Get Started", href: "/", variant: "default" }],
        overlay: true,
        slides: [],
        stats: [],
        highlights: [],
      },
    },
    Hero: {
      fields: {
        featuredContent: {
          type: "array",
          getItemSummary: (item) => item.title || "Content Item",
          arrayFields: {
            title: { type: "text" },
            description: { type: "textarea" },
            imageUrl: { type: "text" },
            link: { type: "text" },
            type: {
              type: "select",
              options: [
                { label: "Event", value: "event" },
                { label: "News", value: "news" },
                { label: "Custom", value: "custom" },
              ],
            },
            content_id: { type: "text" },
          },
        },
        labels: {
          type: "object",
          objectFields: {
            badge: { type: "text" },
            badgeElevated: { type: "text" },
            subtitle: { type: "textarea" },
            ctaJoin: { type: "text" },
            ctaViewEvents: { type: "text" },
            featuredLabel: { type: "text" },
            learnMore: { type: "text" },
            viewAll: { type: "text" },
          },
        },
      },
      render: (props) => <Hero {...props} />,
      defaultProps: {
        featuredContent: [
          {
            title: "Welcome to BISO",
            description:
              "The student organisation for BI Norwegian Business School",
            type: "custom",
          },
        ],
        labels: {
          badge: "Your Student",
          badgeElevated: "Organisation",
          subtitle: "We are here for you.",
          ctaJoin: "Join Us",
          ctaViewEvents: "View Events",
          featuredLabel: "Featured",
          learnMore: "Learn More",
          viewAll: "View All",
        },
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
            titleLine1: { type: "text" },
            titleLine2: { type: "text" },
            paragraph1: { type: "textarea" },
            paragraph2: { type: "textarea" },
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
      fields: {
        news: {
          type: "array",
          getItemSummary: (item) => item.title,
          arrayFields: {
            title: { type: "text" },
            description: { type: "textarea" },
            image: { type: "image" } as any,
            content_id: { type: "text" },
            $id: { type: "text" },
            $createdAt: { type: "text" }, // User would have to manually enter date string?
          },
        },
        labels: {
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
        },
      },
      render: (props) => <FilteredNews {...props} />,
      defaultProps: {
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
      fields: {
        events: {
          type: "array",
          getItemSummary: (item) => item.title,
          arrayFields: {
            title: { type: "text" },
            image: { type: "image" } as any,
            start_date: { type: "text" }, // ISO string
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
        },
        labels: {
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
        },
      },
      render: (props) => <FilteredEvents {...props} />,
      defaultProps: {
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
  },
};

export default config;
