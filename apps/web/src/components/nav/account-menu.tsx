"use client";

import { trackEvent } from "@repo/shared/utils/analytics";
import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
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
    // The header's secondary action: an outlined pill beside the one primary
    // CTA. It sits on the header's navy surface, so the aliases are on-navy.
    return (
      <Link
        className={cn(
          "type-body-sm inline-flex shrink-0 items-center gap-1.5 rounded-biso-pill border border-edge px-3 py-1.5 font-semibold text-ink transition-colors hover:border-ink-accent hover:text-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
          className
        )}
        href="/auth/login"
      >
        <LogIn aria-hidden className="size-4" />
        {t("account.signIn")}
      </Link>
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
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-biso-pill p-0.5 text-ink transition-colors hover:text-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
            className
          )}
          type="button"
        >
          <Avatar className="h-8 w-8 border border-edge">
            <AvatarFallback className="type-data bg-action text-action-ink text-xs">
              {account.initials}
            </AvatarFallback>
          </Avatar>
          <ChevronDown aria-hidden className="size-4" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="type-body-sm truncate font-semibold text-ink">
            {account.name}
          </p>
          {account.email && (
            <p className="truncate text-ink-muted text-xs">{account.email}</p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {links.map((link) => (
          <DropdownMenuItem asChild key={link.id}>
            <Link className="cursor-pointer gap-2" href={link.href}>
              {link.icon && (
                <link.icon aria-hidden className="size-4 text-ink-muted" />
              )}
              {t(link.labelKey)}
            </Link>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer gap-2"
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
          <LogOut aria-hidden className="size-4 text-ink-muted" />
          {t("account.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
