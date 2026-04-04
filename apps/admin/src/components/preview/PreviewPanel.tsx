"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@repo/ui/components/ui/sheet";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@repo/ui/components/ui/resizable";
import { Eye, EyeOff, Monitor, Smartphone } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { type Locale, LocaleTabGroup } from "@/components/forms/LocaleTabGroup";

type DeviceMode = "desktop" | "mobile";

type PreviewPanelProps = {
  children: React.ReactNode;
  /** The preview content — receives locale and deviceMode */
  renderPreview: (locale: Locale, deviceMode: DeviceMode) => React.ReactNode;
  /** Default locale for preview */
  defaultLocale?: Locale;
};

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
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/40 bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium uppercase tracking-wide">
          <Eye className="h-3.5 w-3.5" />
          Preview
        </div>

        <div className="flex items-center gap-2">
          <LocaleTabGroup
            activeLocale={locale}
            onChange={setLocale}
            className="scale-90 origin-right"
          />

          <div className="flex items-center rounded-md border border-border/60 bg-background p-0.5">
            <button
              type="button"
              onClick={() => setDevice("desktop")}
              className={cn(
                "rounded p-1 transition-colors",
                device === "desktop"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Desktop view"
            >
              <Monitor className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDevice("mobile")}
              className={cn(
                "rounded p-1 transition-colors",
                device === "mobile"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Mobile view"
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
            device === "mobile" && "mx-auto w-[390px] shadow-xl border-x border-border/40",
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
      <div className="hidden lg:block h-full">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={62} minSize={40} className="overflow-auto">
            <div className="pb-16">{children}</div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={38} minSize={28} className="border-l border-border/40">
            {previewContent}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Mobile — regular form + preview Sheet */}
      <div className="lg:hidden pb-16">
        {children}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="fixed bottom-16 right-4 z-40 gap-1.5 shadow-md"
          onClick={() => setMobileSheetOpen(true)}
        >
          <Eye className="h-4 w-4" />
          Preview
        </Button>
        <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
          <SheetContent side="bottom" className="h-[85vh] p-0">
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
    <Button type="button" size="sm" variant="outline" onClick={onClick} className="gap-1.5">
      {active ? (
        <EyeOff className="h-4 w-4" />
      ) : (
        <Eye className="h-4 w-4" />
      )}
      {active ? "Hide preview" : "Preview"}
    </Button>
  );
}
