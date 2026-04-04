"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@repo/ui/components/ui/resizable";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import { Eye, EyeOff, Monitor, Smartphone } from "lucide-react";
import { useState } from "react";
import { type Locale, LocaleTabGroup } from "@/components/forms/LocaleTabGroup";
import { cn } from "@/lib/utils";

type DeviceMode = "desktop" | "mobile";

interface PreviewPanelProps {
  children: React.ReactNode;
  /** Default locale for preview */
  defaultLocale?: Locale;
  /** The preview content — receives locale and deviceMode */
  renderPreview: (locale: Locale, deviceMode: DeviceMode) => React.ReactNode;
}

/**
 * On desktop (lg+): resizable split — form left, preview right.
 * On mobile: preview opens in a Sheet triggered by a sticky button.
 */
export function PreviewPanel({
  children,
  renderPreview,
  defaultLocale = "en",
}: PreviewPanelProps) {
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const previewContent = (
    <div className="flex h-full flex-col">
      {/* Preview toolbar */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-border/40 border-b bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
          <Eye className="h-3.5 w-3.5" />
          Preview
        </div>

        <div className="flex items-center gap-2">
          <LocaleTabGroup
            activeLocale={locale}
            className="origin-right scale-90"
            onChange={setLocale}
          />

          <div className="flex items-center rounded-md border border-border/60 bg-background p-0.5">
            <button
              className={cn(
                "rounded p-1 transition-colors",
                device === "desktop"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setDevice("desktop")}
              title="Desktop view"
              type="button"
            >
              <Monitor className="h-3.5 w-3.5" />
            </button>
            <button
              className={cn(
                "rounded p-1 transition-colors",
                device === "mobile"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setDevice("mobile")}
              title="Mobile view"
              type="button"
            >
              <Smartphone className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable preview area */}
      <div className="flex-1 overflow-auto bg-background">
        <div
          className={cn(
            "min-h-full transition-all",
            device === "mobile" &&
              "mx-auto w-[390px] border-border/40 border-x shadow-xl"
          )}
        >
          {renderPreview(locale, device)}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop — resizable split */}
      <div className="hidden h-full lg:block">
        <ResizablePanelGroup className="h-full" direction="horizontal">
          <ResizablePanel
            className="overflow-auto"
            defaultSize={62}
            minSize={40}
          >
            <div className="pb-16">{children}</div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel
            className="border-border/40 border-l"
            defaultSize={38}
            minSize={28}
          >
            {previewContent}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Mobile — regular form + preview Sheet */}
      <div className="pb-16 lg:hidden">
        {children}
        <Button
          className="fixed right-4 bottom-16 z-40 gap-1.5 shadow-md"
          onClick={() => setMobileSheetOpen(true)}
          size="sm"
          type="button"
          variant="outline"
        >
          <Eye className="h-4 w-4" />
          Preview
        </Button>
        <Sheet onOpenChange={setMobileSheetOpen} open={mobileSheetOpen}>
          <SheetContent className="h-[85vh] p-0" side="bottom">
            <SheetHeader className="sr-only">
              <SheetTitle>Content Preview</SheetTitle>
            </SheetHeader>
            <div className="h-full overflow-auto">{previewContent}</div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

/** Thin wrapper: preview toggle button for the page header */
export function PreviewToggleButton({
  onClick,
  active,
}: {
  onClick: () => void;
  active: boolean;
}) {
  return (
    <Button
      className="gap-1.5"
      onClick={onClick}
      size="sm"
      type="button"
      variant="outline"
    >
      {active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      {active ? "Hide preview" : "Preview"}
    </Button>
  );
}
