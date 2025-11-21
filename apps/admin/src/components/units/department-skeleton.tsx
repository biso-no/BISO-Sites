"use client";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function DepartmentSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="relative h-36 overflow-hidden p-0">
        <Skeleton className="h-full w-full" />
        <div className="absolute bottom-4 left-4 z-20 flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-6 w-32" />
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-4 w-full" />
        </div>
      </CardContent>

      <CardFooter className="flex justify-between p-4 pt-0">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-16" />
      </CardFooter>
    </Card>
  );
}

function _DepartmentSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <DepartmentSkeleton key={index} />
      ))}
    </div>
  );
}
