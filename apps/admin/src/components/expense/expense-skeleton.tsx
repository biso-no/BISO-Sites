"use client";

import { Card } from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function ExpenseCardSkeleton() {
  return (
    <Card className="p-6 border-0 shadow-lg">
      <div className="flex items-start justify-between mb-4">
        <div className="grow space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-6 w-20" />
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>

        <Skeleton className="h-8 w-32 ml-6" />
      </div>

      <Skeleton className="h-9 w-32" />
    </Card>
  );
}

export function ExpenseListSkeleton() {
  return (
    <div className="grid gap-6">
      {[...Array(3)].map((_, i) => (
        <ExpenseCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ExpenseDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="p-8 border-0 shadow-lg">
        <Skeleton className="h-8 w-64 mb-6" />
        
        <div className="space-y-4">
          <div>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-6 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-6 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-6 w-48" />
          </div>
        </div>
      </Card>

      <Card className="p-8 border-0 shadow-lg">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </Card>
    </div>
  );
}

