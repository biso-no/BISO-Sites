"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Trash } from "lucide-react";
import { deletePage } from "@/app/actions/pages";

type DeletePageButtonProps = {
  pageId: string;
};

export function DeletePageButton({ pageId }: DeletePageButtonProps) {
  return (
    <Button
      onClick={async () => await deletePage(pageId)}
      size="icon"
      variant="ghost"
    >
      <Trash className="h-4 w-4" />
    </Button>
  );
}
