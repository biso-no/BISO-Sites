import Link from "next/link";
import { Plus, Edit, Eye, Trash } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { Badge } from "@repo/ui/components/ui/badge";
import { listManagedPages, deletePage } from "@/app/actions/pages";
import { CreatePageDialog } from "./create-page-dialog";
import { DeletePageButton } from "./delete-page-button";

export default async function PagesList() {
  const pages = await listManagedPages();

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Pages</h1>
        <CreatePageDialog>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Page
          </Button>
        </CreatePageDialog>
      </div>

      <div className="rounded-md border">
        <Table className="surface-spotlight glass-panel accent-ring relative overflow-hidden rounded-3xl border border-primary/10 px-6 py-6 sm:px-8 sm:py-8">
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                  No pages found. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              pages.map((page) => (
                <TableRow key={page.id}>
                  <TableCell className="font-medium">{page.title}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    /{page.slug}
                  </TableCell>
                  <TableCell>
                    <Badge variant={page.status === "published" ? "default" : "secondary"}>
                      {page.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(page.updatedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/admin/pages/${page.id}/no/editor`}>
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                      {page.status === "published" && (
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`https://biso.no/${page.slug}`} target="_blank">
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                      <DeletePageButton pageId={page.id} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
