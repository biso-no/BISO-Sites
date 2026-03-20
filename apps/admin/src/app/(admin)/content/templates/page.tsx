import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import Link from "next/link";
import { listManagedContentTemplates } from "@/app/actions/editorial";
import { isGlobalAdmin } from "@/lib/authorization";

export default async function ContentTemplatesPage() {
  const canManageTemplates = await isGlobalAdmin();
  const templates = canManageTemplates
    ? await listManagedContentTemplates()
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-2xl">Templates</h2>
          <p className="text-muted-foreground text-sm">
            Global admins own reusable editorial templates and versioned
            layouts.
          </p>
        </div>

        {canManageTemplates && (
          <Button asChild>
            <Link href="/content/templates/new">New Template</Link>
          </Button>
        )}
      </div>

      {canManageTemplates ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>{template.name}</CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </div>
                  <Badge variant="outline">{template.family}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">
                    Draft v{template.draftVersion?.version ?? "None"}
                  </Badge>
                  <Badge variant="secondary">
                    Live v{template.publishedVersion?.version ?? "None"}
                  </Badge>
                </div>

                <div className="flex gap-2">
                  <Button asChild size="sm">
                    <Link href={`/content/templates/${template.id}`}>Open</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Template access is restricted</CardTitle>
            <CardDescription>
              Only global admins can create or edit templates. Editors can still
              create entries from published templates.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
