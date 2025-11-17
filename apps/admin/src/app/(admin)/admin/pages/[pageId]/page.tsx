import Link from "next/link";
import { notFound } from "next/navigation";
import { getManagedPage } from "@/app/actions/pages";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Locale } from "@repo/api/types/appwrite";
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
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  const page = await getManagedPage(pageId);

  if (!page) {
    notFound();
  }

  const status = formatStatus(page.status);
  const initialLocale = page.translations[0]?.locale ?? Locale.NO;

  return (
    <div className="space-y-4">
      {/* Page header with basic info and actions */}
      <div className="glass-panel flex flex-col gap-3 rounded-xl border border-primary/10 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">
              {page.title || "Untitled page"}
            </h1>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">/{page.slug}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/admin/pages/${page.id}/preview?locale=${initialLocale}`}
              target="_blank"
            >
              Preview
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/admin/pages/create`}>New page</Link>
          </Button>
        </div>
      </div>

      {/* Integrated editor with settings sidebar */}
      <PageEditor page={page} initialLocale={initialLocale} />
    </div>
  );
}
