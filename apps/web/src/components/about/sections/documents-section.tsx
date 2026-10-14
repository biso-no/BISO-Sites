"use client";

import { Card } from "@repo/ui/components/ui/card";
import {
  ArrowRight,
  FileText,
  Gavel,
  type LucideIcon,
  Scale,
  Shield,
  ShieldAlert,
  Wine,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AboutSection } from "./section-shell";

interface DocumentLink {
  href: string;
  icon: LucideIcon;
  key: string;
}

/** Where the governing documents and policies live. */
const LINKS: DocumentLink[] = [
  { href: "/documents?category=campus-bylaws", icon: Gavel, key: "bylaws" },
  {
    href: "/documents?category=national-statutes",
    icon: Scale,
    key: "statutes",
  },
  {
    href: "/documents?category=code-of-conduct",
    icon: Shield,
    key: "conduct",
  },
  { href: "/about/drugs-policy", icon: Wine, key: "drugsPolicy" },
  { href: "/safety", icon: ShieldAlert, key: "safety" },
  { href: "/documents", icon: FileText, key: "all" },
];

export function DocumentsSection() {
  const t = useTranslations("about.documents");
  return (
    <AboutSection
      id="dokumenter"
      intro={t("intro")}
      muted
      title={t("title")}
      wide
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map((link) => (
          <Link className="group block h-full" href={link.href} key={link.key}>
            <Card className="flex h-full items-start gap-4 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand-gradient-from to-brand-gradient-to shadow-md">
                <link.icon className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  {t(`items.${link.key}.title`)}
                  <ArrowRight className="h-4 w-4 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                </h3>
                <p className="mt-1 text-muted-foreground text-sm">
                  {t(`items.${link.key}.description`)}
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </AboutSection>
  );
}
