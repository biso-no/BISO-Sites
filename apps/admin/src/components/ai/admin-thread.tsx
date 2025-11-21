import {
  ActionBarPrimitive,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  PencilIcon,
  RefreshCwIcon,
  Square,
} from "lucide-react";
import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import * as m from "motion/react-m";
import type { FC } from "react";

import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "./attachment";
import { MarkdownText } from "./markdown-text";
import { ToolFallback } from "./tool-fallback";
import { TooltipIconButton } from "./tooltip-icon-button";

export const Thread: FC = () => (
  <LazyMotion features={domAnimation}>
    <MotionConfig reducedMotion="user">
      <ThreadPrimitive.Root
        className="aui-root aui-thread-root @container flex h-full flex-col bg-background"
        style={{
          ["--thread-max-width" as string]: "44rem",
        }}
      >
        <ThreadPrimitive.Viewport className="aui-thread-viewport relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll px-4">
          <ThreadWelcome />

          <ThreadPrimitive.Messages
            components={{
              UserMessage,
              EditComposer,
              AssistantMessage,
            }}
          />
          <ThreadPrimitive.If empty={false}>
            <div className="aui-thread-viewport-spacer min-h-8 grow" />
          </ThreadPrimitive.If>
          <Composer />
        </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>
    </MotionConfig>
  </LazyMotion>
);

const ThreadScrollToBottom: FC = () => (
  <ThreadPrimitive.ScrollToBottom asChild>
    <TooltipIconButton
      className="aui-thread-scroll-to-bottom -top-12 absolute z-10 self-center rounded-full p-4 disabled:invisible dark:bg-background dark:hover:bg-accent"
      tooltip="Scroll to bottom"
      variant="outline"
    >
      <ArrowDownIcon />
    </TooltipIconButton>
  </ThreadPrimitive.ScrollToBottom>
);

const ThreadWelcome: FC = () => (
  <ThreadPrimitive.Empty>
    <div className="aui-thread-welcome-root mx-auto my-auto flex w-full max-w-(--thread-max-width) grow flex-col">
      <div className="aui-thread-welcome-center flex w-full grow flex-col items-center justify-center">
        <div className="aui-thread-welcome-message flex size-full flex-col justify-center px-8">
          <m.div
            animate={{ opacity: 1, y: 0 }}
            className="aui-thread-welcome-message-motion-1 font-semibold text-2xl"
            exit={{ opacity: 0, y: 10 }}
            initial={{ opacity: 0, y: 10 }}
          >
            Hello there!
          </m.div>
          <m.div
            animate={{ opacity: 1, y: 0 }}
            className="aui-thread-welcome-message-motion-2 text-2xl text-muted-foreground/65"
            exit={{ opacity: 0, y: 10 }}
            initial={{ opacity: 0, y: 10 }}
            transition={{ delay: 0.1 }}
          >
            How can I help you today?
          </m.div>
        </div>
      </div>
    </div>
  </ThreadPrimitive.Empty>
);

const ThreadWelcomeSuggestions: FC = () => (
  <div className="aui-thread-welcome-suggestions grid w-full @md:grid-cols-2 gap-2">
    {[
      {
        title: "What's the weather",
        label: "in San Francisco?",
        action: "What's the weather in San Francisco?",
      },
      {
        title: "Help me write an essay",
        label: "about AI chat applications",
        action: "Help me write an essay about AI chat applications",
      },
    ].map((suggestedAction, index) => (
      <m.div
        animate={{ opacity: 1, y: 0 }}
        className="aui-thread-welcome-suggestion-display @md:nth-[n+3]:block nth-[n+3]:hidden"
        exit={{ opacity: 0, y: 20 }}
        initial={{ opacity: 0, y: 20 }}
        key={`suggested-action-${suggestedAction.title}-${index}`}
        transition={{ delay: 0.05 * index }}
      >
        <ThreadPrimitive.Suggestion
          asChild
          autoSend
          method="replace"
          prompt={suggestedAction.action}
        >
          <Button
            aria-label={suggestedAction.action}
            className="aui-thread-welcome-suggestion h-auto w-full flex-1 @md:flex-col flex-wrap items-start justify-start gap-1 rounded-3xl border px-5 py-4 text-left text-sm dark:hover:bg-accent/60"
            variant="ghost"
          >
            <span className="aui-thread-welcome-suggestion-text-1 font-medium">
              {suggestedAction.title}
            </span>
            <span className="aui-thread-welcome-suggestion-text-2 text-muted-foreground">
              {suggestedAction.label}
            </span>
          </Button>
        </ThreadPrimitive.Suggestion>
      </m.div>
    ))}
  </div>
);

const Composer: FC = () => (
  <div className="aui-composer-wrapper sticky bottom-0 mx-auto flex w-full max-w-(--thread-max-width) flex-col gap-4 overflow-visible rounded-t-3xl bg-background pb-4 md:pb-6">
    <ThreadScrollToBottom />
    <ThreadPrimitive.Empty>
      <ThreadWelcomeSuggestions />
    </ThreadPrimitive.Empty>
    <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col rounded-3xl border border-border bg-muted px-1 pt-2 shadow-[0_9px_9px_0px_rgba(0,0,0,0.01),0_2px_5px_0px_rgba(0,0,0,0.06)] dark:border-muted-foreground/15">
      <ComposerAttachments />
      <ComposerPrimitive.Input
        aria-label="Message input"
        autoFocus
        className="aui-composer-input mb-1 max-h-32 min-h-16 w-full resize-none bg-transparent px-3.5 pt-1.5 pb-3 text-base outline-none placeholder:text-muted-foreground focus:outline-primary"
        placeholder="Send a message..."
        rows={1}
      />
      <ComposerAction />
    </ComposerPrimitive.Root>
  </div>
);

const ComposerAction: FC = () => (
  <div className="aui-composer-action-wrapper relative mx-1 mt-2 mb-2 flex items-center justify-between">
    <ComposerAddAttachment />

    <ThreadPrimitive.If running={false}>
      <ComposerPrimitive.Send asChild>
        <TooltipIconButton
          aria-label="Send message"
          className="aui-composer-send size-[34px] rounded-full p-1"
          side="bottom"
          size="icon"
          tooltip="Send message"
          type="submit"
          variant="default"
        >
          <ArrowUpIcon className="aui-composer-send-icon size-5" />
        </TooltipIconButton>
      </ComposerPrimitive.Send>
    </ThreadPrimitive.If>

    <ThreadPrimitive.If running>
      <ComposerPrimitive.Cancel asChild>
        <Button
          aria-label="Stop generating"
          className="aui-composer-cancel size-[34px] rounded-full border border-muted-foreground/60 hover:bg-primary/75 dark:border-muted-foreground/90"
          size="icon"
          type="button"
          variant="default"
        >
          <Square className="aui-composer-cancel-icon size-3.5 fill-white dark:fill-black" />
        </Button>
      </ComposerPrimitive.Cancel>
    </ThreadPrimitive.If>
  </div>
);

const MessageError: FC = () => (
  <MessagePrimitive.Error>
    <ErrorPrimitive.Root className="aui-message-error-root mt-2 rounded-md border border-destructive bg-destructive/10 p-3 text-destructive text-sm dark:bg-destructive/5 dark:text-red-200">
      <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
    </ErrorPrimitive.Root>
  </MessagePrimitive.Error>
);

const AssistantMessage: FC = () => (
  <MessagePrimitive.Root asChild>
    <div
      className="aui-assistant-message-root fade-in slide-in-from-bottom-1 relative mx-auto w-full max-w-(--thread-max-width) animate-in py-4 duration-200 last:mb-24"
      data-role="assistant"
    >
      <div className="aui-assistant-message-content wrap-break-word mx-2 text-foreground leading-7">
        <MessagePrimitive.Parts
          components={{
            Text: MarkdownText,
            tools: { Fallback: ToolFallback },
          }}
        />
        <MessageError />
      </div>

      <div className="aui-assistant-message-footer mt-2 ml-2 flex">
        <BranchPicker />
        <AssistantActionBar />
      </div>
    </div>
  </MessagePrimitive.Root>
);

const AssistantActionBar: FC = () => (
  <ActionBarPrimitive.Root
    autohide="not-last"
    autohideFloat="single-branch"
    className="aui-assistant-action-bar-root -ml-1 col-start-3 row-start-2 flex gap-1 text-muted-foreground data-floating:absolute data-floating:rounded-md data-floating:border data-floating:bg-background data-floating:p-1 data-floating:shadow-sm"
    hideWhenRunning
  >
    <ActionBarPrimitive.Copy asChild>
      <TooltipIconButton tooltip="Copy">
        <MessagePrimitive.If copied>
          <CheckIcon />
        </MessagePrimitive.If>
        <MessagePrimitive.If copied={false}>
          <CopyIcon />
        </MessagePrimitive.If>
      </TooltipIconButton>
    </ActionBarPrimitive.Copy>
    <ActionBarPrimitive.Reload asChild>
      <TooltipIconButton tooltip="Refresh">
        <RefreshCwIcon />
      </TooltipIconButton>
    </ActionBarPrimitive.Reload>
  </ActionBarPrimitive.Root>
);

const UserMessage: FC = () => (
  <MessagePrimitive.Root asChild>
    <div
      className="aui-user-message-root fade-in slide-in-from-bottom-1 mx-auto grid w-full max-w-(--thread-max-width) animate-in auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] gap-y-2 px-2 py-4 duration-200 first:mt-3 last:mb-5 [&:where(>*)]:col-start-2"
      data-role="user"
    >
      <UserMessageAttachments />

      <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
        <div className="aui-user-message-content wrap-break-word rounded-3xl bg-muted px-5 py-2.5 text-foreground">
          <MessagePrimitive.Parts />
        </div>
        <div className="aui-user-action-bar-wrapper -translate-x-full -translate-y-1/2 absolute top-1/2 left-0 pr-2">
          <UserActionBar />
        </div>
      </div>

      <BranchPicker className="aui-user-branch-picker -mr-1 col-span-full col-start-1 row-start-3 justify-end" />
    </div>
  </MessagePrimitive.Root>
);

const UserActionBar: FC = () => (
  <ActionBarPrimitive.Root
    autohide="not-last"
    className="aui-user-action-bar-root flex flex-col items-end"
    hideWhenRunning
  >
    <ActionBarPrimitive.Edit asChild>
      <TooltipIconButton className="aui-user-action-edit p-4" tooltip="Edit">
        <PencilIcon />
      </TooltipIconButton>
    </ActionBarPrimitive.Edit>
  </ActionBarPrimitive.Root>
);

const EditComposer: FC = () => (
  <div className="aui-edit-composer-wrapper mx-auto flex w-full max-w-(--thread-max-width) flex-col gap-4 px-2 first:mt-4">
    <ComposerPrimitive.Root className="aui-edit-composer-root ml-auto flex w-full max-w-7/8 flex-col rounded-xl bg-muted">
      <ComposerPrimitive.Input
        autoFocus
        className="aui-edit-composer-input flex min-h-[60px] w-full resize-none bg-transparent p-4 text-foreground outline-none"
      />

      <div className="aui-edit-composer-footer mx-3 mb-3 flex items-center justify-center gap-2 self-end">
        <ComposerPrimitive.Cancel asChild>
          <Button aria-label="Cancel edit" size="sm" variant="ghost">
            Cancel
          </Button>
        </ComposerPrimitive.Cancel>
        <ComposerPrimitive.Send asChild>
          <Button aria-label="Update message" size="sm">
            Update
          </Button>
        </ComposerPrimitive.Send>
      </div>
    </ComposerPrimitive.Root>
  </div>
);

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => (
  <BranchPickerPrimitive.Root
    className={cn(
      "aui-branch-picker-root -ml-2 mr-2 inline-flex items-center text-muted-foreground text-xs",
      className
    )}
    hideWhenSingleBranch
    {...rest}
  >
    <BranchPickerPrimitive.Previous asChild>
      <TooltipIconButton tooltip="Previous">
        <ChevronLeftIcon />
      </TooltipIconButton>
    </BranchPickerPrimitive.Previous>
    <span className="aui-branch-picker-state font-medium">
      <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
    </span>
    <BranchPickerPrimitive.Next asChild>
      <TooltipIconButton tooltip="Next">
        <ChevronRightIcon />
      </TooltipIconButton>
    </BranchPickerPrimitive.Next>
  </BranchPickerPrimitive.Root>
);
