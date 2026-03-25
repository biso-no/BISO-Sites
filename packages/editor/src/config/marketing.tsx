"use client";
import { CTA, type CTAButton, type CTAProps } from "@repo/ui/components/puck/cta";
import {
  About,
  type AboutProps,
  type AboutStat,
  type AboutValue,
} from "@repo/ui/components/sections/about";
import {
  JoinUs,
  type JoinUsBenefit,
  type JoinUsDuration,
} from "@repo/ui/components/sections/join-us";
import { ALIGN_OPTIONS, GRADIENT_OPTIONS } from "../puck-tokens";
import type { EditorJoinUsProps } from "./types";

export const MarketingComponents = {
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
        options: ALIGN_OPTIONS,
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
    render: (props: CTAProps) => <CTA {...props} />,
    defaultProps: {
      title: "Ready to join?",
      description: "Get started today.",
      variant: "brand",
      buttons: [{ label: "Join Now", href: "/join", variant: "white" }] as CTAButton[],
    },
  },
  About: {
    resolveFields: (data: any, { metadata }: any): any => {
      const isGlobalAdmin = Boolean(
        (metadata as { user?: { isGlobalAdmin?: boolean } })?.user
          ?.isGlobalAdmin
      );

      const currentGradients = Array.isArray((data.props as any).values)
        ? ((data.props as any).values as any[])
            .map((v) => (typeof v?.gradient === "string" ? v.gradient : null))
            .filter(Boolean)
        : [];

      const extraGradientOptions = currentGradients
        .filter(
          (value: string) =>
            !GRADIENT_OPTIONS.some((opt) => opt.value === value)
        )
        .map((value: string) => ({
          label: `Custom: ${value}`,
          value,
        }));

      const gradientOptions = [...GRADIENT_OPTIONS, ...extraGradientOptions];

      return {
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
            gradient: isGlobalAdmin
              ? { type: "text", label: "Gradient (classes)" }
              : { type: "select", options: gradientOptions },
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
      };
    },
    render: (props: AboutProps) => <About {...props} />,
    defaultProps: {
      stats: [
        { number: "100+", label: "Events", iconName: "Calendar" },
        { number: "50+", label: "Jobs", iconName: "Briefcase" },
        { number: "20+", label: "Societies", iconName: "Rocket" },
      ] as AboutStat[],
      values: [
        {
          title: "Impact",
          description: "We make an impact.",
          iconName: "Megaphone",
          gradient: "from-[#3DA9E0] to-[#001731]",
        },
      ] as AboutValue[],
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
    resolveFields: (data: any, { metadata }: any): any => {
      const isGlobalAdmin = Boolean(
        (metadata as { user?: { isGlobalAdmin?: boolean } })?.user
          ?.isGlobalAdmin
      );

      const currentGradients = Array.isArray((data.props as any).durations)
        ? ((data.props as any).durations as any[])
            .map((v) => (typeof v?.gradient === "string" ? v.gradient : null))
            .filter(Boolean)
        : [];

      const extraGradientOptions = currentGradients
        .filter(
          (value: string) =>
            !GRADIENT_OPTIONS.some((opt) => opt.value === value)
        )
        .map((value: string) => ({
          label: `Custom: ${value}`,
          value,
        }));

      const gradientOptions = [...GRADIENT_OPTIONS, ...extraGradientOptions];

      return {
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
            feature: { type: "text" },
          },
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
            gradient: isGlobalAdmin
              ? { type: "text", label: "Gradient (classes)" }
              : { type: "select", options: gradientOptions },
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
      };
    },
    render: (props: EditorJoinUsProps) => {
      const componentProps = {
        ...props,
        memberFeatures:
          props.memberFeatures?.map((f: { feature: string }) => f.feature) ||
          [],
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
      memberFeatures: [{ feature: "Event Access" }, { feature: "Discounts" }] as { feature: string }[],
      benefits: [{ text: "Social Events", iconName: "Sparkles" }] as JoinUsBenefit[],
      durations: [
        {
          name: "1 Year",
          price: "200 NOK",
          period: "/year",
          popular: true,
          gradient: "from-purple-600 to-pink-600",
        },
      ] as JoinUsDuration[],
      cta: {
        title: "Not sure?",
        subtitle: "Contact us.",
        buttonText: "Contact",
      },
    },
  },
} as const;