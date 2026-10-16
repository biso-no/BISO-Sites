"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { cn } from "@repo/ui/lib/utils";
import { LogIn, LogOut } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { type ReactNode, useTransition } from "react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import {
  statusPanelPrimaryAction,
  statusPanelSecondaryAction,
} from "@/components/ui/status-panel";
import { signOut } from "@/lib/server";
import type { NavAccount, NavProjectLink } from "@/lib/types/nav";
import { accountLinksFor } from "./account-menu";
import { ActiveCampusLink } from "./campus-link";
import { PANEL_HEADING_CLASS, PanelLink } from "./mega-panel";
import {
  ABOUT_COLUMNS,
  PROJECT_FLAGSHIP_ICON,
  PROJECT_FLAGSHIP_KEYS,
  PROJECT_LINKS,
  STANDALONE_LINKS,
  STUDENT_COLUMNS,
} from "./nav-config";
import { CampusProjectLinks } from "./panels/projects-panel";

interface MobileDrawerProps {
  /** Resolved server-side; `null` for anonymous visitors. */
  account: NavAccount | null;
  isMember: boolean;
  onNavigate: () => void;
  /** Unit-run projects with a public page, resolved server-side. */
  projectLinks: NavProjectLink[];
}

const TRIGGER_CLASS =
  "rounded-biso-sm py-3 font-semibold text-base text-ink hover:text-ink-accent hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring [&>svg]:text-ink-muted";

/** A labelled group of links inside an accordion section. */
function DrawerGroup({
  children,
  heading,
}: {
  children: ReactNode;
  heading: string;
}) {
  return (
    <div>
      <p className={PANEL_HEADING_CLASS}>{heading}</p>
      {children}
    </div>
  );
}

/**
 * The header below the desktop breakpoint: the three panels as accordion
 * sections, then the standalone links, the account links, the preference
 * switchers and one primary action.
 *
 * It mirrors the desktop header rather than keeping controls of its own. The
 * campus filter is the `<CampusPill>` the header pins above this drawer — the
 * one place to change campus — so there is no campus switcher and no list of
 * campuses here. Business is a standalone link, as on desktop. Jobs is in the
 * "For students" section, so there is no separate "apply" button.
 *
 * Every destination is a real `<Link>`: the buttons that called
 * `router.push()` lost prefetch, middle-click and open-in-new-tab.
 */
export function MobileDrawer({
  account,
  isMember,
  onNavigate,
  projectLinks,
}: MobileDrawerProps) {
  const t = useTranslations("common.navigation");
  const tProjects = useTranslations("projects.featured");
  const [isSigningOut, startSignOut] = useTransition();

  return (
    <div className="space-y-6 px-4 pt-2 pb-8">
      <Accordion collapsible type="single">
        <AccordionItem className="border-edge" value="students">
          <AccordionTrigger className={TRIGGER_CLASS}>
            {t("triggers.students")}
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-5">
              {STUDENT_COLUMNS.map((column) => (
                <DrawerGroup heading={t(column.headingKey)} key={column.id}>
                  {column.links.map((link) => (
                    <PanelLink
                      href={link.href}
                      icon={link.icon}
                      key={link.id}
                      label={t(link.labelKey)}
                      onNavigate={onNavigate}
                    />
                  ))}
                </DrawerGroup>
              ))}
              <DrawerGroup heading={t("columns.campus")}>
                {/* Same as the desktop panel: one link to the campus you are
                    on, not a list — the pill above changes campus. */}
                <ActiveCampusLink onNavigate={onNavigate} />
              </DrawerGroup>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem className="border-edge" value="projects">
          <AccordionTrigger className={TRIGGER_CLASS}>
            {t("triggers.projects")}
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-5">
              <DrawerGroup heading={t("columns.flagships")}>
                {PROJECT_FLAGSHIP_KEYS.map((key) => (
                  <PanelLink
                    href={`/projects/${tProjects(`${key}.slug`)}`}
                    icon={PROJECT_FLAGSHIP_ICON}
                    key={key}
                    label={tProjects(`${key}.title`)}
                    onNavigate={onNavigate}
                  />
                ))}
              </DrawerGroup>
              <CampusProjectLinks
                headingAs="p"
                onNavigate={onNavigate}
                projectLinks={projectLinks}
              />
              <DrawerGroup heading={t("events")}>
                {PROJECT_LINKS.map((link) => (
                  <PanelLink
                    href={link.href}
                    icon={link.icon}
                    key={link.id}
                    label={t(link.labelKey)}
                    onNavigate={onNavigate}
                  />
                ))}
              </DrawerGroup>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem className="border-edge" value="about">
          <AccordionTrigger className={TRIGGER_CLASS}>
            {t("triggers.about")}
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-5">
              {ABOUT_COLUMNS.map((column) => (
                <DrawerGroup heading={t(column.headingKey)} key={column.id}>
                  {column.links.map((link) => (
                    <PanelLink
                      href={link.href}
                      icon={link.icon}
                      key={link.id}
                      label={t(link.labelKey)}
                      onNavigate={onNavigate}
                    />
                  ))}
                </DrawerGroup>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="space-y-0.5">
        {STANDALONE_LINKS.map((link) => (
          <PanelLink
            href={link.href}
            icon={link.icon}
            key={link.id}
            label={t(link.labelKey)}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      {account && (
        <DrawerGroup heading={t("account.heading")}>
          {accountLinksFor(account).map((link) => (
            <PanelLink
              href={link.href}
              icon={link.icon}
              key={link.id}
              label={t(link.labelKey)}
              onNavigate={onNavigate}
            />
          ))}
        </DrawerGroup>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <LocaleSwitcher className="text-ink" size="sm" variant="ghost" />
        <ThemeSwitcher className="text-ink" size="sm" variant="ghost" />
      </div>

      <div className="space-y-3">
        {/* Members are already members: they get their portal instead. The
            status comes from the server, so the first paint is right. */}
        {isMember ? (
          <Link
            className={cn(statusPanelPrimaryAction, "w-full justify-center")}
            href="/member"
            onClick={onNavigate}
          >
            {t("memberPortal")}
          </Link>
        ) : (
          <Link
            className={cn(statusPanelPrimaryAction, "w-full justify-center")}
            href="/membership"
            onClick={onNavigate}
          >
            {t("becomeMember")}
          </Link>
        )}
        {account ? (
          <button
            className={cn(
              statusPanelSecondaryAction,
              "w-full justify-center disabled:opacity-60"
            )}
            disabled={isSigningOut}
            onClick={() =>
              startSignOut(async () => {
                await signOut();
              })
            }
            type="button"
          >
            <LogOut aria-hidden className="size-4" />
            {t("account.signOut")}
          </button>
        ) : (
          <Link
            className={cn(statusPanelSecondaryAction, "w-full justify-center")}
            href="/auth/login"
            onClick={onNavigate}
          >
            <LogIn aria-hidden className="size-4" />
            {t("account.signIn")}
          </Link>
        )}
      </div>
    </div>
  );
}
