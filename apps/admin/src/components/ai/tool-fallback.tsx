import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { Button } from "@repo/ui/components/ui/button";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, Loader2 } from "lucide-react";
import { useState } from "react";

const friendlyName: Record<string, string> = {
  searchSharePoint: "Searching documents",
  searchSiteContent: "Searching the site",
  getDocumentStats: "Fetching document stats",
  listSharePointSites: "Listing SharePoint sites",
};

export const ToolFallback: ToolCallMessagePartComponent = ({ toolName, argsText, result }) => {
  // Hooks must be called unconditionally
  const [isCollapsed, setIsCollapsed] = useState(true);
  // Hide fallback entirely for tools with dedicated UIs to avoid duplicate/raw output
  if (toolName === "searchSharePoint" || toolName === "searchSiteContent") {
    return null;
  }
  const label = friendlyName[toolName] || "Working";

  return (
    <div className="my-1 inline-flex w-full flex-col gap-1">
      <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        {result === undefined ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        ) : (
          <CheckIcon className="h-3.5 w-3.5 text-primary" />
        )}
        <span>{label}</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="ml-auto h-6 px-1 text-[11px]"
        >
          {isCollapsed ? (
            <ChevronDownIcon className="h-3.5 w-3.5" />
          ) : (
            <ChevronUpIcon className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
      {!isCollapsed && (
        <div className="rounded-md border bg-white/60 p-2">
          <p className="mb-1 text-[11px] font-medium text-muted-foreground">Developer details</p>
          <div className="grid gap-2">
            <div className="rounded bg-muted/40 p-2">
              <p className="mb-1 text-[11px] font-medium">Arguments</p>
              <pre className="whitespace-pre-wrap text-[11px]">{argsText}</pre>
            </div>
            {result !== undefined && (
              <div className="rounded bg-muted/40 p-2">
                <p className="mb-1 text-[11px] font-medium">Result</p>
                <pre className="whitespace-pre-wrap text-[11px]">
                  {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
