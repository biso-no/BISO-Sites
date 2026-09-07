import { FeedSkeleton } from "@/components/ui/loading-shell";

// Matches what `/fs` renders. It used to draw a 50vh gradient band standing in
// for a hero the page no longer has, so the skeleton and the page disagreed by
// half a viewport.
export default function Loading() {
  return <FeedSkeleton />;
}
