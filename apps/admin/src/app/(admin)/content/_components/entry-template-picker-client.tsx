"use client";

import type { ContentTemplateRecord } from "@repo/api/editorial";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { createManagedContentEntryDraft } from "@/app/actions/editorial";

export function EntryTemplatePickerClient({
  templates,
}: {
  templates: ContentTemplateRecord[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleCreate = (templateId: string) => {
    startTransition(async () => {
      try {
        const entry = await createManagedContentEntryDraft(templateId);
        router.push(`/content/entries/${entry.id}`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to create draft"
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-2xl">Choose a template</h2>
        <p className="text-muted-foreground text-sm">
          Entries are form-first. Pick an approved template to create a draft.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{template.name}</CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </div>
                <Badge variant="outline">{template.family}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Badge variant="secondary">
                Live v{template.publishedVersion?.version}
              </Badge>

              <Button
                disabled={isPending}
                onClick={() => handleCreate(template.id)}
              >
                Create draft
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
