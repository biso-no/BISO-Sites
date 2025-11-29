"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { Sparkles } from "lucide-react";

type AssistantTriggerProps = {
  onClick: () => void;
};

export function AssistantTrigger({ onClick }: AssistantTriggerProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          className="h-10 w-10 rounded-xl border border-primary/10 bg-primary-10/60 text-primary-80 hover:bg-primary/10 dark:border-primary/20 dark:bg-card/70 dark:text-primary dark:hover:bg-primary/15"
        >
          <Sparkles className="h-5 w-5" />
          <span className="sr-only">Open AI Assistant</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>AI Assistant</p>
      </TooltipContent>
    </Tooltip>
  );
}
