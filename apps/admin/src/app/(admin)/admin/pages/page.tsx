import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { listManagedPages } from "@/app/actions/pages";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";

function formatTimestamp(value: string) {
  try {
    return new Date(value).toLocaleString("nb-NO", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

export default async function AdminPagesIndex() {
  const pages = await listManagedPages();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-primary-100">Page builder</h1>
          <p className="text-sm text-muted-foreground">
            Draft, publish and organise public pages powered by the Puck editor.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/pages/create">Create page</Link>
        </Button>
      </div>

      <Card className="border-primary/10 bg-white/90">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-primary-100">
            All pages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/3">Title</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((page) => (
                <TableRow key={page.id} className="hover:bg-primary-10/30">
                  <TableCell className="font-medium text-primary-100">
                    {page.title || "Untitled page"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    /{page.slug}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        page.status === "published"
                          ? "secondary"
                          : page.status === "draft"
                            ? "outline"
                            : "default"
                      }
                    >
                      {page.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {formatTimestamp(page.updatedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link
                        href={`/admin/pages/${page.id}`}
                        className="inline-flex items-center gap-1"
                      >
                        Open <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {pages.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                    No pages yet. Start by creating your first page.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
