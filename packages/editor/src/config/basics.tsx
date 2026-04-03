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
import type { VideoEmbedProps } from "./types";

export const BasicsComponents = {
  Heading: {
    label: "Heading",
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
    label: "Text",
    fields: {
      content: { type: "richtext", contentEditable: true },
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
    label: "Image",
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
    label: "Button Row",
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
    label: "Divider",
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
  VideoEmbed: {
    label: "Video Embed",
    fields: {
      url: { type: "text", label: "Video URL (YouTube or Vimeo)" },
      aspect: {
        type: "select",
        options: [
          { label: "16:9", value: "16:9" },
          { label: "4:3", value: "4:3" },
          { label: "1:1", value: "1:1" },
        ],
      },
      caption: { type: "text" },
      autoplay: {
        type: "radio",
        options: [
          { label: "Yes", value: true },
          { label: "No", value: false },
        ],
      },
    },
    render: ({ url, aspect, caption, autoplay }: VideoEmbedProps) => {
      const getEmbedUrl = (raw: string | undefined): string | null => {
        if (!raw) return null;
        // YouTube
        const ytMatch = raw.match(
          /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/
        );
        if (ytMatch?.[1]) {
          return `https://www.youtube.com/embed/${ytMatch[1]}${autoplay ? "?autoplay=1&mute=1" : ""}`;
        }
        // Vimeo
        const vimeoMatch = raw.match(/(?:vimeo\.com\/)(\d+)/);
        if (vimeoMatch?.[1]) {
          return `https://player.vimeo.com/video/${vimeoMatch[1]}${autoplay ? "?autoplay=1&muted=1" : ""}`;
        }
        // Already an embed URL or other
        return raw;
      };

      const embedUrl = getEmbedUrl(url);
      const aspectClass =
        aspect === "4:3"
          ? "aspect-[4/3]"
          : aspect === "1:1"
            ? "aspect-square"
            : "aspect-video";

      return (
        <div className="w-full max-w-4xl mx-auto px-4 py-4">
          <div
            className={`relative w-full ${aspectClass} rounded-xl overflow-hidden bg-gray-100 shadow-md`}
          >
            {embedUrl ? (
              <iframe
                src={embedUrl}
                title={caption || "Video"}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                <svg
                  className="h-16 w-16 mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z"
                  />
                </svg>
                <span className="text-sm">Paste a YouTube or Vimeo URL</span>
              </div>
            )}
          </div>
          {caption && (
            <p className="mt-3 text-center text-sm text-gray-500">{caption}</p>
          )}
        </div>
      );
    },
    defaultProps: {
      url: "",
      aspect: "16:9",
      caption: "",
      autoplay: false,
    },
  },
} as const;
