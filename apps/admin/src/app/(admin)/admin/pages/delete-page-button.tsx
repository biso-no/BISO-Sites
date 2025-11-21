"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Trash } from "lucide-react";
import { deletePage } from "@/app/actions/pages";

interface DeletePageButtonProps {
  pageId: string;
}

export function DeletePageButton({ pageId }: DeletePageButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={async () => await deletePage(pageId)}
    >
      <Trash className="h-4 w-4" />
    </Button>
  );
}
