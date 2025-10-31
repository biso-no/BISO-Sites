"use client";

import { BotIcon, ChevronDownIcon, Sparkles, XIcon } from "lucide-react";

import { type FC, forwardRef, useEffect, useState } from "react";
import { AssistantModalPrimitive } from "@assistant-ui/react";

import { Thread } from "./public-thread";
import { TooltipIconButton } from "./tooltip-icon-button";

const ASSISTANT_TOOLTIP_STORAGE_KEY = "assistant-tooltip-dismissed";

export const AssistantModal: FC = () => {
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const isDismissed = window.localStorage.getItem(ASSISTANT_TOOLTIP_STORAGE_KEY) === "true";
    if (!isDismissed) {
      setShowTooltip(true);
    }
  }, []);

  const handleDismissTooltip = () => {
    setShowTooltip(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ASSISTANT_TOOLTIP_STORAGE_KEY, "true");
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-4 sm:bottom-8 sm:right-8">
      {showTooltip ? (
        <div className="glass-elevated flex items-center gap-3 rounded-full px-4 py-2 shadow-card-soft">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100/90 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold text-primary-90">
              Trenger du hjelp? Vår assistent er klar.
            </div>
            <button
              type="button"
              aria-label="Skjul assistenttips"
              onClick={handleDismissTooltip}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-10 text-primary-60 transition hover:bg-primary-20"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}
      <AssistantModalPrimitive.Root>
        <AssistantModalPrimitive.Anchor className="aui-root aui-modal-anchor size-11 self-end">
          <AssistantModalPrimitive.Trigger asChild>
            <AssistantModalButton />
          </AssistantModalPrimitive.Trigger>
        </AssistantModalPrimitive.Anchor>
        <AssistantModalPrimitive.Content
          sideOffset={16}
          className="aui-root aui-modal-content z-50 h-[500px] w-[400px] overflow-clip rounded-xl border bg-popover p-0 text-popover-foreground shadow-md outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-1/2 data-[state=closed]:slide-out-to-right-1/2 data-[state=closed]:zoom-out data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-1/2 data-[state=open]:slide-in-from-right-1/2 data-[state=open]:zoom-in [&>.aui-thread-root]:bg-inherit"
        >
          <Thread />
        </AssistantModalPrimitive.Content>
      </AssistantModalPrimitive.Root>
    </div>
  );
};

type AssistantModalButtonProps = { "data-state"?: "open" | "closed" };

const AssistantModalButton = forwardRef<
  HTMLButtonElement,
  AssistantModalButtonProps
>(({ "data-state": state, ...rest }, ref) => {
  const tooltip = state === "open" ? "Close Assistant" : "Open Assistant";

  return (
    <TooltipIconButton
      variant="default"
      tooltip={tooltip}
      side="left"
      {...rest}
      className="aui-modal-button size-full rounded-full shadow transition-transform hover:scale-110 active:scale-90"
      ref={ref}
    >
      <BotIcon
        data-state={state}
        className="aui-modal-button-closed-icon absolute size-6 transition-all data-[state=closed]:scale-100 data-[state=closed]:rotate-0 data-[state=open]:scale-0 data-[state=open]:rotate-90"
      />

      <ChevronDownIcon
        data-state={state}
        className="aui-modal-button-open-icon absolute size-6 transition-all data-[state=closed]:scale-0 data-[state=closed]:-rotate-90 data-[state=open]:scale-100 data-[state=open]:rotate-0"
      />
      <span className="aui-sr-only sr-only">{tooltip}</span>
    </TooltipIconButton>
  );
});

AssistantModalButton.displayName = "AssistantModalButton";
