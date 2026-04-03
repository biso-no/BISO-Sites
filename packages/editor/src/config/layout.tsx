"use client";
import { registerOverlayPortal } from "@puckeditor/core";
import { Columns, type ColumnsProps } from "@repo/ui/components/puck/columns";
import { Section } from "@repo/ui/components/puck/section";
import { Spacer, type SpacerProps } from "@repo/ui/components/puck/spacer";
import { Tabs, type TabsProps } from "@repo/ui/components/puck/tabs";
import { useEffect, useRef } from "react";
import {
  MAX_WIDTH_OPTIONS,
  PADDING_OPTIONS,
  SECTION_BG_OPTIONS,
} from "../puck-tokens";
import type {
  ColumnsPropsWithSlots,
  SectionPropsWithSlot,
  TabsPropsWithSlots,
} from "./types";
import { resolveComponentPermissions } from "./utils";

export const LayoutComponents = {
  Section: {
    label: "Section",
    resolvePermissions: resolveComponentPermissions,
    fields: {
      backgroundColor: {
        type: "select",
        options: SECTION_BG_OPTIONS,
      },
      padding: {
        type: "select",
        options: PADDING_OPTIONS,
      },
      maxWidth: {
        type: "select",
        options: MAX_WIDTH_OPTIONS,
      },
      id: { type: "text" },
      content: { type: "slot" },
    },
    render: ({ content: Content, ...props }: SectionPropsWithSlot) => (
      <Section {...props}>{Content && <Content />}</Section>
    ),
    defaultProps: {
      backgroundColor: "white",
      padding: "md",
      maxWidth: "default",
    },
  },
  Columns: {
    label: "Columns",
    resolvePermissions: resolveComponentPermissions,
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
    }: ColumnsPropsWithSlots) => {
      const colCount = layout.split(":").length;
      return (
        <Columns layout={layout} {...(props as ColumnsProps)}>
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
  Spacer: {
    label: "Spacer",
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
    render: (props: SpacerProps) => <Spacer {...props} />,
    defaultProps: {
      size: "md",
    },
  },
  Tabs: {
    label: "Tabs",
    fields: {
      tabs: {
        type: "array",
        getItemSummary: (item: { label?: string }) => item.label || "Tab",
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
    }: TabsPropsWithSlots) => {
      const ref = useRef<HTMLDivElement>(null);
      useEffect(() => registerOverlayPortal(ref.current), []);
      return (
        <Tabs
          ref={ref as any}
          {...(props as TabsProps)}
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
      ] as { label: string; value: string }[],
    },
  },
} as const;
