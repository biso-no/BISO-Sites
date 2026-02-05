"use client";

import type { ComponentData, Config, Plugin } from "@puckeditor/core";
import { usePuck } from "@puckeditor/core";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Label } from "@repo/ui/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/ui/radio-group";
import { LayoutTemplate } from "lucide-react";
import { useMemo, useState } from "react";

type InsertMode = "append" | "replace";

function createId(prefix: string): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${uuid}`;
}

function isComponentData(value: unknown): value is ComponentData {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    "type" in (value as Record<string, unknown>) &&
    "props" in (value as Record<string, unknown>) &&
    typeof (value as { type?: unknown }).type === "string" &&
    Boolean((value as { props?: unknown }).props) &&
    typeof (value as { props?: unknown }).props === "object"
  );
}

function cloneWithNewIds(item: ComponentData, config: Config): ComponentData {
  const defaultProps =
    (config.components?.[item.type]?.defaultProps as Record<string, unknown>) ??
    {};

  const nextProps = {
    ...defaultProps,
    ...(item.props as Record<string, unknown>),
    id: createId(item.type),
  };

  const remap = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(remap);
    }

    if (isComponentData(value)) {
      return cloneWithNewIds(value, config);
    }

    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      const entries = Object.entries(record).map(([key, val]) => [
        key,
        remap(val),
      ]);
      return Object.fromEntries(entries);
    }

    return value;
  };

  const mappedProps = remap(nextProps) as ComponentData["props"];

  return {
    ...item,
    props: mappedProps,
  };
}

function buildItem(
  config: Config,
  type: string,
  props: Record<string, unknown> = {}
): ComponentData {
  return cloneWithNewIds({ type, props: props as any } as ComponentData, config);
}

type Template = {
  key: string;
  name: string;
  description: string;
  build: (config: Config) => ComponentData[];
};

function getDefaultProps(config: Config, type: string): Record<string, unknown> {
  return (
    (config.components?.[type]?.defaultProps as Record<string, unknown>) ?? {}
  );
}

function TemplatesPanel() {
  const { appState, config, dispatch, selectedItem } = usePuck();
  const [mode, setMode] = useState<InsertMode>("append");

  const templates: Template[] = useMemo(
    () => [
      {
        key: "department-landing",
        name: "Department Landing",
        description: "Hero + highlights, then Events and News.",
        build: (cfg) => [
          buildItem(cfg, "Hero", {
            layout: "split",
            title: "Welcome to our department",
            subtitle: "Highlight what you do and what's happening right now.",
            buttons: [
              { label: "Join us", href: "/join", variant: "gradient" },
              { label: "Contact", href: "/contact", variant: "outline" },
            ],
          }),
          buildItem(cfg, "FeatureGrid", {
            title: "What we do",
            subtitle: "A few quick highlights to introduce your team.",
            columns: 3,
            variant: "icon",
            align: "center",
            items: [
              {
                title: "Build community",
                description: "Create spaces for students to connect and thrive.",
                icon: "Users",
              },
              {
                title: "Run events",
                description: "Organize memorable experiences all year long.",
                icon: "Calendar",
              },
              {
                title: "Create opportunities",
                description: "Projects, partners, and career development.",
                icon: "Briefcase",
              },
            ],
          }),
          buildItem(cfg, "Events", getDefaultProps(cfg, "Events")),
          buildItem(cfg, "News", getDefaultProps(cfg, "News")),
          buildItem(cfg, "CTA", {
            title: "Want to get involved?",
            description: "Become part of the team and help shape the community.",
            variant: "brand",
            align: "center",
            buttons: [{ label: "Apply now", href: "/jobs", variant: "secondary" }],
          }),
        ],
      },
      {
        key: "events-listing",
        name: "Events Listing",
        description: "Page header + filters + a larger dynamic Events section.",
        build: (cfg) => {
          const defaults = getDefaultProps(cfg, "Events");
          const dataSource = (defaults.dataSource as Record<string, unknown>) ?? {};

          return [
            buildItem(cfg, "PageHeader", {
              title: "Events",
              subtitle: "Explore upcoming events and activities.",
              variant: "centered",
              breadcrumbs: [{ label: "Events", href: "/events" }],
            }),
            buildItem(cfg, "FilterBar", getDefaultProps(cfg, "FilterBar")),
            buildItem(cfg, "Events", {
              ...defaults,
              dataMode: "dynamic",
              scope: "page",
              dataSource: {
                ...dataSource,
                table: "events",
                limit: 12,
              },
            }),
            buildItem(cfg, "Spacer", { size: "md" }),
          ];
        },
      },
      {
        key: "info-legal",
        name: "Info / Legal",
        description: "Header + table of contents + rich text.",
        build: (cfg) => [
          buildItem(cfg, "PageHeader", {
            title: "Information",
            subtitle: "A structured page for policies, bylaws, or documentation.",
            variant: "default",
            breadcrumbs: [{ label: "Information" }],
          }),
          buildItem(cfg, "TableOfContents", getDefaultProps(cfg, "TableOfContents")),
          buildItem(cfg, "RichText", getDefaultProps(cfg, "RichText")),
          buildItem(cfg, "Spacer", { size: "md" }),
        ],
      },
    ],
    []
  );

  const insertTemplate = (template: Template) => {
    const blocks = template.build(config);
    const selectedId =
      (selectedItem?.props as { id?: string } | undefined)?.id ?? null;

    if (mode === "replace") {
      dispatch({
        type: "setData",
        recordHistory: true,
        data: (previous) => ({
          ...previous,
          root: previous.root,
          content: blocks,
        }),
      });
      return;
    }

    dispatch({
      type: "setData",
      recordHistory: true,
      data: (previous) => {
        const current = previous.content ?? [];
        const index =
          selectedId === null
            ? -1
            : current.findIndex((item) => item.props?.id === selectedId);
        const insertIndex = index >= 0 ? index + 1 : current.length;

        return {
          ...previous,
          root: previous.root,
          content: [
            ...current.slice(0, insertIndex),
            ...blocks,
            ...current.slice(insertIndex),
          ],
        };
      },
    });
  };

  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="font-semibold text-foreground text-lg">Templates</div>
        <div className="text-muted-foreground text-sm">
          Insert a ready-made section layout, then customize it.
        </div>
      </div>

      <div className="space-y-2">
        <Label>Insertion mode</Label>
        <RadioGroup
          onValueChange={(v) => setMode(v as InsertMode)}
          value={mode}
        >
          <Label className="flex items-center gap-2 font-normal">
            <RadioGroupItem value="append" />
            Append (recommended)
          </Label>
          <Label className="flex items-center gap-2 font-normal">
            <RadioGroupItem value="replace" />
            Replace page content
          </Label>
        </RadioGroup>
      </div>

      <div className="grid gap-3">
        {templates.map((template) => (
          <Card className="space-y-2 p-4" key={template.key}>
            <div className="font-medium text-foreground">{template.name}</div>
            <div className="text-muted-foreground text-sm">
              {template.description}
            </div>
            <div className="pt-2">
              <Button onClick={() => insertTemplate(template)} size="sm">
                Insert
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="text-muted-foreground text-xs">
        Current blocks: {appState.data.content?.length ?? 0}
      </div>
    </div>
  );
}

export const templatesPlugin: Plugin = {
  name: "templates",
  label: "Templates",
  icon: <LayoutTemplate size={18} />,
  render: () => <TemplatesPanel />,
};

