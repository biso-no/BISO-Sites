"use client";
import {
  AccordionBlock,
  type AccordionBlockProps,
  type AccordionItemProps,
} from "@repo/ui/components/puck/accordion";
import {
  RichText,
  type RichTextProps,
} from "@repo/ui/components/puck/rich-text";
import {
  TableOfContents,
  type TableOfContentsProps,
  type TocItem,
} from "@repo/ui/components/puck/table-of-contents";
import {
  Timeline,
  type TimelineItem,
  type TimelineProps,
} from "@repo/ui/components/puck/timeline";
import { ALIGN_OPTIONS, ICON_OPTIONS } from "../puck-tokens";
import { TABLE_SCHEMAS } from "../data/schemas";
import { getDynamicContent } from "../get-dynamic-content";
import type { TimelinePropsWithSlot } from "./types";

export const ContentComponents = {
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
        getItemSummary: (item: { title?: string }) => item.title || "Item",
        arrayFields: {
          title: { type: "text" },
          content: { type: "textarea" },
        },
      },
    },
    render: (props: AccordionBlockProps) => <AccordionBlock {...props} />,
    defaultProps: {
      type: "single",
      items: [
        { title: "Question 1", content: "Answer to question 1." },
        { title: "Question 2", content: "Answer to question 2." },
      ] as AccordionItemProps[],
    },
  },
  Timeline: {
    resolveFields: (data: any) => {
      const fields: any = {
        title: { type: "text", contentEditable: true } as any,
        subtitle: { type: "textarea", contentEditable: true },
        align: {
          type: "radio",
          options: ALIGN_OPTIONS,
        },
        mode: {
          type: "select",
          options: [
            { label: "Alternating", value: "alternating" },
            { label: "Left Aligned", value: "left" },
            { label: "Right Aligned", value: "right" },
          ],
        },
        dataMode: {
          type: "radio",
          label: "Data Source",
          options: [
            { label: "Manual", value: "manual" },
            { label: "Dynamic", value: "dynamic" },
          ],
        },
      };

      if (data.props.dataMode === "dynamic") {
        fields.dataSource = {
          type: "data-source",
          label: "Milestones Source",
          schemas: TABLE_SCHEMAS.filter((s) => s.id === "milestones"),
          showSort: false,
          showLimit: true,
          maxLimit: 50,
        };
      } else {
        fields.items = {
          type: "array",
          getItemSummary: (item: any) => item.title || "Timeline Item",
          arrayFields: {
            date: { type: "text" },
            title: { type: "text" },
            description: { type: "textarea" },
            image: { type: "image" },
            icon: {
              type: "select",
              options: ICON_OPTIONS,
            },
          },
          defaultItemProps: {
            date: "2024",
            title: "New Milestone",
            description: "Description",
            icon: "Sparkles",
          },
        };
      }

      return fields;
    },
    resolveData: async (
      { props }: { props: TimelinePropsWithSlot },
      { changed, trigger, metadata }: any
    ) => {
      const { dataMode, dataSource } = props;
      const resolvedProps: Partial<TimelinePropsWithSlot> = {};

      const shouldResolve =
        trigger === "insert" ||
        trigger === "load" ||
        trigger === "force" ||
        trigger === "move" ||
        Boolean(changed.dataMode || changed.dataSource);

      if (!shouldResolve) {
        return { props: {} };
      }

      if (dataMode === "dynamic" && dataSource) {
        try {
          const locale =
            (metadata as { locale?: string })?.locale ?? dataSource.locale;
          const items = await getDynamicContent({
            ...dataSource,
            table: "milestones",
            locale,
          });
          resolvedProps.items = items.map((item) => ({
            date: item.date || "",
            title: item.title,
            description: item.description || "",
            image: item.image,
            icon: item.icon,
          }));
        } catch (e) {
          console.error("Failed to resolve timeline items", e);
        }
      }

      return { props: resolvedProps };
    },
    render: (props: TimelineProps) => <Timeline {...props} />,
    defaultProps: {
      title: "Our History",
      subtitle: "A timeline of our journey and milestones.",
      align: "center",
      mode: "alternating",
      dataMode: "manual",
      items: [
        {
          date: "2024",
          title: "Milestone 1",
          description: "Description of the milestone.",
          icon: "Rocket",
        },
        {
          date: "2023",
          title: "Milestone 2",
          description: "Description of the milestone.",
          icon: "Trophy",
        },
      ] as TimelineItem[],
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
    render: (props: RichTextProps) => <RichText {...props} />,
    defaultProps: {
      content:
        "## Section Title\n\nThis is a paragraph of text. You can use **bold** and *italic* formatting.\n\n### Subsection\n\n- List item 1\n- List item 2\n- List item 3\n\nLearn more at [our website](https://example.com).",
      variant: "default",
      columns: 1,
    },
  },
  TableOfContents: {
    fields: {
      title: { type: "text" },
      items: {
        type: "array",
        getItemSummary: (item: { title?: string }) => item.title || "Section",
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
    render: (props: TableOfContentsProps) => <TableOfContents {...props} />,
    defaultProps: {
      title: "Table of Contents",
      items: [
        { title: "Introduction", anchor: "introduction", level: 1 },
        { title: "Data Collection", anchor: "data-collection", level: 1 },
        { title: "Personal Information", anchor: "personal-info", level: 2 },
        { title: "Your Rights", anchor: "your-rights", level: 1 },
        { title: "Contact Us", anchor: "contact", level: 1 },
      ] as TocItem[],
      variant: "card",
      showIcon: true,
    },
  },
} as const;