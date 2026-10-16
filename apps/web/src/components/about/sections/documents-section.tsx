import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CardGrid } from "@/components/ui/card-grid";
import { AboutSection } from "./section-shell";

/** Where the governing documents and policies live. */
const LINKS = [
  { href: "/documents?category=campus-bylaws", key: "bylaws" },
  { href: "/documents?category=national-statutes", key: "statutes" },
  { href: "/documents?category=code-of-conduct", key: "conduct" },
  { href: "/about/drugs-policy", key: "drugsPolicy" },
  { href: "/safety", key: "safety" },
  { href: "/documents", key: "all" },
] as const;

export async function DocumentsSection() {
  const t = await getTranslations("about.documents");
  return (
    <AboutSection id="dokumenter" intro={t("intro")} title={t("title")}>
      <CardGrid className="xl:grid-cols-3" columns={2}>
        {LINKS.map((link) => (
          <li key={link.key}>
            <Link
              className="group flex h-full flex-col rounded-biso-md border border-edge p-6 transition-colors hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              href={link.href}
            >
              <span className="type-heading-card flex items-start justify-between gap-3 text-ink group-hover:text-ink-accent">
                <span className="min-w-0 break-words">
                  {t(`items.${link.key}.title`)}
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="mt-1 size-4 shrink-0 text-ink-muted group-hover:text-ink-accent"
                />
              </span>
              <span className="type-body-sm mt-2 text-ink-muted">
                {t(`items.${link.key}.description`)}
              </span>
            </Link>
          </li>
        ))}
      </CardGrid>
    </AboutSection>
  );
}
