import { Check, Download, Mail, X } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { CardGrid } from "@/components/ui/card-grid";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  statusPanelPrimaryAction,
  statusPanelSecondaryAction,
} from "@/components/ui/status-panel";

const PRESS_EMAIL = "contact@biso.no";

const textLink =
  "rounded-biso-sm text-ink-accent underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

interface PressAsset {
  /** File facts shown under the name, e.g. "PNG, 865 × 865 px". */
  details: string;
  href: string;
  /** Logos get room to breathe; the org chart fills its frame. */
  inset: string;
  key: "logoLight" | "logoDark" | "orgChart";
  /**
   * The preview sits on the background the file is meant for, in either
   * theme: the light logo on white, the dark-background logo on navy.
   */
  surface: string;
}

/** Files, not rows — they live in `public/images/`, so the list is static. */
const ASSETS: PressAsset[] = [
  {
    key: "logoLight",
    href: "/images/logo-light.png",
    details: "PNG, 865 × 865 px",
    surface: "bg-paper",
    inset: "p-10",
  },
  {
    key: "logoDark",
    href: "/images/logo-dark.png",
    details: "PNG, 865 × 865 px",
    surface: "bg-deep",
    inset: "p-10",
  },
  {
    key: "orgChart",
    href: "/images/org-chart.png",
    details: "PNG, 1024 × 694 px",
    surface: "bg-paper",
    inset: "p-4",
  },
];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("press.meta");
  return { title: t("title"), description: t("description") };
}

export default async function PressPage() {
  const [t, tCommon] = await Promise.all([
    getTranslations("press"),
    getTranslations("common"),
  ]);
  const doItems = t.raw("usage.do") as string[];
  const dontItems = t.raw("usage.dont") as string[];

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: t("title") },
        ]}
        lede={t("subtitle")}
        title={t("title")}
      />

      <Section tone="paper">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div className="min-w-0">
            <SectionHeading>{t("intro.title")}</SectionHeading>
            <p className="type-body max-w-(--measure) text-ink-muted">
              {t("intro.body")}
            </p>
          </div>

          <div className="rounded-biso-md border border-edge p-6">
            <h2 className="type-heading-card text-ink">{t("contact.title")}</h2>
            <p className="type-body-sm mt-2 text-ink-muted">
              {t("contact.body")}
            </p>
            <p className="type-body mt-3">
              <a
                className={`${textLink} break-words`}
                href={`mailto:${PRESS_EMAIL}`}
              >
                {PRESS_EMAIL}
              </a>
            </p>
            <p className="mt-6">
              <a
                className={statusPanelPrimaryAction}
                href={`mailto:${PRESS_EMAIL}`}
              >
                <Mail aria-hidden="true" className="size-4 shrink-0" />
                {t("contact.cta")}
              </a>
            </p>
          </div>
        </div>
      </Section>

      <Section className="border-edge border-t" tone="paper">
        <SectionHeading>{t("assets.title")}</SectionHeading>
        <p className="type-body mb-8 max-w-(--measure) text-ink-muted">
          {t("assets.lead")}
        </p>
        <CardGrid>
          {ASSETS.map((asset) => {
            const name = t(`assets.${asset.key}`);
            return (
              <li
                className="flex h-full flex-col overflow-hidden rounded-biso-md border border-edge"
                key={asset.key}
              >
                <div
                  className={`relative aspect-4/3 border-edge border-b ${asset.surface}`}
                >
                  <Image
                    alt=""
                    className={`object-contain ${asset.inset}`}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
                    src={asset.href}
                  />
                </div>
                <div className="flex flex-1 flex-wrap items-center justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <h3 className="type-heading-card break-words text-ink">
                      {name}
                    </h3>
                    <p className="type-body-sm mt-1 text-ink-muted">
                      {asset.details}
                    </p>
                  </div>
                  <a
                    aria-label={t("assets.downloadAria", { name })}
                    className={statusPanelSecondaryAction}
                    download
                    href={asset.href}
                  >
                    <Download aria-hidden="true" className="size-4 shrink-0" />
                    {t("assets.download")}
                  </a>
                </div>
              </li>
            );
          })}
        </CardGrid>
      </Section>

      <Section className="border-edge border-t" tone="paper">
        <SectionHeading>{t("usage.title")}</SectionHeading>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-biso-md border border-edge p-6">
            <h3 className="type-heading-card text-ink">{t("usage.doTitle")}</h3>
            <ul className="mt-4 space-y-3">
              {doItems.map((item) => (
                <li className="flex items-start gap-3" key={item}>
                  <Check
                    aria-hidden="true"
                    className="mt-1 size-4 shrink-0 text-success"
                  />
                  <span className="type-body text-ink-muted">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-biso-md border border-edge p-6">
            <h3 className="type-heading-card text-ink">
              {t("usage.dontTitle")}
            </h3>
            <ul className="mt-4 space-y-3">
              {dontItems.map((item) => (
                <li className="flex items-start gap-3" key={item}>
                  <X
                    aria-hidden="true"
                    className="mt-1 size-4 shrink-0 text-danger"
                  />
                  <span className="type-body text-ink-muted">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="type-body mt-8 max-w-(--measure) text-ink-muted">
          {t("usage.note")}{" "}
          <a className={textLink} href={`mailto:${PRESS_EMAIL}`}>
            {PRESS_EMAIL}
          </a>
        </p>
      </Section>
    </>
  );
}
