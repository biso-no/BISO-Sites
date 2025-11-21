import { Card, CardContent, CardHeader } from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export default function UserDetailsLoading() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div>
                <Skeleton className="mb-2 h-7 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <Skeleton className="h-9 w-28" />
          </div>
        </CardHeader>

        <CardContent className="space-y-8 pb-6">
          <div className="flex flex-col items-start gap-6 md:flex-row">
            <div className="flex flex-col items-center gap-3 rounded-lg border bg-background/50 p-4">
              <Skeleton className="h-24 w-24 rounded-full" />
              <div className="space-y-2 text-center">
                <Skeleton className="mx-auto h-5 w-32" />
                <Skeleton className="mx-auto h-4 w-48" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>

            <div className="flex-1">
              <div className="w-full space-y-2">
                <Skeleton className="h-10 w-full" />
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div className="space-y-2" key={i}>
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
