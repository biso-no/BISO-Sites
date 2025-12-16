"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Trash } from "lucide-react";
import { deleteManagedPage } from "@/app/actions/pages/actions";

type DeletePageButtonProps = {
  pageId: string;
};

export function DeletePageButton({ pageId }: DeletePageButtonProps) {
  return (
    <Button
      onClick={async () => await deleteManagedPage(pageId)}
      size="icon"
      variant="ghost"
    >
      <Trash className="h-4 w-4" />
    </Button>
  );
}
