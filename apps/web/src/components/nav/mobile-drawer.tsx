"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { Button } from "@repo/ui/components/ui/button";
import { LogIn, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useCampus } from "@/components/context/campus";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SelectCampus } from "@/components/select-campus";
import { signOut } from "@/lib/server";
import type { NavAccount } from "@/lib/types/nav";
import { accountLinksFor } from "./account-menu";
import { CampusLink } from "./campus-link";
import { PanelLink } from "./mega-panel";
import {
  ABOUT_COLUMNS,
  PROJECT_FLAGSHIP_ICON,
  PROJECT_FLAGSHIP_KEYS,
  PROJECT_LINKS,
  STANDALONE_LINKS,
  STUDENT_CAMPUS_HEADING_KEY,
  STUDENT_COLUMNS,
} from "./nav-config";

interface MobileDrawerProps {
  /** Resolved server-side; `null` for anonymous visitors. */
  account: NavAccount | null;
  isMember: boolean;
  onNavigate: () => void;
}

const HEADING_CLASS =
  "mb-1 font-semibold text-white/50 text-xs uppercase tracking-wider";

export function MobileDrawer({
  account,
  isMember,
  onNavigate,
}: MobileDrawerProps) {
  const t = useTranslations("common.navigation");
  const tProjects = useTranslations("projects.featured");
  const { campuses } = useCampus();
  const router = useRouter();
  const [isSigningOut, startSignOut] = useTransition();

  const go = (href: string) => {
    router.push(href);
    onNavigate();
  };

  return (
    <div className="space-y-4 px-4 py-6">
      <Accordion collapsible type="single">
        <AccordionItem className="border-brand-border" value="students">
          <AccordionTrigger className="text-white">
            {t("triggers.students")}
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              {STUDENT_COLUMNS.map((column) => (
                <div key={column.id}>
                  <p className={HEADING_CLASS}>{t(column.headingKey)}</p>
                  {column.links.map((link) => (
                    <PanelLink
                      href={link.href}
                      icon={link.icon}
                      key={link.id}
                      label={t(link.labelKey)}
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              ))}
              <div>
                <p className={HEADING_CLASS}>{t(STUDENT_CAMPUS_HEADING_KEY)}</p>
                {campuses.map((campus) => (
                  <CampusLink
                    campus={campus}
                    key={campus.$id}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem className="border-brand-border" value="projects">
          <AccordionTrigger className="text-white">
            {t("triggers.projects")}
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div>
                <p className={HEADING_CLASS}>{t("columns.flagships")}</p>
                {PROJECT_FLAGSHIP_KEYS.map((key) => (
                  <PanelLink
                    href={`/projects/${tProjects(`${key}.slug`)}`}
                    icon={PROJECT_FLAGSHIP_ICON}
                    key={key}
                    label={tProjects(`${key}.title`)}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
              <div>
                <p className={HEADING_CLASS}>{t("events")}</p>
                {PROJECT_LINKS.map((link) => (
                  <PanelLink
                    href={link.href}
                    icon={link.icon}
                    key={link.id}
                    label={t(link.labelKey)}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem className="border-brand-border" value="about">
          <AccordionTrigger className="text-white">
            {t("triggers.about")}
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              {ABOUT_COLUMNS.map((column) => (
                <div key={column.id}>
                  <p className={HEADING_CLASS}>{t(column.headingKey)}</p>
                  {column.links.map((link) => (
                    <PanelLink
                      href={link.href}
                      icon={link.icon}
                      key={link.id}
                      label={t(link.labelKey)}
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="space-y-1">
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
        <div>
          <p className={HEADING_CLASS}>{t("account.heading")}</p>
          {accountLinksFor(account).map((link) => (
            <PanelLink
              href={link.href}
              icon={link.icon}
              key={link.id}
              label={t(link.labelKey)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}

      <SelectCampus campuses={campuses} className="w-full text-white" />
      <LocaleSwitcher className="w-full text-white" size="sm" variant="ghost" />

      <div className="space-y-2">
        <Button
          className="w-full border-brand bg-transparent text-white hover:bg-brand hover:text-white"
          onClick={() => go("/business")}
          variant="outline"
        >
          {t("partner")}
        </Button>
        <Button
          className="w-full border-brand bg-transparent text-white hover:bg-brand hover:text-white"
          onClick={() => go("/jobs")}
          variant="outline"
        >
          {t("applyVerv")}
        </Button>
        {isMember ? (
          <Button
            className="w-full bg-brand text-white hover:bg-brand/90"
            onClick={() => go("/member")}
          >
            {t("memberPortal")}
          </Button>
        ) : (
          <Button
            className="w-full bg-brand text-white hover:bg-brand/90"
            onClick={() => go("/membership")}
          >
            {t("becomeMember")}
          </Button>
        )}
        {account ? (
          <Button
            className="w-full text-white hover:bg-brand-muted"
            disabled={isSigningOut}
            onClick={() =>
              startSignOut(async () => {
                await signOut();
              })
            }
            variant="ghost"
          >
            <LogOut aria-hidden className="mr-2 h-4 w-4" />
            {t("account.signOut")}
          </Button>
        ) : (
          <Button
            className="w-full text-white hover:bg-brand-muted"
            onClick={() => go("/auth/login")}
            variant="ghost"
          >
            <LogIn aria-hidden className="mr-2 h-4 w-4" />
            {t("account.signIn")}
          </Button>
        )}
      </div>
    </div>
  );
}
