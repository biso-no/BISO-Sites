import { Badge } from "@repo/ui/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Clock, Package } from "lucide-react";
import Image from "next/image";
import { listPendingProducts } from "@/app/actions/shop/approval-actions";
import { ApprovalActions } from "./_components/approval-actions";

export default async function ApprovalQueuePage() {
  const products = await listPendingProducts();

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl">Approval Queue</h1>
          <p className="text-muted-foreground">
            Review and approve products submitted by departments
          </p>
        </div>
        <Badge className="px-4 py-2 text-lg" variant="secondary">
          <Clock className="mr-2 h-5 w-5" />
          {products.length} pending
        </Badge>
      </div>

      {products.length === 0 ? (
        <Card className="surface-spotlight glass-panel">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="mb-4 h-16 w-16 text-muted-foreground" />
            <CardTitle className="mb-2 text-xl">No pending products</CardTitle>
            <CardDescription>
              All products have been reviewed. Check back later for new
              submissions.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <Card className="surface-spotlight glass-panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Campus</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const translation =
                  product.translations?.find((t) => t.locale === "no") ||
                  product.translations?.[0];

                return (
                  <TableRow key={product.$id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {product.image ? (
                          <Image
                            alt=""
                            className="h-12 w-12 rounded-lg object-cover"
                            height={48}
                            src={product.image}
                            width={48}
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                            <Package className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">
                            {translation?.title || product.slug}
                          </p>
                          <p className="max-w-[200px] truncate text-muted-foreground text-sm">
                            {translation?.description || "No description"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{product.campus_id}</Badge>
                    </TableCell>
                    <TableCell>
                      {product.departmentId ? (
                        <Badge variant="secondary">
                          {product.departmentId}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono">
                        {product.regular_price?.toFixed(2) || "0.00"} kr
                      </span>
                    </TableCell>
                    <TableCell>
                      {new Date(product.$createdAt).toLocaleDateString(
                        "no-NO",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <ApprovalActions productId={product.$id} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
