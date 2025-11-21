"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
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

interface DepartmentEditorSidebarProps {
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
}

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
          variant={isNew ? "default" : "secondary"}
          icon={Building2}
          gradient={isNew}
        >
          {isNew ? "New Unit" : "Editing"}
        </AnimatedBadge>
      </div>

      {/* Settings Card */}
      <GlassCard
        title="Settings"
        description="Configure department settings"
        variant="premium"
        className="sticky top-6"
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
        logoUrl={logoUrl}
        onChange={onLogoChange}
        departmentName={departmentName || "New Department"}
      />

      {/* Quick Stats (only show for existing departments) */}
      {!isNew && stats && (
        <GlassCard
          title="Quick Stats"
          description="Current department metrics"
          variant="subtle"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-md bg-green-500/20">
                  <Users className="h-4 w-4 text-green-600" />
                </div>
                <span className="text-sm font-medium text-green-600">
                  Members
                </span>
              </div>
              <span className="text-lg font-bold">{stats.userCount || 0}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-md bg-purple-500/20">
                  <Users2 className="h-4 w-4 text-purple-600" />
                </div>
                <span className="text-sm font-medium text-purple-600">
                  Board
                </span>
              </div>
              <span className="text-lg font-bold">
                {stats.boardMemberCount || 0}
              </span>
            </div>

            {stats.socialsCount && stats.socialsCount > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-md bg-blue-500/20">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="text-sm font-medium text-blue-600">
                    Socials
                  </span>
                </div>
                <span className="text-lg font-bold">{stats.socialsCount}</span>
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
              variant="outline"
              size="sm"
              className="w-full justify-start bg-card/60 hover:bg-card/80"
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview Web Page
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start bg-card/60 hover:bg-card/80"
            >
              <Globe className="h-4 w-4 mr-2" />
              View Public Page
            </Button>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
