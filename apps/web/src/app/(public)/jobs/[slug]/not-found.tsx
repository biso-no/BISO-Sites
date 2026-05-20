import { Button } from "@repo/ui/components/ui/button";
import { FileSearch } from "lucide-react";
import Link from "next/link";

export default function JobNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <FileSearch className="mb-4 h-10 w-10 text-muted-foreground" />
      <h2 className="mb-2 font-semibold text-xl">Position not found</h2>
      <p className="mb-6 max-w-sm text-muted-foreground text-sm">
        This vacancy may have closed or the link may be outdated.
      </p>
      <Button asChild>
        <Link href="/jobs">Browse open positions</Link>
      </Button>
    </div>
  );
}
