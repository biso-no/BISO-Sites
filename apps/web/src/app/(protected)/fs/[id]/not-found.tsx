import Link from "next/link";
import { Card } from "@repo/ui/components/ui/card";
import { Button } from "@repo/ui/components/ui/button";
import { FileX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white flex items-center justify-center p-4">
      <Card className="p-12 text-center border-0 shadow-xl max-w-md">
        <FileX className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Expense Not Found</h2>
        <p className="text-gray-600 mb-6">
          The expense you're looking for doesn't exist or has been removed.
        </p>
        <Link href="/fs">
          <Button className="bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white">
            Back to Expenses
          </Button>
        </Link>
      </Card>
    </div>
  );
}

