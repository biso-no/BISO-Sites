"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import {
  Building2,
  Eye,
  Globe,
  MessageSquare,
  Users,
  Users2,
} from "lucide-react";
import type { ReactNode } from "react";
import { AnimatedBadge } from "@/components/shared/animated-badge";
import { GlassCard } from "@/components/shared/glass-card";
import { LogoUploadPreview } from "./logo-upload-preview";

type DepartmentEditorSidebarProps = {
  departmentName: string;
  logoUrl?: string;
  onLogoChange: (url: string) => void;
  statusControl: ReactNode;
  campusControl: ReactNode;
  typeControl: ReactNode;
  stats?: {
    userCount?: number;
    boardMemberCount?: number;
    socialsCount?: number;
  };
  isNew?: boolean;
};

export function DepartmentEditorSidebar({
  departmentName,
  logoUrl,
  onLogoChange,
  statusControl,
  campusControl,
  typeControl,
  stats,
  isNew = false,
}: DepartmentEditorSidebarProps) {
  return (
    <div className="space-y-6">
      {/* Status Badge */}
      <div className="flex justify-end">
        <AnimatedBadge
          gradient={isNew}
          icon={Building2}
          variant={isNew ? "default" : "secondary"}
        >
          {isNew ? "New Unit" : "Editing"}
        </AnimatedBadge>
      </div>

      {/* Settings Card */}
      <GlassCard
        className="sticky top-6"
        description="Configure department settings"
        title="Settings"
        variant="premium"
      >
        <div className="space-y-4">
          {statusControl}
          <Separator className="bg-border/50" />
          {campusControl}
          <Separator className="bg-border/50" />
          {typeControl}
        </div>
      </GlassCard>

      {/* Logo Preview */}
      <LogoUploadPreview
        departmentName={departmentName || "New Department"}
        logoUrl={logoUrl}
        onChange={onLogoChange}
      />

      {/* Quick Stats (only show for existing departments) */}
      {!isNew && stats && (
        <GlassCard
          description="Current department metrics"
          title="Quick Stats"
          variant="subtle"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-green-500/20 bg-green-500/10 p-3">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-green-500/20 p-2">
                  <Users className="h-4 w-4 text-green-600" />
                </div>
                <span className="font-medium text-green-600 text-sm">
                  Members
                </span>
              </div>
              <span className="font-bold text-lg">{stats.userCount || 0}</span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-purple-500/20 bg-purple-500/10 p-3">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-purple-500/20 p-2">
                  <Users2 className="h-4 w-4 text-purple-600" />
                </div>
                <span className="font-medium text-purple-600 text-sm">
                  Board
                </span>
              </div>
              <span className="font-bold text-lg">
                {stats.boardMemberCount || 0}
              </span>
            </div>

            {stats.socialsCount && stats.socialsCount > 0 && (
              <div className="flex items-center justify-between rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-blue-500/20 p-2">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="font-medium text-blue-600 text-sm">
                    Socials
                  </span>
                </div>
                <span className="font-bold text-lg">{stats.socialsCount}</span>
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* Quick Actions */}
      {!isNew && (
        <GlassCard variant="subtle">
          <div className="space-y-2">
            <Button
              className="w-full justify-start bg-card/60 hover:bg-card/80"
              size="sm"
              variant="outline"
            >
              <Eye className="mr-2 h-4 w-4" />
              Preview Web Page
            </Button>
            <Button
              className="w-full justify-start bg-card/60 hover:bg-card/80"
              size="sm"
              variant="outline"
            >
              <Globe className="mr-2 h-4 w-4" />
              View Public Page
            </Button>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
