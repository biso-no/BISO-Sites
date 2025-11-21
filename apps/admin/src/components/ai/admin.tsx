"use client";

import { AssistantModalPrimitive } from "@assistant-ui/react";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { BotIcon, ChevronDownIcon } from "lucide-react";
import { type FC, forwardRef } from "react";
import { Thread } from "./admin-thread";
import { useAssistantUIStore } from "./assistant-ui-store";
import { TooltipIconButton } from "./tooltip-icon-button";

export const AssistantModal: FC = () => {
  const { mode, setMode, isModalOpen, setModalOpen, openSidebar } = useAssistantUIStore();
  const isModal = mode === "modal";
  return (
    <AssistantModalPrimitive.Root open={isModalOpen} onOpenChange={setModalOpen}>
      <AssistantModalPrimitive.Anchor className="aui-root aui-modal-anchor fixed right-4 bottom-4 size-11">
        <AssistantModalPrimitive.Trigger asChild>
          <AssistantModalButton />
        </AssistantModalPrimitive.Trigger>
      </AssistantModalPrimitive.Anchor>
      <AssistantModalPrimitive.Content
        sideOffset={16}
        className="aui-root aui-modal-content z-50 h-[500px] w-[400px] overflow-clip rounded-xl border bg-popover p-0 text-popover-foreground shadow-md outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-1/2 data-[state=closed]:slide-out-to-right-1/2 data-[state=closed]:zoom-out data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-1/2 data-[state=open]:slide-in-from-right-1/2 data-[state=open]:zoom-in [&>.aui-thread-root]:bg-inherit"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div className="text-sm font-medium">Admin Assistant</div>
            <div className="flex items-center gap-2">
              <Button
                variant={isModal ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("modal")}
              >
                Modal
              </Button>
              <Button
                variant={!isModal ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setMode("sidebar");
                  setModalOpen(false);
                  openSidebar();
                }}
              >
                Sidebar
              </Button>
            </div>
          </div>
          <div className="flex-1">
            <Thread />
          </div>
        </div>
      </AssistantModalPrimitive.Content>
    </AssistantModalPrimitive.Root>
  );
};

type AssistantModalButtonProps = { "data-state"?: "open" | "closed" };

const AssistantModalButton = forwardRef<HTMLButtonElement, AssistantModalButtonProps>(
  ({ "data-state": state, ...rest }, ref) => {
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
  },
);

AssistantModalButton.displayName = "AssistantModalButton";
