"use client";

import type { Plugin } from "@puckeditor/core";
import { createUsePuck, useGetPuck } from "@puckeditor/core";

const usePuck = createUsePuck();
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Label } from "@repo/ui/components/ui/label";
import { Switch } from "@repo/ui/components/ui/switch";
import { Database, Table } from "lucide-react";
import { useCallback, useMemo } from "react";
import { TABLE_SCHEMAS } from "../data/schemas";
import type { EditorMetadata } from "../config/types";

/**
 * Root-level data source configuration stored in root.props._dataSources.
 * Keys are table IDs from TABLE_SCHEMAS.
 */
type DataSourceConfig = {
  enabled: boolean;
  label: string;
};

type DataSourcesMap = Record<string, DataSourceConfig>;

function DataSourcesPanel() {
  const appState = usePuck((s) => s.appState);
  const getPuck = useGetPuck();
  const metadata = (appState as { metadata?: EditorMetadata }).metadata;

  const isAdmin = metadata?.user?.isGlobalAdmin ?? false;
  const isCampusAdmin = metadata?.user?.isCampusAdmin ?? false;

  // Read current data source config from root props
  const dataSources: DataSourcesMap = useMemo(
    () =>
      ((appState.data.root?.props as Record<string, unknown>)?._dataSources ??
        {}) as DataSourcesMap,
    [appState.data.root?.props]
  );

  // Filter available schemas based on user permissions
  const availableSchemas = useMemo(() => {
    if (isAdmin) return TABLE_SCHEMAS;
    // Campus admins can see most tables
    if (isCampusAdmin) return TABLE_SCHEMAS;
    // Regular editors see a subset
    return TABLE_SCHEMAS.filter((s) =>
      ["news", "events", "jobs", "departments"].includes(s.id)
    );
  }, [isAdmin, isCampusAdmin]);

  const toggleSource = useCallback(
    (tableId: string, label: string, enabled: boolean) => {
      const { dispatch } = getPuck();
      dispatch({
        type: "setData",
        recordHistory: true,
        data: (previous) => {
          const prev = ((previous.root?.props as Record<string, unknown>)
            ?._dataSources ?? {}) as DataSourcesMap;
          const next: DataSourcesMap = {
            ...prev,
            [tableId]: { enabled, label },
          };
          return {
            ...previous,
            root: {
              ...previous.root,
              props: {
                ...(previous.root?.props ?? {}),
                _dataSources: next,
              },
            },
          };
        },
      });
    },
    [getPuck]
  );

  const enabledCount = Object.values(dataSources).filter(
    (ds) => ds.enabled
  ).length;

  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="flex items-center gap-2">
          <div className="text-lg font-semibold text-foreground">
            Data Sources
          </div>
          {enabledCount > 0 && (
            <Badge variant="secondary">{enabledCount} active</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Connect this page to live data from your collections. Data-display
          blocks on this page will pull from enabled sources.
        </p>
      </div>

      <div className="grid gap-2">
        {availableSchemas.map((schema) => {
          const current = dataSources[schema.id];
          const enabled = current?.enabled ?? false;

          return (
            <Card className="flex items-center gap-3 p-3" key={schema.id}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-100">
                <Table className="h-4 w-4 text-gray-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">
                  {schema.label}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {schema.description}
                </div>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={(checked) =>
                  toggleSource(schema.id, schema.label, checked)
                }
              />
            </Card>
          );
        })}
      </div>

      {enabledCount === 0 && (
        <p className="text-center text-xs text-muted-foreground">
          No data sources enabled. Toggle a source above to connect live data.
        </p>
      )}
    </div>
  );
}

export const dataSourcesPlugin: Plugin = {
  name: "data-sources",
  label: "Data Sources",
  icon: <Database size={18} />,
  render: () => <DataSourcesPanel />,
};
