"use client";

import type { AssistantMessage as AssistantMessageType } from "@repo/ai/types";
import { cn } from "@repo/ui/lib/utils";
import { Bot, User } from "lucide-react";

type AssistantMessageProps = {
  message: AssistantMessageType;
};

function getMessageText(message: AssistantMessageType): string {
  if (!message.parts || message.parts.length === 0) {
    return "";
  }

  return message.parts
    .filter(
      (part): part is { type: "text"; text: string } => part.type === "text"
    )
    .map((part) => part.text)
    .join("");
}

export function AssistantMessage({ message }: AssistantMessageProps) {
  const isUser = message.role === "user";
  const text = getMessageText(message);

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message bubble */}
      <div
        className={cn(
          "max-w-[280px] rounded-2xl px-4 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        <div className="whitespace-pre-wrap">{text}</div>
      </div>
    </div>
  );
}
