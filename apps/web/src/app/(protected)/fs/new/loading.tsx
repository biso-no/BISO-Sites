import { DetailSkeleton } from "@/components/ui/loading-shell";

// `/fs/new` renders `expense-v3`'s split view, which is out of scope for
// RD-028. Only the placeholder shown while it loads is replaced here — the
// previous one drew a 30vh gradient band the composer never had.
export default function Loading() {
  return <DetailSkeleton />;
}
