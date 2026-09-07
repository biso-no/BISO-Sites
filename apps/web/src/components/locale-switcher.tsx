"use client";

import { type Locale, SUPPORTED_LOCALES } from "@repo/i18n/config";
import { trackEvent } from "@repo/shared/utils/analytics";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import { Check, ChevronDown, Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { setLocale } from "@/app/actions/locale";

// Language configuration with display names and flag emojis
const LANGUAGE_CONFIG = {
  en: {
    name: "English",
    nativeName: "English",
    flag: "🇬🇧",
    code: "en",
  },
  no: {
    name: "Norwegian",
    nativeName: "Norsk",
    flag: "🇳🇴",
    code: "no",
  },
} as const;

interface LocaleSwitcherProps {
  className?: string;
  showFlag?: boolean;
  showText?: boolean;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "ghost" | "outline";
}

export function LocaleSwitcher({
  variant = "ghost",
  size = "default",
  showFlag = true,
  showText = true,
  className,
}: LocaleSwitcherProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const currentLocale = useLocale() as Locale;
  const t = useTranslations("common");

  const currentLanguage = LANGUAGE_CONFIG[currentLocale];

  const handleLocaleChange = (newLocale: Locale) => {
    if (newLocale === currentLocale) {
      return;
    }

    startTransition(async () => {
      try {
        await setLocale(newLocale);
        trackEvent("language_switch", { from: currentLocale, to: newLocale });
        // Soft-refetch the tree so the root layout re-reads the locale cookie.
        // A hard `window.location.reload()` here would tear down the still-open
        // server-action RSC stream mid-read (surfacing as an unhandled
        // "Error in input stream" in the root error boundary) and, in Firefox,
        // would also trip form-state restoration that strips `disabled` off
        // buttons before React hydrates the fresh document.
        router.refresh();
      } catch (error) {
        console.error("Failed to change locale:", error);
      }
    });
  };

  return (
    <DropdownMenu onOpenChange={setIsOpen} open={isOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-label={t("locale.switcher.label")}
          className={cn(
            "relative gap-2 transition-all duration-200",
            "hover:scale-[1.02] hover:bg-accent/50",
            "data-[state=open]:bg-accent/70",
            // Measured: `focus:ring-*` paints nothing here — the computed
            // box-shadow is all-transparent while `:focus-visible` is true, so
            // this control had no focus indicator on any page. An outline
            // works, and since RD-030 removed the universal `outline-ring/50`
            // it takes the colour it asks for (FINDING-F).
            "focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-solid focus-visible:outline-offset-2",
            isPending && "cursor-not-allowed opacity-50",
            className
          )}
          disabled={isPending}
          size={size}
          variant={variant}
        >
          {showFlag && (
            <span
              aria-label={currentLanguage.name}
              className="text-lg leading-none"
              role="img"
            >
              {currentLanguage.flag}
            </span>
          )}

          {showText && (
            <span className="font-medium">{currentLanguage.nativeName}</span>
          )}

          {!(showText || showFlag) && <Globe className="h-4 w-4" />}

          <ChevronDown
            className={cn(
              "h-3 w-3 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />

          {isPending && (
            <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/50">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="center"
        aria-label={t("locale.switcher.label")}
        className={cn(
          "min-w-[180px] p-2",
          "fade-in-0 zoom-in-95 animate-in duration-200",
          "border shadow-lg backdrop-blur-sm"
        )}
        role="menu"
      >
        {SUPPORTED_LOCALES.map((locale) => {
          const language = LANGUAGE_CONFIG[locale];
          const isSelected = locale === currentLocale;

          return (
            <DropdownMenuItem
              aria-current={isSelected ? "true" : "false"}
              className={cn(
                "flex cursor-pointer items-center gap-3 px-3 py-2.5",
                "transition-all duration-150",
                "hover:bg-accent/50 focus:bg-accent/50",
                "rounded-md",
                "focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-solid focus-visible:-outline-offset-2",
                isSelected && "bg-accent/30 font-medium text-accent-foreground",
                isPending && "cursor-not-allowed opacity-50"
              )}
              disabled={isPending || isSelected}
              key={locale}
              onClick={() => handleLocaleChange(locale)}
              role="menuitem"
            >
              <span
                aria-label={language.name}
                className="text-lg leading-none"
                role="img"
              >
                {language.flag}
              </span>

              <div className="flex flex-1 flex-col gap-0.5">
                <span className="font-medium text-sm">
                  {language.nativeName}
                </span>
                <span className="text-muted-foreground text-xs">
                  {language.name}
                </span>
              </div>

              {isSelected && (
                <Check className="zoom-in-50 h-4 w-4 animate-in text-primary duration-200" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
