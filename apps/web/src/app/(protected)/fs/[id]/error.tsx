"use client";

import { useEffect } from "react";
import { Card } from "@repo/ui/components/ui/card";
import { Button } from "@repo/ui/components/ui/button";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Expense detail error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white flex items-center justify-center p-4">
      <Card className="p-12 text-center border-0 shadow-xl max-w-md">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Expense not found</h2>
        <p className="text-gray-600 mb-6">
          The expense you're looking for doesn't exist or you don't have permission to view it.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset} variant="outline">
            Try Again
          </Button>
          <Link href="/fs">
            <Button className="bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white">
              Go to Expenses
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

