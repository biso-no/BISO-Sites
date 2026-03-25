"use client";
import {
  ButtonRow,
  type ButtonRowButton,
  type ButtonRowProps,
} from "@repo/ui/components/puck/button-row";
import { Divider, type DividerProps } from "@repo/ui/components/puck/divider";
import { Heading, type HeadingProps } from "@repo/ui/components/puck/heading";
import {
  Image as PuckImage,
  type ImageProps as PuckImageProps,
} from "@repo/ui/components/puck/image";
import { Text, type TextProps } from "@repo/ui/components/puck/text";
import {
  ALIGN_OPTIONS,
  BUTTON_SIZE_OPTIONS,
  BUTTON_VARIANT_OPTIONS,
  DIVIDER_SPACING_OPTIONS,
  DIVIDER_STYLE_OPTIONS,
  HEADING_LEVEL_OPTIONS,
  HEADING_SIZE_OPTIONS,
  IMAGE_ASPECT_OPTIONS,
  IMAGE_ROUNDED_OPTIONS,
  MAX_WIDTH_OPTIONS,
  TEXT_COLUMNS_OPTIONS,
  TEXT_VARIANT_OPTIONS,
} from "../puck-tokens";

export const BasicsComponents = {
  Heading: {
    fields: {
      text: { type: "text", contentEditable: true } as any,
      level: {
        type: "select",
        options: HEADING_LEVEL_OPTIONS,
      },
      size: {
        type: "select",
        options: HEADING_SIZE_OPTIONS,
      },
      align: {
        type: "radio",
        options: ALIGN_OPTIONS,
      },
      id: { type: "text", label: "Anchor ID" },
    },
    render: (props: HeadingProps) => <Heading {...props} />,
    defaultProps: {
      text: "Heading",
      level: 2,
      size: "lg",
      align: "left",
    },
  },
  Text: {
    fields: {
      content: { type: "richtext", contentEditable: true } as any,
      variant: {
        type: "select",
        options: TEXT_VARIANT_OPTIONS,
      },
      columns: {
        type: "radio",
        options: TEXT_COLUMNS_OPTIONS,
      },
      align: {
        type: "radio",
        options: ALIGN_OPTIONS,
      },
    },
    render: (props: TextProps) => <Text {...props} />,
    defaultProps: {
      content: "<p>Write something...</p>",
      variant: "default",
      columns: 1,
      align: "left",
    },
  },
  Image: {
    fields: {
      src: { type: "image" } as any,
      alt: { type: "text" },
      caption: { type: "text" },
      aspect: {
        type: "select",
        options: IMAGE_ASPECT_OPTIONS,
      },
      rounded: {
        type: "select",
        options: IMAGE_ROUNDED_OPTIONS,
      },
      maxWidth: {
        type: "select",
        options: MAX_WIDTH_OPTIONS,
      },
      align: {
        type: "radio",
        options: ALIGN_OPTIONS,
      },
    },
    render: (props: PuckImageProps) => <PuckImage {...props} />,
    defaultProps: {
      src: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200",
      alt: "Image",
      aspect: "auto",
      rounded: "md",
      maxWidth: "default",
      align: "center",
    },
  },
  ButtonRow: {
    fields: {
      align: {
        type: "radio",
        options: ALIGN_OPTIONS,
      },
      size: {
        type: "select",
        options: BUTTON_SIZE_OPTIONS,
      },
      buttons: {
        type: "array",
        getItemSummary: (item: { label?: string }) => item.label || "Button",
        arrayFields: {
          label: { type: "text" },
          href: { type: "link" } as any,
          variant: {
            type: "select",
            options: BUTTON_VARIANT_OPTIONS,
          },
        },
        defaultItemProps: {
          label: "Button",
          href: "/",
          variant: "default",
        },
      },
    },
    render: (props: ButtonRowProps) => <ButtonRow {...props} />,
    defaultProps: {
      align: "left",
      size: "md",
      buttons: [
        { label: "Get started", href: "/", variant: "default" },
        { label: "Learn more", href: "/about", variant: "outline" },
      ] as ButtonRowButton[],
    },
  },
  Divider: {
    fields: {
      style: {
        type: "select",
        options: DIVIDER_STYLE_OPTIONS,
      },
      spacing: {
        type: "select",
        options: DIVIDER_SPACING_OPTIONS,
      },
    },
    render: (props: DividerProps) => <Divider {...props} />,
    defaultProps: {
      style: "line",
      spacing: "md",
    },
  },
} as const;
