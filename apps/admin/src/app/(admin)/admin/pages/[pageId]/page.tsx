import Link from "next/link";
import { notFound } from "next/navigation";
import { getManagedPage } from "@/app/actions/pages";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import type { Locale } from "@repo/api/types/appwrite";
import { PageEditor } from "../_components/page-editor";

function formatStatus(status: string) {
  switch (status) {
    case "published":
      return { label: "Published", variant: "secondary" as const };
    case "archived":
      return { label: "Archived", variant: "outline" as const };
    default:
      return { label: "Draft", variant: "default" as const };
  }
}

export default async function EditPageRoute({
  params,
}: {
  params: { pageId: string };
}) {
  const page = await getManagedPage(params.pageId);

  if (!page) {
    notFound();
  }

  const status = formatStatus(page.status);
  const initialLocale = (page.translations[0]?.locale ?? "no") as Locale;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border border-primary/10 bg-white/90 p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold text-primary-100">{page.title || "Untitled page"}</h1>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Slug: /{page.slug}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/pages/${page.id}/preview?locale=${initialLocale}`} target="_blank">
              Preview
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/admin/pages/create`}>New page</Link>
          </Button>
        </div>
      </div>
      <Card className="border-primary/10 bg-white/95">
        <CardContent className="p-6">
          <PageEditor page={page} initialLocale={initialLocale} />
        </CardContent>
      </Card>
    </div>
  );
}
