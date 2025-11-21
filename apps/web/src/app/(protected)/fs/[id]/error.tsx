"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

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
    <div className="flex min-h-screen items-center justify-center bg-linear-to-b from-gray-50 to-white p-4">
      <Card className="max-w-md border-0 p-12 text-center shadow-xl">
        <AlertCircle className="mx-auto mb-4 h-16 w-16 text-red-500" />
        <h2 className="mb-2 font-bold text-2xl text-gray-900">
          Expense not found
        </h2>
        <p className="mb-6 text-gray-600">
          The expense you're looking for doesn't exist or you don't have
          permission to view it.
        </p>
        <div className="flex justify-center gap-3">
          <Button onClick={reset} variant="outline">
            Try Again
          </Button>
          <Link href="/fs">
            <Button className="bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white hover:from-[#3DA9E0]/90 hover:to-[#001731]/90">
              Go to Expenses
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
