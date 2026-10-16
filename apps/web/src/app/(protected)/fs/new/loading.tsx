import { DetailSkeleton } from "@/components/ui/loading-shell";

// The placeholder shown while `/fs/new` loads the composer. The previous one
// drew a 30vh gradient band the composer never had.
export default function Loading() {
  return <DetailSkeleton />;
}
