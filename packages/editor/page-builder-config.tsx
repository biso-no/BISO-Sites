import { cn } from "@repo/ui/lib/utils";
import type { Config } from "@measured/puck";
import { Section } from "./components/section";
import { Heading } from "./components/heading";
import { Text } from "./components/text";
import { Button } from "./components/button";
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

const sectionOptions = {
  background: (
    [
      { label: "White", value: "default" },
      { label: "Muted", value: "muted" },
      { label: "Primary", value: "primary" },
    ] satisfies { label: string; value: SectionBackground }[]
  ),
  padding: (
    [
      { label: "None", value: "none" },
      { label: "Small", value: "sm" },
      { label: "Medium", value: "md" },
      { label: "Large", value: "lg" },
    ] satisfies { label: string; value: SectionPadding }[]
  ),
  width: (
    [
      { label: "Default", value: "default" },
      { label: "Wide", value: "lg" },
      { label: "Extra wide", value: "xl" },
      { label: "Full", value: "full" },
    ] satisfies { label: string; value: SectionWidth }[]
  ),
  align: (
    [
      { label: "Left", value: "left" },
      { label: "Center", value: "center" },
    ] satisfies { label: string; value: ContentAlignment }[]
  ),
};

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

const alignmentOptions = (
  ["left", "center"] as ContentAlignment[]
).map((value) => ({ label: value.replace(/^[a-z]/, (c) => c.toUpperCase()), value }));

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
    layout: {
      title: "Layout",
      components: ["Section"],
    },
    content: {
      title: "Content",
      components: ["Heading", "Text"],
    },
    actions: {
      title: "Actions",
      components: ["Button"],
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
        options: sectionOptions.background,
      },
      spacing: {
        type: "select",
        label: "Vertical spacing",
        options: sectionOptions.padding,
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
    Section: {
      label: "Section",
      defaultProps: {
        background: "default",
        padding: "md",
        width: "default",
        align: "left",
      },
      fields: {
        id: {
          type: "text",
          label: "Anchor ID",
        },
        background: {
          type: "select",
          label: "Background",
          options: sectionOptions.background,
        },
        padding: {
          type: "select",
          label: "Padding",
          options: sectionOptions.padding,
        },
        width: {
          type: "select",
          label: "Content width",
          options: sectionOptions.width,
        },
        align: {
          type: "select",
          label: "Content alignment",
          options: sectionOptions.align,
        },
        content: {
          type: "slot",
          label: "Content",
          allow: ["Heading", "Text", "Button"],
        },
      },
      render: ({ content, ...props }) => (
        <Section {...props}>{content?.({})}</Section>
      ),
    },
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
  },
};
