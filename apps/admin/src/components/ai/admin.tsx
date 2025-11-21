"use client";

import { AssistantModalPrimitive } from "@assistant-ui/react";
import { Button } from "@repo/ui/components/ui/button";
import { BotIcon, ChevronDownIcon } from "lucide-react";
import type { FC } from "react";
import { Thread } from "./admin-thread";
import { useAssistantUIStore } from "./assistant-ui-store";
import { TooltipIconButton } from "./tooltip-icon-button";

export const AssistantModal: FC = () => {
  const { mode, setMode, isModalOpen, setModalOpen, openSidebar } =
    useAssistantUIStore();
  const isModal = mode === "modal";
  return (
    <AssistantModalPrimitive.Root
      onOpenChange={setModalOpen}
      open={isModalOpen}
    >
      <AssistantModalPrimitive.Anchor className="aui-root aui-modal-anchor fixed right-4 bottom-4 size-11">
        <AssistantModalPrimitive.Trigger asChild>
          <AssistantModalButton />
        </AssistantModalPrimitive.Trigger>
      </AssistantModalPrimitive.Anchor>
      <AssistantModalPrimitive.Content
        className="aui-root aui-modal-content data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-1/2 data-[state=closed]:slide-out-to-right-1/2 data-[state=closed]:zoom-out data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-1/2 data-[state=open]:slide-in-from-right-1/2 data-[state=open]:zoom-in z-50 h-[500px] w-[400px] overflow-clip rounded-xl border bg-popover p-0 text-popover-foreground shadow-md outline-none data-[state=closed]:animate-out data-[state=open]:animate-in [&>.aui-thread-root]:bg-inherit"
        sideOffset={16}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div className="font-medium text-sm">Admin Assistant</div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setMode("modal")}
                size="sm"
                variant={isModal ? "default" : "outline"}
              >
                Modal
              </Button>
              <Button
                onClick={() => {
                  setMode("sidebar");
                  setModalOpen(false);
                  openSidebar();
                }}
                size="sm"
                variant={isModal ? "outline" : "default"}
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

const AssistantModalButton = ({
  "data-state": state,
  ref,
  ...rest
}: AssistantModalButtonProps & {
  ref?: RefObject<HTMLButtonElement | null>;
}) => {
  const tooltip = state === "open" ? "Close Assistant" : "Open Assistant";

  return (
    <TooltipIconButton
      side="left"
      tooltip={tooltip}
      variant="default"
      {...rest}
      className="aui-modal-button size-full rounded-full shadow transition-transform hover:scale-110 active:scale-90"
      ref={ref}
    >
      <BotIcon
        className="aui-modal-button-closed-icon absolute size-6 transition-all data-[state=closed]:rotate-0 data-[state=open]:rotate-90 data-[state=closed]:scale-100 data-[state=open]:scale-0"
        data-state={state}
      />

      <ChevronDownIcon
        className="aui-modal-button-open-icon data-[state=closed]:-rotate-90 absolute size-6 transition-all data-[state=open]:rotate-0 data-[state=closed]:scale-0 data-[state=open]:scale-100"
        data-state={state}
      />
      <span className="aui-sr-only sr-only">{tooltip}</span>
    </TooltipIconButton>
  );
};

AssistantModalButton.displayName = "AssistantModalButton";
