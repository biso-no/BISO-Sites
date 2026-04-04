"use client";

import type { ComponentData, Config, Plugin } from "@puckeditor/core";
import { createUsePuck, useGetPuck } from "@puckeditor/core";

const usePuck = createUsePuck();

import { Card } from "@repo/ui/components/ui/card";
import { Label } from "@repo/ui/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/ui/radio-group";
import { LayoutTemplate, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cloneWithNewIds } from "../utils/clone-block";

type InsertMode = "append" | "replace";

interface AppwriteTemplate {
  data: { content: ComponentData[] };
  description: string;
  key: string;
  name: string;
  thumbnail?: string;
}

function buildItem(
  config: Config,
  type: string,
  props: Record<string, unknown> = {}
): ComponentData {
  return cloneWithNewIds(
    { type, props: props as any } as ComponentData,
    config
  );
}

function getDefaultProps(
  config: Config,
  type: string
): Record<string, unknown> {
  return (
    (config.components?.[type]?.defaultProps as Record<string, unknown>) ?? {}
  );
}

function getBuiltInTemplates(config: Config): AppwriteTemplate[] {
  return [
    {
      key: "department-landing",
      name: "Department Landing",
      description: "Hero + highlights, then Events and News.",
      data: {
        content: [
          buildItem(config, "Hero", {
            layout: "split",
            title: "Welcome to our department",
            subtitle: "Highlight what you do and what's happening right now.",
            buttons: [
              { label: "Join us", href: "/join", variant: "gradient" },
              { label: "Contact", href: "/contact", variant: "outline" },
            ],
          }),
          buildItem(config, "FeatureGrid", {
            title: "What we do",
            subtitle: "A few quick highlights to introduce your team.",
            columns: 3,
            variant: "icon",
            align: "center",
            items: [
              {
                title: "Build community",
                description:
                  "Create spaces for students to connect and thrive.",
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
          buildItem(config, "Events", getDefaultProps(config, "Events")),
          buildItem(config, "News", getDefaultProps(config, "News")),
          buildItem(config, "CTA", {
            title: "Want to get involved?",
            description:
              "Become part of the team and help shape the community.",
            variant: "brand",
            align: "center",
            buttons: [
              {
                label: "Apply now",
                href: "/jobs",
                variant: "secondary",
              },
            ],
          }),
        ],
      },
    },
    {
      key: "events-listing",
      name: "Events Listing",
      description: "Page header + filters + a larger dynamic Events section.",
      data: {
        content: (() => {
          const defaults = getDefaultProps(config, "Events");
          const dataSource =
            (defaults.dataSource as Record<string, unknown>) ?? {};

          return [
            buildItem(config, "PageHeader", {
              title: "Events",
              subtitle: "Explore upcoming events and activities.",
              variant: "centered",
              breadcrumbs: [{ label: "Events", href: "/events" }],
            }),
            buildItem(
              config,
              "FilterBar",
              getDefaultProps(config, "FilterBar")
            ),
            buildItem(config, "Events", {
              ...defaults,
              dataMode: "dynamic",
              scope: "page",
              dataSource: {
                ...dataSource,
                table: "events",
                limit: 12,
              },
            }),
            buildItem(config, "Spacer", { size: "md" }),
          ];
        })(),
      },
    },
    {
      key: "info-legal",
      name: "Info / Legal",
      description: "Header + table of contents + rich text.",
      data: {
        content: [
          buildItem(config, "PageHeader", {
            title: "Information",
            subtitle:
              "A structured page for policies, bylaws, or documentation.",
            variant: "default",
            breadcrumbs: [{ label: "Information" }],
          }),
          buildItem(
            config,
            "TableOfContents",
            getDefaultProps(config, "TableOfContents")
          ),
          buildItem(config, "RichText", getDefaultProps(config, "RichText")),
          buildItem(config, "Spacer", { size: "md" }),
        ],
      },
    },
  ];
}

async function fetchTemplates(config: Config): Promise<AppwriteTemplate[]> {
  try {
    // TODO: Replace with actual Appwrite fetch when API endpoint is available
    // const response = await fetch("/api/templates");
    // const templates = await response.json();
    // return templates;

    // Fallback to built-in templates
    return getBuiltInTemplates(config);
  } catch {
    return getBuiltInTemplates(config);
  }
}

function TemplatesPanel() {
  const config = usePuck((s) => s.config);
  const contentLength = usePuck((s) => s.appState.data.content?.length ?? 0);
  const getPuck = useGetPuck();
  const [mode, setMode] = useState<InsertMode>("append");
  const [templates, setTemplates] = useState<AppwriteTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    fetchTemplates(config).then((result) => {
      if (!cancelled) {
        setTemplates(result);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [config]);

  const insertTemplate = (template: AppwriteTemplate) => {
    const { config: currentConfig, dispatch, selectedItem } = getPuck();
    const blocks = template.data.content.map((item) =>
      cloneWithNewIds(item, currentConfig)
    );
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

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground text-sm">
            Loading templates...
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {templates.map((template) => (
            <Card
              className="cursor-pointer transition-colors hover:border-primary"
              key={template.key}
              onClick={() => insertTemplate(template)}
            >
              {template.thumbnail && (
                <div className="aspect-video w-full overflow-hidden rounded-t-lg bg-gray-100">
                  <img
                    alt={template.name}
                    className="h-full w-full object-cover"
                    src={template.thumbnail}
                  />
                </div>
              )}
              <div className="p-3">
                <div className="font-medium text-foreground text-sm">
                  {template.name}
                </div>
                <div className="mt-1 text-muted-foreground text-xs">
                  {template.description}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="text-muted-foreground text-xs">
        Current blocks: {contentLength}
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
