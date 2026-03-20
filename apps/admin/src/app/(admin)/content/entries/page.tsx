import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import Link from "next/link";
import {
  listManagedContentEntries,
  listPublishedTemplateOptions,
} from "@/app/actions/editorial";

export default async function ContentEntriesPage() {
  const [entries, templates] = await Promise.all([
    listManagedContentEntries(),
    listPublishedTemplateOptions(),
  ]);
  const templateMap = new Map(
    templates.map((template) => [template.id, template])
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-2xl">Entries</h2>
          <p className="text-muted-foreground text-sm">
            Draft, preview, translate, and publish content from approved
            templates.
          </p>
        </div>

        <Button asChild>
          <Link href="/content/entries/new">New Entry</Link>
        </Button>
      </div>

      <div className="rounded-3xl border bg-background/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Path</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Visibility</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell
                  className="h-24 text-center text-muted-foreground"
                  colSpan={6}
                >
                  No content entries yet.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => {
                const sourceLocale =
                  entry.locales.find(
                    (locale) => locale.locale === entry.sourceLocale
                  ) ?? entry.locales[0];

                return (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {sourceLocale?.title || "Untitled entry"}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground text-sm">
                      {entry.path ? `/${entry.path}` : "Draft only"}
                    </TableCell>
                    <TableCell>
                      {templateMap.get(entry.templateId)?.name ??
                        "Unknown template"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          entry.status === "published" ? "default" : "secondary"
                        }
                      >
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.visibility}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/content/entries/${entry.id}`}>Open</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
