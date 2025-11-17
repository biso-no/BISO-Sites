"use client";

import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { PageStatus, PageVisibility } from "@repo/api/types/appwrite";
import type { PageRecord } from "@repo/api/page-builder";

const STATUS_OPTIONS: PageStatus[] = [
  PageStatus.DRAFT,
  PageStatus.PUBLISHED,
  PageStatus.ARCHIVED,
];

const VISIBILITY_OPTIONS: PageVisibility[] = [
  PageVisibility.PUBLIC,
  PageVisibility.AUTHENTICATED,
];

interface GlobalSettingsSidebarProps {
  page: PageRecord;
  onUpdate: (changes: Partial<PageRecord>) => void;
  updating?: boolean;
}

export function GlobalSettingsSidebar({
  page,
  onUpdate,
  updating = false,
}: GlobalSettingsSidebarProps) {
  return (
    <aside className="glass-panel flex h-full w-[320px] flex-col gap-6 overflow-y-auto rounded-lg border border-primary/10 p-5">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Page Settings</h3>
        <p className="text-xs text-muted-foreground">
          Global settings that apply to all locales
        </p>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="global-slug">Page Slug</Label>
          <Input
            id="global-slug"
            value={page.slug}
            onChange={(e) => {
              // Update local state immediately
              onUpdate({ slug: e.target.value });
            }}
            onBlur={(e) => {
              // Persist to server on blur
              onUpdate({ slug: e.target.value || page.slug });
            }}
            placeholder="page-slug"
            disabled={updating}
          />
          <p className="text-xs text-muted-foreground">
            Base URL path for this page
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="global-status">Status</Label>
          <Select
            value={page.status}
            onValueChange={(value: PageStatus) => onUpdate({ status: value })}
            disabled={updating}
          >
            <SelectTrigger id="global-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Page publication status
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="global-visibility">Visibility</Label>
          <Select
            value={page.visibility}
            onValueChange={(value: PageVisibility) =>
              onUpdate({ visibility: value })
            }
            disabled={updating}
          >
            <SelectTrigger id="global-visibility">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VISIBILITY_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === "public" ? "Public" : "Members only"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Who can access this page
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="global-template">Template Key</Label>
          <Input
            id="global-template"
            value={page.template ?? ""}
            placeholder="Optional template identifier"
            onChange={(e) => {
              onUpdate({ template: e.target.value || null });
            }}
            onBlur={(e) => {
              onUpdate({ template: e.target.value || null });
            }}
            disabled={updating}
          />
          <p className="text-xs text-muted-foreground">
            Optional template override
          </p>
        </div>
      </div>
    </aside>
  );
}

