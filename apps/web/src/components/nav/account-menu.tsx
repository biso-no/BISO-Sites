"use client";

import { trackEvent } from "@repo/shared/utils/analytics";
import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { ChevronDown, LogIn, LogOut } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { signOut } from "@/lib/server";
import type { NavAccount } from "@/lib/types/nav";
import { ACCOUNT_LINKS, FINANCIAL_SERVICES_LINK_ID } from "./nav-config";

/**
 * Drops the `expenses_module`-gated entry when the flag is off, so the menu
 * never advertises a route that only renders `<ExpensesUnavailable />`.
 */
export function accountLinksFor(account: NavAccount) {
  return account.showFinancialServices
    ? ACCOUNT_LINKS
    : ACCOUNT_LINKS.filter((link) => link.id !== FINANCIAL_SERVICES_LINK_ID);
}

interface AccountMenuProps {
  account: NavAccount | null;
  className?: string;
}

/**
 * The signed-in entry point to the personal routes (`/profile`,
 * `/applications`, `/fs`, `/member`), plus sign-out. Anonymous visitors get a
 * plain sign-in link instead.
 */
export function AccountMenu({ account, className }: AccountMenuProps) {
  const t = useTranslations("common.navigation");
  const [isSigningOut, startSignOut] = useTransition();

  if (!account) {
    return (
      <Button
        asChild
        className={`shrink-0 border-brand bg-transparent text-white hover:bg-brand hover:text-white ${className ?? ""}`}
        size="sm"
        variant="outline"
      >
        <Link href="/auth/login">
          <LogIn aria-hidden className="mr-1.5 h-4 w-4" />
          {t("account.signIn")}
        </Link>
      </Button>
    );
  }

  const links = accountLinksFor(account);

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) {
          trackEvent("nav_menu_open", { panel: "account" });
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          aria-label={t("account.menuLabel")}
          className={`flex shrink-0 items-center gap-1 rounded-full p-0.5 text-white transition-colors hover:text-brand ${className ?? ""}`}
          type="button"
        >
          <Avatar className="h-8 w-8 border border-brand/60">
            <AvatarFallback className="bg-brand font-semibold text-white text-xs">
              {account.initials}
            </AvatarFallback>
          </Avatar>
          <ChevronDown aria-hidden className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate font-semibold text-sm">{account.name}</p>
          {account.email && (
            <p className="truncate text-muted-foreground text-xs">
              {account.email}
            </p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {links.map((link) => (
          <DropdownMenuItem asChild key={link.id}>
            <Link href={link.href}>
              {link.icon && (
                <link.icon aria-hidden className="mr-2 h-4 w-4 opacity-80" />
              )}
              {t(link.labelKey)}
            </Link>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isSigningOut}
          onSelect={(event) => {
            // Keep the item mounted while the action runs; the server action
            // redirects, so the menu unmounts with the navigation instead.
            event.preventDefault();
            startSignOut(async () => {
              await signOut();
            });
          }}
        >
          <LogOut aria-hidden className="mr-2 h-4 w-4 opacity-80" />
          {t("account.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
