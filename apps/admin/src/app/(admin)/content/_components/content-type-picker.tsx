"use client";

import type { ContentTemplateRecord } from "@repo/api/editorial";
import { CONTENT_TYPES } from "@repo/editor/content-types/registry";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import {
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarDays,
  CreditCard,
  FileCheck,
  FileText,
  Home,
  Info,
  Mail,
  Newspaper,
  Package,
  Palette,
  Scale,
  Search,
  ShoppingBag,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createManagedContentEntryDraft } from "@/app/actions/editorial";

const ICON_MAP: Record<string, React.ReactNode> = {
  Home: <Home className="h-6 w-6" />,
  Newspaper: <Newspaper className="h-6 w-6" />,
  FileText: <FileText className="h-6 w-6" />,
  CalendarDays: <CalendarDays className="h-6 w-6" />,
  CalendarCheck: <CalendarCheck className="h-6 w-6" />,
  Briefcase: <Briefcase className="h-6 w-6" />,
  FileCheck: <FileCheck className="h-6 w-6" />,
  Building2: <Building2 className="h-6 w-6" />,
  Users: <Users className="h-6 w-6" />,
  ShoppingBag: <ShoppingBag className="h-6 w-6" />,
  Package: <Package className="h-6 w-6" />,
  CreditCard: <CreditCard className="h-6 w-6" />,
  Info: <Info className="h-6 w-6" />,
  Scale: <Scale className="h-6 w-6" />,
  Mail: <Mail className="h-6 w-6" />,
  Palette: <Palette className="h-6 w-6" />,
};

const FAMILY_COLORS: Record<string, string> = {
  page: "bg-blue-50 text-blue-700 border-blue-200",
  policy: "bg-amber-50 text-amber-700 border-amber-200",
  article: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

type ContentTypePickerProps = {
  /** Published templates available for template-based page creation */
  templates?: ContentTemplateRecord[];
};

export function ContentTypePicker({ templates = [] }: ContentTypePickerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTypes = CONTENT_TYPES.filter(
    (ct) =>
      ct.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ct.description.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleCreateFromType = (contentTypeKey: string) => {
    // For now, navigate to a new page creation route with the content type
    startTransition(async () => {
      try {
        // Find a matching template for this content type, or create direct
        const matchingTemplate = templates.find(
          (t) => t.key === contentTypeKey,
        );

        if (matchingTemplate) {
          const entry = await createManagedContentEntryDraft(
            matchingTemplate.id,
          );
          router.push(`/content/entries/${entry.id}`);
        } else {
          // Direct page creation - navigate to editor with content type preset
          router.push(
            `/content/entries/new/editor?contentType=${contentTypeKey}`,
          );
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to create page",
        );
      }
    });
  };

  const handleCreateFromTemplate = (templateId: string) => {
    startTransition(async () => {
      try {
        const entry = await createManagedContentEntryDraft(templateId);
        router.push(`/content/entries/${entry.id}`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to create draft",
        );
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="font-semibold text-2xl">Create a new page</h2>
        <p className="text-muted-foreground mt-1">
          Choose a content type to get started with a pre-built layout, or pick
          a custom template.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-10"
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search content types..."
          value={searchQuery}
        />
      </div>

      {/* Content Type Grid */}
      <div>
        <h3 className="font-medium text-lg mb-3">Start from a content type</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredTypes.map((ct) => (
            <Card
              key={ct.key}
              className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
              onClick={() => !isPending && handleCreateFromType(ct.key)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-muted p-2.5 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    {ICON_MAP[ct.icon] ?? <FileText className="h-6 w-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">{ct.name}</CardTitle>
                    <Badge
                      className={`mt-1 text-xs ${FAMILY_COLORS[ct.family] ?? ""}`}
                      variant="outline"
                    >
                      {ct.family}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs leading-relaxed">
                  {ct.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Published Templates Section */}
      {templates.length > 0 && (
        <div>
          <h3 className="font-medium text-lg mb-3">
            Or use a published template
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <Badge variant="outline">{template.family}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <CardDescription className="text-xs">
                    {template.description}
                  </CardDescription>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      v{template.publishedVersion?.version}
                    </Badge>
                    <Button
                      disabled={isPending}
                      onClick={() => handleCreateFromTemplate(template.id)}
                      size="sm"
                    >
                      Use template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
