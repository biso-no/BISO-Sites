"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import { Check, ChevronDown, Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { setLocale } from "@/app/actions/locale";
import { type Locale, SUPPORTED_LOCALES } from "@/i18n/config";

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
  variant?: "default" | "ghost" | "outline";
  size?: "sm" | "default" | "lg";
  showFlag?: boolean;
  showText?: boolean;
  className?: string;
}

export function LocaleSwitcher({
  variant = "ghost",
  size = "default",
  showFlag = true,
  showText = true,
  className,
}: LocaleSwitcherProps) {
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const currentLocale = useLocale() as Locale;
  const t = useTranslations("common");

  const currentLanguage = LANGUAGE_CONFIG[currentLocale];

  const handleLocaleChange = (newLocale: Locale) => {
    if (newLocale === currentLocale) return;

    startTransition(async () => {
      try {
        await setLocale(newLocale);
        // Refresh the page to apply the new locale
        window.location.reload();
      } catch (error) {
        console.error("Failed to change locale:", error);
      }
    });
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={isPending}
          aria-label={t("locale.switcher.label")}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          className={cn(
            "relative gap-2 transition-all duration-200",
            "hover:bg-accent/50 hover:scale-[1.02]",
            "data-[state=open]:bg-accent/70",
            "focus:ring-2 focus:ring-primary focus:ring-offset-2",
            isPending && "opacity-50 cursor-not-allowed",
            className,
          )}
        >
          {showFlag && (
            <span className="text-lg leading-none" role="img" aria-label={currentLanguage.name}>
              {currentLanguage.flag}
            </span>
          )}

          {showText && <span className="font-medium">{currentLanguage.nativeName}</span>}

          {!showText && !showFlag && <Globe className="h-4 w-4" />}

          <ChevronDown
            className={cn("h-3 w-3 transition-transform duration-200", isOpen && "rotate-180")}
          />

          {isPending && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-md">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        role="menu"
        aria-label={t("locale.switcher.label")}
        className={cn(
          "min-w-[180px] p-2",
          "animate-in fade-in-0 zoom-in-95 duration-200",
          "border shadow-lg backdrop-blur-sm",
        )}
      >
        {SUPPORTED_LOCALES.map((locale) => {
          const language = LANGUAGE_CONFIG[locale];
          const isSelected = locale === currentLocale;

          return (
            <DropdownMenuItem
              key={locale}
              onClick={() => handleLocaleChange(locale)}
              disabled={isPending || isSelected}
              role="menuitem"
              aria-current={isSelected ? "true" : "false"}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 cursor-pointer",
                "transition-all duration-150",
                "hover:bg-accent/50 focus:bg-accent/50",
                "rounded-md",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset",
                isSelected && "bg-accent/30 text-accent-foreground font-medium",
                isPending && "opacity-50 cursor-not-allowed",
              )}
            >
              <span className="text-lg leading-none" role="img" aria-label={language.name}>
                {language.flag}
              </span>

              <div className="flex flex-col gap-0.5 flex-1">
                <span className="text-sm font-medium">{language.nativeName}</span>
                <span className="text-xs text-muted-foreground">{language.name}</span>
              </div>

              {isSelected && (
                <Check className="h-4 w-4 text-primary animate-in zoom-in-50 duration-200" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
