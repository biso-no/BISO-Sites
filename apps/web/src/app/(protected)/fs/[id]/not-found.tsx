import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { FileX } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-b from-gray-50 to-white p-4">
      <Card className="max-w-md border-0 p-12 text-center shadow-xl">
        <FileX className="mx-auto mb-4 h-16 w-16 text-gray-300" />
        <h2 className="mb-2 font-bold text-2xl text-gray-900">
          Expense Not Found
        </h2>
        <p className="mb-6 text-gray-600">
          The expense you're looking for doesn't exist or has been removed.
        </p>
        <Link href="/fs">
          <Button className="bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white hover:from-[#3DA9E0]/90 hover:to-[#001731]/90">
            Back to Expenses
          </Button>
        </Link>
      </Card>
    </div>
  );
}
