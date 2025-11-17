import { cn } from "@repo/ui/lib/utils";
import type { Config } from "@measured/puck";

// Layout & Content
import { Section } from "./components/section";
import { Heading } from "./components/heading";
import { Text } from "./components/text";
import { Button } from "./components/button";

// Blocks
import { Hero } from "./components/blocks/hero";
import { Stats } from "./components/blocks/stats";
import { Features } from "./components/blocks/features";
import { CTA } from "./components/blocks/cta";
import { CardGrid } from "./components/blocks/card-grid";
import { Testimonial } from "./components/blocks/testimonial";
import { FAQ } from "./components/blocks/faq";
import { LogoCloud } from "./components/blocks/logo-cloud";
import { PricingTable } from "./components/blocks/pricing-table";
import { TeamGrid } from "./components/blocks/team-grid";
import { Newsletter } from "./components/blocks/newsletter";
import { Spacer } from "./components/blocks/spacer";
import { Image } from "./components/blocks/image";

// Elements
import { CardElement } from "./components/elements/card";
import { BadgeElement } from "./components/elements/badge";
import { AlertElement } from "./components/elements/alert";
import { SeparatorElement } from "./components/elements/separator";
import { AvatarElement } from "./components/elements/avatar";
import { TabsElement } from "./components/elements/tabs";
import { AccordionElement } from "./components/elements/accordion";
import { ProgressElement } from "./components/elements/progress";
import { SkeletonElement } from "./components/elements/skeleton";
import { CheckboxElement } from "./components/elements/checkbox";
import { InputElement } from "./components/elements/input";
import { TextareaElement } from "./components/elements/textarea";
import { SelectElement } from "./components/elements/select";
import { SwitchElement } from "./components/elements/switch";
import { TableElement } from "./components/elements/table";

import type {
  PageBuilderComponents,
  PageBuilderDocument,
  PageBuilderRootProps,
  SectionBackground,
  SectionPadding,
  SectionWidth,
  HeadingLevel,
  HeadingSize,
  TextSize,
  TextTone,
  ButtonVariant,
  ButtonSize,
  ContentAlignment,
  GradientPreset,
  GridColumns,
  LayoutVariant,
  IconPosition,
  AspectRatio,
  ImageBorder,
  Shadow,
  BadgeVariant,
  AlertVariant,
} from "./types";

const rootBackgroundMap: Record<SectionBackground, string> = {
  default: "bg-white",
  muted: "bg-slate-50",
  primary: "bg-primary/5",
};

const rootSpacingMap: Record<SectionPadding, string> = {
  none: "gap-0 py-0",
  sm: "gap-8 py-8",
  md: "gap-12 py-12",
  lg: "gap-16 py-16",
};

// Common option arrays
const backgroundOptions = [
  { label: "White", value: "default" },
  { label: "Muted", value: "muted" },
  { label: "Primary", value: "primary" },
] satisfies { label: string; value: SectionBackground }[];

const gradientOptions = [
  { label: "Blue", value: "blue" },
  { label: "Purple", value: "purple" },
  { label: "Pink", value: "pink" },
  { label: "Cyan", value: "cyan" },
  { label: "Green", value: "green" },
  { label: "Orange", value: "orange" },
  { label: "Custom (BISO)", value: "custom" },
] satisfies { label: string; value: GradientPreset }[];

const paddingOptions = [
  { label: "None", value: "none" },
  { label: "Small", value: "sm" },
  { label: "Medium", value: "md" },
  { label: "Large", value: "lg" },
] satisfies { label: string; value: SectionPadding }[];

const widthOptions = [
  { label: "Default", value: "default" },
  { label: "Wide", value: "lg" },
  { label: "Extra wide", value: "xl" },
  { label: "Full", value: "full" },
] satisfies { label: string; value: SectionWidth }[];

const alignmentOptions = [
  { label: "Left", value: "left" },
  { label: "Center", value: "center" },
  { label: "Right", value: "right" },
] satisfies { label: string; value: ContentAlignment }[];

const columnsOptions = [
  { label: "1 Column", value: "1" },
  { label: "2 Columns", value: "2" },
  { label: "3 Columns", value: "3" },
  { label: "4 Columns", value: "4" },
] satisfies { label: string; value: GridColumns }[];

const shadowOptions = [
  { label: "None", value: "none" },
  { label: "Small", value: "sm" },
  { label: "Medium", value: "md" },
  { label: "Large", value: "lg" },
  { label: "Extra Large", value: "xl" },
] satisfies { label: string; value: Shadow }[];

const headingLevelOptions = (
  ["h1", "h2", "h3", "h4", "h5", "h6"] as HeadingLevel[]
).map((value) => ({ label: value.toUpperCase(), value }));

const headingSizeOptions = (
  ["xs", "sm", "md", "lg", "xl", "2xl", "3xl"] as HeadingSize[]
).map((value) => ({ label: value.toUpperCase(), value }));

const textSizeOptions = (
  ["sm", "base", "lg", "xl"] as TextSize[]
).map((value) => ({ label: value.toUpperCase(), value }));

const textToneOptions = (
  ["default", "muted"] as TextTone[]
).map((value) => ({
  label: value === "default" ? "Default" : "Muted",
  value,
}));

const buttonVariantOptions = (
  ["primary", "secondary", "outline"] as ButtonVariant[]
).map((value) => ({ label: value.replace(/^[a-z]/, (c) => c.toUpperCase()), value }));

const buttonSizeOptions = (
  ["sm", "md", "lg"] as ButtonSize[]
).map((value) => ({ label: value.toUpperCase(), value }));

export const DEFAULT_PAGE_DOCUMENT: PageBuilderDocument = {
  root: {
    props: {
      title: "",
      description: "",
      slug: "",
      background: "default",
      spacing: "md",
    },
  },
  content: [],
};

export const pageBuilderConfig: Config<PageBuilderComponents, PageBuilderRootProps> = {
  categories: {
    blocks: {
      title: "Blocks",
      components: [
        "Hero",
        "Stats",
        "Features",
        "CTA",
        "CardGrid",
        "Testimonial",
        "FAQ",
        "LogoCloud",
        "PricingTable",
        "TeamGrid",
        "Newsletter",
        "Image",
        "Spacer",
      ],
    },
    elements: {
      title: "Elements",
      components: [
        "CardElement",
        "BadgeElement",
        "AlertElement",
        "SeparatorElement",
        "AvatarElement",
        "TabsElement",
        "AccordionElement",
        "ProgressElement",
        "SkeletonElement",
        "CheckboxElement",
        "InputElement",
        "TextareaElement",
        "SelectElement",
        "SwitchElement",
        "TableElement",
      ],
    },
    layout: {
      title: "Layout",
      components: ["Section"],
    },
    content: {
      title: "Content",
      components: ["Heading", "Text", "Button"],
    },
  },
  root: {
    label: "Page",
    defaultProps: {
      background: "default",
      spacing: "md",
    },
    fields: {
      title: {
        type: "text",
        label: "Page Title",
      },
      description: {
        type: "textarea",
        label: "Description",
      },
      slug: {
        type: "text",
        label: "Slug Override",
      },
      background: {
        type: "select",
        label: "Background",
        options: backgroundOptions,
      },
      spacing: {
        type: "select",
        label: "Vertical spacing",
        options: paddingOptions,
      },
    },
    render: ({ children, background = "default", spacing = "md" }) => (
      <div className={cn("min-h-screen w-full", rootBackgroundMap[background])}>
        <div className={cn("mx-auto flex w-full flex-col", rootSpacingMap[spacing])}>
          {children}
        </div>
      </div>
    ),
  },
  components: {
    // LAYOUT
    Section: {
      label: "Section",
      defaultProps: {
        background: "default",
        padding: "md",
        width: "default",
        align: "left",
        overlayOpacity: 60,
        border: false,
        shadow: "none",
      },
      fields: {
        id: {
          type: "text",
          label: "Anchor ID",
        },
        background: {
          type: "select",
          label: "Background",
          options: backgroundOptions,
        },
        gradient: {
          type: "select",
          label: "Gradient (overrides background)",
          options: gradientOptions,
        },
        padding: {
          type: "select",
          label: "Padding",
          options: paddingOptions,
        },
        width: {
          type: "select",
          label: "Content width",
          options: widthOptions,
        },
        align: {
          type: "select",
          label: "Content alignment",
          options: alignmentOptions,
        },
        border: {
          type: "radio",
          label: "Border",
          options: [
            { label: "No", value: false },
            { label: "Yes", value: true },
          ],
        },
        shadow: {
          type: "select",
          label: "Shadow",
          options: shadowOptions,
        },
        overlayOpacity: {
          type: "number",
          label: "Overlay opacity (if background image)",
          min: 0,
          max: 100,
        },
        content: {
          type: "slot",
          label: "Content",
        },
      },
      render: ({ content, ...props }) => (
        <Section {...props}>{content?.({})}</Section>
      ),
    },

    // CONTENT
    Heading: {
      label: "Heading",
      defaultProps: {
        text: "A fresh heading",
        level: "h2",
        size: "xl",
        align: "left",
      },
      fields: {
        text: {
          type: "text",
          label: "Text",
        },
        level: {
          type: "select",
          label: "Heading level",
          options: headingLevelOptions,
        },
        size: {
          type: "select",
          label: "Size",
          options: headingSizeOptions,
        },
        align: {
          type: "select",
          label: "Alignment",
          options: alignmentOptions,
        },
        eyebrow: {
          type: "text",
          label: "Eyebrow",
        },
      },
      render: ({ text, ...props }) => <Heading {...props}>{text}</Heading>,
    },

    Text: {
      label: "Paragraph",
      defaultProps: {
        text: "Add some supporting copy to explain your story.",
        size: "base",
        align: "left",
        tone: "default",
      },
      fields: {
        text: {
          type: "textarea",
          label: "Text",
        },
        size: {
          type: "select",
          label: "Size",
          options: textSizeOptions,
        },
        align: {
          type: "select",
          label: "Alignment",
          options: alignmentOptions,
        },
        tone: {
          type: "select",
          label: "Tone",
          options: textToneOptions,
        },
      },
      render: ({ text, ...props }) => <Text {...props}>{text}</Text>,
    },

    Button: {
      label: "Button",
      defaultProps: {
        label: "Call to action",
        href: "#",
        variant: "primary",
        size: "md",
        align: "left",
        newTab: false,
      },
      fields: {
        label: {
          type: "text",
          label: "Label",
        },
        href: {
          type: "text",
          label: "Link",
        },
        variant: {
          type: "select",
          label: "Style",
          options: buttonVariantOptions,
        },
        size: {
          type: "select",
          label: "Size",
          options: buttonSizeOptions,
        },
        align: {
          type: "select",
          label: "Alignment",
          options: alignmentOptions,
        },
        newTab: {
          type: "radio",
          label: "Open in",
          options: [
            { label: "Same tab", value: false },
            { label: "New tab", value: true },
          ],
        },
      },
      render: (props) => <Button {...props} />,
    },

    // BLOCKS
    Hero: {
      label: "Hero",
      defaultProps: {
        heading: "Welcome to Your Site",
        description: "Create amazing experiences with our powerful platform.",
        align: "center",
        height: "screen",
        overlayOpacity: 60,
        backgroundGradient: "custom",
      },
      fields: {
        eyebrow: {
          type: "text",
          label: "Eyebrow text",
        },
        heading: {
          type: "text",
          label: "Heading",
        },
        description: {
          type: "textarea",
          label: "Description",
        },
        backgroundGradient: {
          type: "select",
          label: "Background gradient",
          options: gradientOptions,
        },
        overlayOpacity: {
          type: "number",
          label: "Overlay opacity",
          min: 0,
          max: 100,
        },
        primaryButtonLabel: {
          type: "text",
          label: "Primary button label",
        },
        primaryButtonHref: {
          type: "text",
          label: "Primary button link",
        },
        secondaryButtonLabel: {
          type: "text",
          label: "Secondary button label",
        },
        secondaryButtonHref: {
          type: "text",
          label: "Secondary button link",
        },
        align: {
          type: "select",
          label: "Alignment",
          options: alignmentOptions,
        },
        height: {
          type: "select",
          label: "Height",
          options: [
            { label: "Full Screen", value: "screen" },
            { label: "Large", value: "large" },
            { label: "Medium", value: "medium" },
          ],
        },
      },
      render: (props) => <Hero {...props} />,
    },

    Stats: {
      label: "Stats",
      defaultProps: {
        stats: [
          {
            id: "1",
            number: "100+",
            label: "Happy Customers",
            gradient: "custom",
          },
        ],
        columns: "3",
        animated: false,
      },
      fields: {
        stats: {
          type: "array",
          label: "Stats",
          arrayFields: {
            icon: {
              type: "text",
              label: "Icon name (lucide-react)",
            },
            number: {
              type: "text",
              label: "Number",
            },
            label: {
              type: "text",
              label: "Label",
            },
            gradient: {
              type: "select",
              label: "Gradient",
              options: gradientOptions,
            },
          },
          defaultItemProps: {
            number: "0",
            label: "Metric",
            gradient: "custom",
          },
        },
        columns: {
          type: "select",
          label: "Columns",
          options: columnsOptions,
        },
        animated: {
          type: "radio",
          label: "Animated",
          options: [
            { label: "No", value: false },
            { label: "Yes", value: true },
          ],
        },
      },
      render: (props) => <Stats {...props} />,
    },

    Features: {
      label: "Features",
      defaultProps: {
        features: [
          {
            id: "1",
            title: "Feature Title",
            description: "Feature description goes here.",
          },
        ],
        columns: "3",
        iconPosition: "top",
        cardVariant: "default",
      },
      fields: {
        features: {
          type: "array",
          label: "Features",
          arrayFields: {
            icon: {
              type: "text",
              label: "Icon name (lucide-react)",
            },
            title: {
              type: "text",
              label: "Title",
            },
            description: {
              type: "textarea",
              label: "Description",
            },
          },
          defaultItemProps: {
            title: "New Feature",
            description: "Description",
          },
        },
        columns: {
          type: "select",
          label: "Columns",
          options: columnsOptions,
        },
        iconPosition: {
          type: "select",
          label: "Icon position",
          options: [
            { label: "Top", value: "top" },
            { label: "Left", value: "left" },
          ],
        },
        cardVariant: {
          type: "select",
          label: "Card style",
          options: [
            { label: "Default", value: "default" },
            { label: "Glass", value: "glass" },
            { label: "Gradient", value: "gradient" },
          ],
        },
      },
      render: (props) => <Features {...props} />,
    },

    CTA: {
      label: "Call to Action",
      defaultProps: {
        heading: "Ready to get started?",
        description: "Join thousands of satisfied customers today.",
        layout: "centered",
        backgroundGradient: "custom",
        benefits: [],
      },
      fields: {
        heading: {
          type: "text",
          label: "Heading",
        },
        description: {
          type: "textarea",
          label: "Description",
        },
        primaryButtonLabel: {
          type: "text",
          label: "Primary button label",
        },
        primaryButtonHref: {
          type: "text",
          label: "Primary button link",
        },
        secondaryButtonLabel: {
          type: "text",
          label: "Secondary button label",
        },
        secondaryButtonHref: {
          type: "text",
          label: "Secondary button link",
        },
        benefits: {
          type: "array",
          label: "Benefits",
          arrayFields: {
            text: {
              type: "text",
              label: "Benefit",
            },
          },
          getItemSummary: (item: any) => item.text || "Benefit",
        },
        layout: {
          type: "select",
          label: "Layout",
          options: [
            { label: "Centered", value: "centered" },
            { label: "Split", value: "split" },
          ],
        },
        backgroundGradient: {
          type: "select",
          label: "Background gradient",
          options: gradientOptions,
        },
      },
      render: (props) => <CTA {...props} />,
    },

    CardGrid: {
      label: "Card Grid",
      defaultProps: {
        cards: [
          {
            id: "1",
            title: "Card Title",
            description: "Card description",
          },
        ],
        columns: "3",
        cardVariant: "default",
      },
      fields: {
        cards: {
          type: "array",
          label: "Cards",
          arrayFields: {
            title: {
              type: "text",
              label: "Title",
            },
            description: {
              type: "textarea",
              label: "Description",
            },
            link: {
              type: "text",
              label: "Link URL",
            },
            linkLabel: {
              type: "text",
              label: "Link label",
            },
          },
          defaultItemProps: {
            title: "New Card",
            description: "Description",
          },
        },
        columns: {
          type: "select",
          label: "Columns",
          options: columnsOptions,
        },
        cardVariant: {
          type: "select",
          label: "Card style",
          options: [
            { label: "Default", value: "default" },
            { label: "Glass", value: "glass" },
            { label: "Gradient", value: "gradient" },
            { label: "Golden", value: "golden" },
          ],
        },
      },
      render: (props) => <CardGrid {...props} />,
    },

    Testimonial: {
      label: "Testimonial",
      defaultProps: {
        quote: "This product has transformed our business!",
        author: "John Doe",
        background: "default",
      },
      fields: {
        quote: {
          type: "textarea",
          label: "Quote",
        },
        author: {
          type: "text",
          label: "Author name",
        },
        role: {
          type: "text",
          label: "Author role",
        },
        rating: {
          type: "number",
          label: "Rating (1-5 stars)",
          min: 1,
          max: 5,
        },
        background: {
          type: "select",
          label: "Background",
          options: backgroundOptions,
        },
      },
      render: (props) => <Testimonial {...props} />,
    },

    FAQ: {
      label: "FAQ",
      defaultProps: {
        faqs: [
          {
            id: "1",
            question: "What is your return policy?",
            answer: "We offer a 30-day money-back guarantee.",
          },
        ],
      },
      fields: {
        heading: {
          type: "text",
          label: "Heading",
        },
        description: {
          type: "textarea",
          label: "Description",
        },
        faqs: {
          type: "array",
          label: "Questions",
          arrayFields: {
            question: {
              type: "text",
              label: "Question",
            },
            answer: {
              type: "textarea",
              label: "Answer",
            },
          },
          defaultItemProps: {
            question: "New question?",
            answer: "Answer here.",
          },
          getItemSummary: (item: any) => item.question || "Question",
        },
      },
      render: (props) => <FAQ {...props} />,
    },

    LogoCloud: {
      label: "Logo Cloud",
      defaultProps: {
        logos: [],
        grayscale: true,
        layout: "grid",
      },
      fields: {
        logos: {
          type: "array",
          label: "Logos",
          arrayFields: {
            name: {
              type: "text",
              label: "Company name",
            },
            link: {
              type: "text",
              label: "Link URL",
            },
          },
          defaultItemProps: {
            name: "Company",
          },
          getItemSummary: (item: any) => item.name || "Logo",
        },
        grayscale: {
          type: "radio",
          label: "Grayscale effect",
          options: [
            { label: "No", value: false },
            { label: "Yes", value: true },
          ],
        },
        layout: {
          type: "select",
          label: "Layout",
          options: [
            { label: "Grid", value: "grid" },
            { label: "Marquee", value: "marquee" },
          ],
        },
      },
      render: (props) => <LogoCloud {...props} />,
    },

    PricingTable: {
      label: "Pricing Table",
      defaultProps: {
        tiers: [
          {
            id: "1",
            name: "Basic",
            price: "$9",
            period: "per month",
            popular: false,
            features: [
              { id: "1", text: "Feature 1", included: true },
              { id: "2", text: "Feature 2", included: false },
            ],
          },
        ],
      },
      fields: {
        heading: {
          type: "text",
          label: "Heading",
        },
        description: {
          type: "textarea",
          label: "Description",
        },
        tiers: {
          type: "array",
          label: "Pricing tiers",
          arrayFields: {
            name: {
              type: "text",
              label: "Tier name",
            },
            price: {
              type: "text",
              label: "Price",
            },
            period: {
              type: "text",
              label: "Period",
            },
            popular: {
              type: "radio",
              label: "Popular",
              options: [
                { label: "No", value: false },
                { label: "Yes", value: true },
              ],
            },
            buttonLabel: {
              type: "text",
              label: "Button label",
            },
            buttonHref: {
              type: "text",
              label: "Button link",
            },
            features: {
              type: "array",
              label: "Features",
              arrayFields: {
                text: {
                  type: "text",
                  label: "Feature",
                },
                included: {
                  type: "radio",
                  label: "Included",
                  options: [
                    { label: "No", value: false },
                    { label: "Yes", value: true },
                  ],
                },
              },
              defaultItemProps: {
                text: "New feature",
                included: true,
              },
              getItemSummary: (item: any) => item.text || "Feature",
            },
          },
          defaultItemProps: {
            name: "New Tier",
            price: "$0",
            popular: false,
            features: [],
          },
          getItemSummary: (item: any) => item.name || "Tier",
        },
      },
      render: (props) => <PricingTable {...props} />,
    },

    TeamGrid: {
      label: "Team Grid",
      defaultProps: {
        members: [
          {
            id: "1",
            name: "Jane Doe",
            role: "CEO",
          },
        ],
        columns: "3",
      },
      fields: {
        members: {
          type: "array",
          label: "Team members",
          arrayFields: {
            name: {
              type: "text",
              label: "Name",
            },
            role: {
              type: "text",
              label: "Role",
            },
            bio: {
              type: "textarea",
              label: "Bio",
            },
            linkedin: {
              type: "text",
              label: "LinkedIn URL",
            },
            twitter: {
              type: "text",
              label: "Twitter URL",
            },
            email: {
              type: "text",
              label: "Email",
            },
          },
          defaultItemProps: {
            name: "Team Member",
            role: "Role",
          },
          getItemSummary: (item: any) => item.name || "Member",
        },
        columns: {
          type: "select",
          label: "Columns",
          options: columnsOptions,
        },
      },
      render: (props) => <TeamGrid {...props} />,
    },

    Newsletter: {
      label: "Newsletter",
      defaultProps: {
        heading: "Subscribe to our newsletter",
        description: "Get the latest updates delivered to your inbox.",
        placeholder: "Enter your email",
        buttonLabel: "Subscribe",
        background: "primary",
      },
      fields: {
        heading: {
          type: "text",
          label: "Heading",
        },
        description: {
          type: "textarea",
          label: "Description",
        },
        placeholder: {
          type: "text",
          label: "Input placeholder",
        },
        buttonLabel: {
          type: "text",
          label: "Button label",
        },
        privacyNotice: {
          type: "text",
          label: "Privacy notice",
        },
        background: {
          type: "select",
          label: "Background",
          options: backgroundOptions,
        },
      },
      render: (props) => <Newsletter {...props} />,
    },

    Image: {
      label: "Image",
      defaultProps: {
        image: { type: "url", url: "", alt: "" },
        aspectRatio: "auto",
        border: "none",
        shadow: "none",
        rounded: false,
      },
      fields: {
        caption: {
          type: "text",
          label: "Caption",
        },
        aspectRatio: {
          type: "select",
          label: "Aspect ratio",
          options: [
            { label: "Auto", value: "auto" },
            { label: "Square", value: "square" },
            { label: "Video (16:9)", value: "video" },
            { label: "Wide (21:9)", value: "wide" },
            { label: "Portrait (3:4)", value: "portrait" },
          ],
        },
        border: {
          type: "select",
          label: "Border",
          options: [
            { label: "None", value: "none" },
            { label: "Small", value: "sm" },
            { label: "Medium", value: "md" },
            { label: "Large", value: "lg" },
          ],
        },
        shadow: {
          type: "select",
          label: "Shadow",
          options: shadowOptions,
        },
        rounded: {
          type: "radio",
          label: "Rounded corners",
          options: [
            { label: "No", value: false },
            { label: "Yes", value: true },
          ],
        },
      },
      render: (props) => <Image {...props} />,
    },

    Spacer: {
      label: "Spacer",
      defaultProps: {
        size: "md",
      },
      fields: {
        size: {
          type: "select",
          label: "Size",
          options: paddingOptions,
        },
        customHeight: {
          type: "number",
          label: "Custom height (px)",
          min: 0,
        },
      },
      render: (props) => <Spacer {...props} />,
    },

    // ELEMENTS
    CardElement: {
      label: "Card",
      defaultProps: {
        variant: "default",
      },
      fields: {
        variant: {
          type: "select",
          label: "Variant",
          options: [
            { label: "Default", value: "default" },
            { label: "Glass", value: "glass" },
            { label: "Glass Dark", value: "glass-dark" },
            { label: "Gradient", value: "gradient" },
            { label: "Gradient Border", value: "gradient-border" },
            { label: "Animated", value: "animated" },
            { label: "Golden", value: "golden" },
          ],
        },
        content: {
          type: "slot",
          label: "Content",
        },
      },
      render: ({ content, ...props }) => <CardElement {...props} content={content} />,
    },

    BadgeElement: {
      label: "Badge",
      defaultProps: {
        text: "Badge",
        variant: "default",
      },
      fields: {
        text: {
          type: "text",
          label: "Text",
        },
        variant: {
          type: "select",
          label: "Variant",
          options: [
            { label: "Default", value: "default" },
            { label: "Secondary", value: "secondary" },
            { label: "Destructive", value: "destructive" },
            { label: "Outline", value: "outline" },
            { label: "Glass Dark", value: "glass-dark" },
            { label: "Gradient", value: "gradient" },
            { label: "Gold", value: "gold" },
            { label: "Purple", value: "purple" },
            { label: "Green", value: "green" },
          ],
        },
      },
      render: (props) => <BadgeElement {...props} />,
    },

    AlertElement: {
      label: "Alert",
      defaultProps: {
        description: "This is an alert message.",
        variant: "default",
      },
      fields: {
        title: {
          type: "text",
          label: "Title",
        },
        description: {
          type: "textarea",
          label: "Description",
        },
        variant: {
          type: "select",
          label: "Variant",
          options: [
            { label: "Default", value: "default" },
            { label: "Destructive", value: "destructive" },
          ],
        },
      },
      render: (props) => <AlertElement {...props} />,
    },

    SeparatorElement: {
      label: "Separator",
      defaultProps: {
        orientation: "horizontal",
      },
      fields: {
        orientation: {
          type: "select",
          label: "Orientation",
          options: [
            { label: "Horizontal", value: "horizontal" },
            { label: "Vertical", value: "vertical" },
          ],
        },
      },
      render: (props) => <SeparatorElement {...props} />,
    },

    AvatarElement: {
      label: "Avatar",
      defaultProps: {
        fallback: "JD",
        size: "md",
      },
      fields: {
        fallback: {
          type: "text",
          label: "Fallback text",
        },
        size: {
          type: "select",
          label: "Size",
          options: [
            { label: "Small", value: "sm" },
            { label: "Medium", value: "md" },
            { label: "Large", value: "lg" },
          ],
        },
      },
      render: (props) => <AvatarElement {...props} />,
    },

    TabsElement: {
      label: "Tabs",
      defaultProps: {
        tabs: [
          { id: "1", label: "Tab 1", content: "Content 1" },
          { id: "2", label: "Tab 2", content: "Content 2" },
        ],
      },
      fields: {
        tabs: {
          type: "array",
          label: "Tabs",
          arrayFields: {
            label: {
              type: "text",
              label: "Tab label",
            },
            content: {
              type: "textarea",
              label: "Tab content",
            },
          },
          defaultItemProps: {
            label: "New Tab",
            content: "Content",
          },
          getItemSummary: (item: any) => item.label || "Tab",
        },
      },
      render: (props) => <TabsElement {...props} />,
    },

    AccordionElement: {
      label: "Accordion",
      defaultProps: {
        items: [
          { id: "1", title: "Item 1", content: "Content 1" },
        ],
        type: "single",
      },
      fields: {
        items: {
          type: "array",
          label: "Items",
          arrayFields: {
            title: {
              type: "text",
              label: "Title",
            },
            content: {
              type: "textarea",
              label: "Content",
            },
          },
          defaultItemProps: {
            title: "New Item",
            content: "Content",
          },
          getItemSummary: (item: any) => item.title || "Item",
        },
        type: {
          type: "select",
          label: "Type",
          options: [
            { label: "Single", value: "single" },
            { label: "Multiple", value: "multiple" },
          ],
        },
      },
      render: (props) => <AccordionElement {...props} />,
    },

    ProgressElement: {
      label: "Progress",
      defaultProps: {
        value: 50,
        max: 100,
        showLabel: true,
      },
      fields: {
        value: {
          type: "number",
          label: "Value",
          min: 0,
        },
        max: {
          type: "number",
          label: "Maximum",
          min: 1,
        },
        showLabel: {
          type: "radio",
          label: "Show label",
          options: [
            { label: "No", value: false },
            { label: "Yes", value: true },
          ],
        },
      },
      render: (props) => <ProgressElement {...props} />,
    },

    SkeletonElement: {
      label: "Skeleton",
      defaultProps: {
        variant: "rectangular",
        width: "100%",
        height: "20px",
      },
      fields: {
        variant: {
          type: "select",
          label: "Variant",
          options: [
            { label: "Text", value: "text" },
            { label: "Circular", value: "circular" },
            { label: "Rectangular", value: "rectangular" },
          ],
        },
        width: {
          type: "text",
          label: "Width (CSS value)",
        },
        height: {
          type: "text",
          label: "Height (CSS value)",
        },
      },
      render: (props) => <SkeletonElement {...props} />,
    },

    CheckboxElement: {
      label: "Checkbox",
      defaultProps: {
        label: "Accept terms",
        checked: false,
      },
      fields: {
        label: {
          type: "text",
          label: "Label",
        },
        checked: {
          type: "radio",
          label: "Checked by default",
          options: [
            { label: "No", value: false },
            { label: "Yes", value: true },
          ],
        },
      },
      render: (props) => <CheckboxElement {...props} />,
    },

    InputElement: {
      label: "Input",
      defaultProps: {
        label: "Input field",
        placeholder: "Enter text",
        type: "text",
      },
      fields: {
        label: {
          type: "text",
          label: "Label",
        },
        placeholder: {
          type: "text",
          label: "Placeholder",
        },
        type: {
          type: "select",
          label: "Type",
          options: [
            { label: "Text", value: "text" },
            { label: "Email", value: "email" },
            { label: "Password", value: "password" },
            { label: "Number", value: "number" },
          ],
        },
      },
      render: (props) => <InputElement {...props} />,
    },

    TextareaElement: {
      label: "Textarea",
      defaultProps: {
        label: "Textarea field",
        placeholder: "Enter text",
        rows: 4,
      },
      fields: {
        label: {
          type: "text",
          label: "Label",
        },
        placeholder: {
          type: "text",
          label: "Placeholder",
        },
        rows: {
          type: "number",
          label: "Rows",
          min: 2,
        },
      },
      render: (props) => <TextareaElement {...props} />,
    },

    SelectElement: {
      label: "Select",
      defaultProps: {
        label: "Select field",
        placeholder: "Select an option",
        options: [
          { value: "1", label: "Option 1" },
          { value: "2", label: "Option 2" },
        ],
      },
      fields: {
        label: {
          type: "text",
          label: "Label",
        },
        placeholder: {
          type: "text",
          label: "Placeholder",
        },
        options: {
          type: "array",
          label: "Options",
          arrayFields: {
            value: {
              type: "text",
              label: "Value",
            },
            label: {
              type: "text",
              label: "Label",
            },
          },
          defaultItemProps: {
            value: "option",
            label: "Option",
          },
          getItemSummary: (item: any) => item.label || "Option",
        },
      },
      render: (props) => <SelectElement {...props} />,
    },

    SwitchElement: {
      label: "Switch",
      defaultProps: {
        label: "Enable feature",
        checked: false,
      },
      fields: {
        label: {
          type: "text",
          label: "Label",
        },
        checked: {
          type: "radio",
          label: "Checked by default",
          options: [
            { label: "No", value: false },
            { label: "Yes", value: true },
          ],
        },
      },
      render: (props) => <SwitchElement {...props} />,
    },

    TableElement: {
      label: "Table",
      defaultProps: {
        columns: [
          { id: "1", header: "Column 1" },
          { id: "2", header: "Column 2" },
        ],
        rows: [
          { id: "1", cells: ["Cell 1", "Cell 2"] },
        ],
      },
      fields: {
        columns: {
          type: "array",
          label: "Columns",
          arrayFields: {
            header: {
              type: "text",
              label: "Header",
            },
          },
          defaultItemProps: {
            header: "Column",
          },
          getItemSummary: (item: any) => item.header || "Column",
        },
        rows: {
          type: "array",
          label: "Rows",
          arrayFields: {
            cells: {
              type: "array",
              label: "Cells",
              arrayFields: {
                value: {
                  type: "text",
                  label: "Value",
                },
              },
              getItemSummary: (item: any) => item.value || "Cell",
            },
          },
          getItemSummary: (_item: any, index: number) => `Row ${index + 1}`,
        },
      },
      render: (props) => <TableElement {...props} />,
    },
  },
};
