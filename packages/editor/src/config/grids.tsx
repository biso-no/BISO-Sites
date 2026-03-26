"use client";
import {
  FeatureGrid,
  type FeatureGridProps,
  type FeatureItem,
} from "@repo/ui/components/puck/feature-grid";
import {
  LogoGrid,
  type LogoGridProps,
  type LogoItem,
} from "@repo/ui/components/puck/logo-grid";
import {
  StatsGrid,
  type StatItem,
  type StatsGridProps,
} from "@repo/ui/components/puck/stats-grid";
import {
  TeamGrid,
  type TeamGridProps,
  type TeamMember,
} from "@repo/ui/components/puck/team-grid";
import { ALIGN_OPTIONS, ICON_OPTIONS } from "../puck-tokens";

export const GridComponents = {
  FeatureGrid: {
    label: "Feature Grid",
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
        options: ALIGN_OPTIONS,
      },
      items: {
        type: "array",
        getItemSummary: (item: { title?: string }) => item.title || "Feature",
        arrayFields: {
          title: { type: "text" },
          description: { type: "textarea" },
          badge: { type: "text" },
          icon: {
            type: "select",
            options: ICON_OPTIONS,
          },
          href: { type: "link" } as any,
        },
      },
    },
    render: (props: FeatureGridProps) => <FeatureGrid {...props} />,
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
      ] as FeatureItem[],
    },
  },
  StatsGrid: {
    label: "Stats Grid",
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
        options: ALIGN_OPTIONS,
      },
      items: {
        type: "array",
        getItemSummary: (item: { label?: string }) => item.label || "Stat",
        arrayFields: {
          value: { type: "text" },
          label: { type: "text" },
          description: { type: "text" },
          icon: {
            type: "select",
            options: ICON_OPTIONS,
          },
        },
      },
    },
    render: (props: StatsGridProps) => <StatsGrid {...props} />,
    defaultProps: {
      columns: 4,
      variant: "simple",
      items: [
        { value: "100+", label: "Events" },
        { value: "50+", label: "Partners" },
        { value: "1000+", label: "Members" },
        { value: "24/7", label: "Support" },
      ] as StatItem[],
    },
  },
  TeamGrid: {
    label: "Team Grid",
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
        getItemSummary: (item: { name?: string }) => item.name || "Member",
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
    render: (props: TeamGridProps) => <TeamGrid {...props} />,
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
      ] as TeamMember[],
    },
  },
  LogoGrid: {
    label: "Logo Grid",
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
        getItemSummary: (item: { alt?: string }) => item.alt || "Logo",
        arrayFields: {
          image: { type: "image" } as any,
          alt: { type: "text" },
          href: { type: "link" } as any,
        },
      },
    },
    render: (props: LogoGridProps) => <LogoGrid {...props} />,
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
      ] as LogoItem[],
    },
  },
} as const;