import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { FileX } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
 return (
 <div className="flex min-h-screen items-center justify-center bg-linear-to-b from-section to-background p-4">
 <Card className="max-w-md border-0 p-12 text-center shadow-xl">
 <FileX className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
 <h2 className="mb-2 font-bold text-2xl text-foreground">
 Expense Not Found
 </h2>
 <p className="mb-6 text-muted-foreground">
 The expense you're looking for doesn't exist or has been removed.
 </p>
 <Link href="/fs">
 <Button className="bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white hover:from-brand-gradient-from/90 hover:to-brand-gradient-to/90">
 Back to Expenses
 </Button>
 </Link>
 </Card>
 </div>
 );
}
