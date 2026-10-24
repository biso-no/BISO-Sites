"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * Lets a visitor override the system colour scheme.
 *
 * `ThemeProvider` has been mounted the whole time, but RD-017 removed v1's
 * `<ModeToggle>` from the header on the stated plan that the toggle would
 * "move into the account menu" — and it never arrived there. PR review caught
 * that nothing in `apps/web` called `setTheme` any more, so the persisted and
 * system themes could not be overridden from anywhere.
 *
 * It lives beside `<LocaleSwitcher>` rather than in the account menu the
 * comment named: for an anonymous visitor the account menu is a plain sign-in
 * button, so a control placed there would not exist for most of the site's
 * traffic. The locale switcher is the same kind of preference control and is
 * already in both the desktop utility group and the mobile drawer.
 *
 * Replaces `@repo/ui`'s `<ModeToggle>`, whose three options and screen-reader
 * label were hardcoded English.
 */
const THEMES = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
] as const;

interface ThemeSwitcherProps {
  className?: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "ghost" | "outline";
}

export function ThemeSwitcher({
  className,
  size = "default",
  variant = "ghost",
}: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("common.theme");
  // `theme` is undefined until next-themes has read storage on the client.
  // Rendering the resolved icon before then produces a hydration mismatch, so
  // the trigger shows the neutral system icon until mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const active = mounted ? (theme ?? "system") : "system";
  const ActiveIcon =
    THEMES.find((option) => option.value === active)?.icon ?? Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t("label")}
          className={cn("shrink-0 gap-2", className)}
          size={size}
          variant={variant}
        >
          <ActiveIcon aria-hidden="true" className="h-4 w-4" />
          <span className="sr-only">{t("label")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {THEMES.map(({ value, icon: Icon }) => (
          <DropdownMenuItem
            className="cursor-pointer justify-between gap-3"
            key={value}
            // Not analytics-tracked: `AnalyticsEventName` is a closed union in
            // `@repo/shared`, and widening a shared package for a nice-to-have
            // is not worth the blast radius.
            onClick={() => setTheme(value)}
          >
            <span className="inline-flex items-center gap-2">
              <Icon aria-hidden="true" className="h-4 w-4" />
              {t(value)}
            </span>
            {active === value && (
              <Check aria-hidden="true" className="h-4 w-4" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
