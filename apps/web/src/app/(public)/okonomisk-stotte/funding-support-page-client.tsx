"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  HandCoins,
  Lightbulb,
  Mail,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { AboutHero } from "@/components/about/about-hero";

/**
 * Links carried over from the legacy WordPress page (`/sok-okonomisk-stotte`).
 * They are the fallback whenever the `funding_programs` row is missing or leaves
 * a field blank — see `resolveLinks` in `page.tsx`.
 */
export const DEFAULT_PROGRAM_LINKS = {
  applicationUrl:
    "https://forms.office.com/Pages/ResponsePage.aspx?id=uRehdEOThky0TTmMiLoe2FOe5pmVgIlCoeSQuuBKzqdUMVhKSjVYVEdZTDZEU0hMM1FEWkJOMTVSOS4u",
  boardEmail: "board@biso.no",
  budgetUrl:
    "https://bistudentorganisasjon-my.sharepoint.com/:x:/g/personal/board_biso_no/EShBxvGQKdtLuv6-ng9-L1MBGbnuW1FbW5PX8E_J4nyAgw?e=RTJjjw",
  financeEmail: "manager.finance@biso.no",
  guidelinesUrl:
    "https://bistudentorganisasjon-my.sharepoint.com/:p:/g/personal/board_biso_no/EThQ35fgR4NImshiAX2qvlABVypujhy73ON4jaAueix4mQ?e=gjZp7G",
  isOpen: true,
  overrideDocuments: null,
  termsUrl:
    "https://bistudentorganisasjon-my.sharepoint.com/:b:/g/personal/board_biso_no/EdHeZW5FxZFPg0ayHcHSxfoBKAiQxvBFIJ5s3q3iLjNgrg?e=hrlCUb",
} as const satisfies FundingSupportLinks;

export interface FundingSupportDocument {
  href: string;
  kind: "doc" | "sheet";
  label: string;
}

export interface FundingSupportLinks {
  applicationUrl: string;
  boardEmail: string;
  budgetUrl: string;
  financeEmail: string;
  guidelinesUrl: string;
  isOpen: boolean;
  /** When the Appwrite row supplies its own list, it replaces the three defaults wholesale. */
  overrideDocuments: FundingSupportDocument[] | null;
  termsUrl: string;
}

const SECTION_SHELL = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";
const FADE_UP = {
  initial: { opacity: 0, y: 20 },
  transition: { duration: 0.5 },
  viewport: { once: true },
  whileInView: { opacity: 1, y: 0 },
} as const;

function SectionIntro({
  label,
  lead,
  title,
}: {
  label: string;
  lead?: string;
  title: string;
}) {
  return (
    <motion.div className="mb-10 max-w-3xl" {...FADE_UP}>
      <div className="mb-4 inline-block rounded-full bg-brand-muted px-4 py-2 font-medium text-brand-dark text-sm">
        {label}
      </div>
      <h2 className="font-bold text-2xl text-foreground md:text-3xl">
        {title}
      </h2>
      {lead ? (
        <p className="mt-3 text-muted-foreground leading-relaxed">{lead}</p>
      ) : null}
    </motion.div>
  );
}

function ApplyButton({
  href,
  label,
  ariaLabel,
}: {
  ariaLabel: string;
  href: string;
  label: string;
}) {
  return (
    <Button
      asChild
      className="bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white shadow-md transition-transform hover:scale-[1.02]"
      size="lg"
    >
      <a
        aria-label={ariaLabel}
        href={href}
        rel="noopener noreferrer"
        target="_blank"
      >
        {label}
        <ArrowRight className="ml-2 h-4 w-4" />
      </a>
    </Button>
  );
}

function IntroSection({ links }: { links: FundingSupportLinks }) {
  const t = useTranslations("fundingProgram");

  return (
    <section className="py-16" id="about-content">
      <div className={SECTION_SHELL}>
        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:items-start">
          <motion.div {...FADE_UP}>
            <div className="mb-4 inline-block rounded-full bg-brand-muted px-4 py-2 font-medium text-brand-dark text-sm">
              {t("intro.label")}
            </div>
            <h2 className="font-bold text-2xl text-foreground md:text-3xl">
              {t("intro.title")}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              {t("intro.lead")}
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              {t("intro.body")}
            </p>
          </motion.div>

          <motion.div
            className="lg:sticky lg:top-24"
            {...FADE_UP}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <Card className="border-brand-border bg-card/80 p-6 shadow-lg backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    links.isOpen ? "bg-brand" : "bg-muted-foreground"
                  }`}
                />
                <p className="font-medium text-foreground text-sm">
                  {links.isOpen ? t("status.open") : t("status.closed")}
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-3">
                {links.isOpen ? (
                  <ApplyButton
                    ariaLabel={t("cta.applyAria")}
                    href={links.applicationUrl}
                    label={t("cta.apply")}
                  />
                ) : null}
                <Button asChild size="lg" variant="outline">
                  <a href={`mailto:${links.financeEmail}`}>
                    <Mail className="mr-2 h-4 w-4" />
                    {t("cta.contact")}
                  </a>
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function EligibilityGroup({
  items,
  title,
  delay,
}: {
  delay: number;
  items: string[];
  title: string;
}) {
  return (
    <motion.div {...FADE_UP} transition={{ delay, duration: 0.5 }}>
      <Card className="h-full border-border/50 bg-card/80 p-6 backdrop-blur-sm">
        <h3 className="font-semibold text-foreground text-lg">{title}</h3>
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li className="flex items-start gap-3" key={item}>
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
              <span className="text-muted-foreground leading-relaxed">
                {item}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </motion.div>
  );
}

function EligibilitySection() {
  const t = useTranslations("fundingProgram");
  const bisoItems = t.raw("eligibility.groups.biso.items") as string[];
  const otherItems = t.raw("eligibility.groups.others.items") as string[];

  return (
    <section className="bg-section/50 py-16">
      <div className={SECTION_SHELL}>
        <SectionIntro
          label={t("eligibility.label")}
          lead={t("eligibility.lead")}
          title={t("eligibility.title")}
        />
        <div className="grid gap-6 md:grid-cols-2">
          <EligibilityGroup
            delay={0}
            items={bisoItems}
            title={t("eligibility.groups.biso.title")}
          />
          <EligibilityGroup
            delay={0.1}
            items={otherItems}
            title={t("eligibility.groups.others.title")}
          />
        </div>
      </div>
    </section>
  );
}

function UsesSection() {
  const t = useTranslations("fundingProgram");
  const items = t.raw("uses.items") as string[];
  const specifically = t.raw("uses.specifically") as string[];

  return (
    <section className="py-16">
      <div className={SECTION_SHELL}>
        <SectionIntro
          label={t("uses.label")}
          lead={t("uses.lead")}
          title={t("uses.title")}
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, index) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              key={item}
              transition={{ delay: index * 0.06, duration: 0.4 }}
              viewport={{ once: true }}
              whileInView={{ opacity: 1, y: 0 }}
            >
              <Card className="h-full border-border/50 bg-card/80 p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-border hover:shadow-lg">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-brand-gradient-from to-brand-gradient-to shadow-md">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {item}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div className="mt-10" {...FADE_UP}>
          <h3 className="font-semibold text-foreground">
            {t("uses.specificallyTitle")}
          </h3>
          <div className="mt-4 flex flex-wrap gap-3">
            {specifically.map((item) => (
              <span
                className="rounded-full border border-brand-border bg-brand-muted px-4 py-2 font-medium text-brand-dark text-sm"
                key={item}
              >
                {item}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ProcessSection() {
  const t = useTranslations("fundingProgram");
  const steps = t.raw("process.steps") as { body: string; title: string }[];

  return (
    <section className="bg-section/50 py-16">
      <div className={SECTION_SHELL}>
        <SectionIntro
          label={t("process.label")}
          lead={t("process.lead")}
          title={t("process.title")}
        />

        <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <motion.li
              initial={{ opacity: 0, y: 20 }}
              key={step.title}
              transition={{ delay: index * 0.08, duration: 0.4 }}
              viewport={{ once: true }}
              whileInView={{ opacity: 1, y: 0 }}
            >
              <Card className="h-full border-border/50 bg-card p-6 shadow-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand font-semibold text-sm text-white">
                  {index + 1}
                </span>
                <h3 className="mt-4 font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
                  {step.body}
                </p>
              </Card>
            </motion.li>
          ))}
        </ol>

        <motion.p
          className="mt-8 flex items-start gap-3 rounded-2xl border border-brand-border bg-brand-muted p-5 text-brand-dark text-sm leading-relaxed"
          {...FADE_UP}
        >
          <ClipboardList className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{t("process.note")}</span>
        </motion.p>
      </div>
    </section>
  );
}

function TipsSection() {
  const t = useTranslations("fundingProgram");
  const items = t.raw("tips.items") as string[];

  return (
    <section className="py-16">
      <div className={SECTION_SHELL}>
        <SectionIntro
          label={t("tips.label")}
          lead={t("tips.lead")}
          title={t("tips.title")}
        />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              key={item}
              transition={{ delay: index * 0.06, duration: 0.4 }}
              viewport={{ once: true }}
              whileInView={{ opacity: 1, y: 0 }}
            >
              <Card className="flex h-full items-start gap-4 border-border/50 bg-card/80 p-5 backdrop-blur-sm">
                <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-brand-accent" />
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {item}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface DocumentCardProps {
  action: string;
  description?: string;
  href: string;
  kind: "doc" | "sheet";
  title: string;
}

function DocumentCard({
  action,
  delay,
  description,
  href,
  kind,
  title,
}: DocumentCardProps & { delay: number }) {
  const Icon = kind === "sheet" ? FileSpreadsheet : FileText;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay, duration: 0.4 }}
      viewport={{ once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <a
        className="block h-full"
        href={href}
        rel="noopener noreferrer"
        target="_blank"
      >
        <Card className="group h-full border-border/50 bg-card/80 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-border hover:shadow-lg">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-brand-gradient-from to-brand-gradient-to shadow-md transition-transform duration-300 group-hover:scale-110">
            <Icon className="h-6 w-6 text-white" />
          </div>
          <h3 className="mt-4 font-semibold text-foreground transition-colors group-hover:text-brand">
            {title}
          </h3>
          {description ? (
            <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
              {description}
            </p>
          ) : null}
          <span className="mt-4 inline-flex items-center gap-2 font-medium text-brand text-sm">
            {action}
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </Card>
      </a>
    </motion.div>
  );
}

function DocumentsSection({ links }: { links: FundingSupportLinks }) {
  const t = useTranslations("fundingProgram");

  const defaults: DocumentCardProps[] = [
    {
      action: t("documents.terms.action"),
      description: t("documents.terms.description"),
      href: links.termsUrl,
      kind: "doc",
      title: t("documents.terms.title"),
    },
    {
      action: t("documents.budget.action"),
      description: t("documents.budget.description"),
      href: links.budgetUrl,
      kind: "sheet",
      title: t("documents.budget.title"),
    },
    {
      action: t("documents.guidelines.action"),
      description: t("documents.guidelines.description"),
      href: links.guidelinesUrl,
      kind: "doc",
      title: t("documents.guidelines.title"),
    },
  ];

  const cards: DocumentCardProps[] = links.overrideDocuments
    ? links.overrideDocuments.map((doc) => ({
        action: t("documents.open"),
        href: doc.href,
        kind: doc.kind,
        title: doc.label,
      }))
    : defaults;

  return (
    <section className="bg-section/50 py-16">
      <div className={SECTION_SHELL}>
        <SectionIntro
          label={t("documents.label")}
          lead={t("documents.lead")}
          title={t("documents.title")}
        />

        <div className="grid gap-6 md:grid-cols-3">
          {cards.map((card, index) => (
            <DocumentCard
              action={card.action}
              delay={index * 0.08}
              description={card.description}
              href={card.href}
              key={card.href}
              kind={card.kind}
              title={card.title}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  const t = useTranslations("fundingProgram");
  const items = t.raw("faq.items") as { answer: string; question: string }[];

  return (
    <section className="py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionIntro label={t("faq.label")} title={t("faq.title")} />

        <motion.div {...FADE_UP}>
          <Accordion className="w-full" collapsible type="single">
            {items.map((item) => (
              <AccordionItem key={item.question} value={item.question}>
                <AccordionTrigger className="text-left font-medium text-foreground">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="whitespace-pre-line text-muted-foreground leading-relaxed">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}

function ContactSection({ links }: { links: FundingSupportLinks }) {
  const t = useTranslations("fundingProgram");

  return (
    <section className="py-16">
      <div className={SECTION_SHELL}>
        <motion.div
          className="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-gradient-from to-brand-gradient-to p-8 shadow-xl sm:p-12"
          {...FADE_UP}
        >
          <div className="relative z-10 max-w-2xl">
            <div className="mb-4 inline-block rounded-full bg-white/15 px-4 py-2 font-medium text-sm text-white">
              {t("contact.label")}
            </div>
            <h2 className="font-bold text-2xl text-white md:text-3xl">
              {t("contact.title")}
            </h2>
            <p className="mt-3 text-white/80 leading-relaxed">
              {t("contact.lead")}
            </p>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="font-medium text-sm text-white/70">
                  {t("contact.financeLabel")}
                </dt>
                <dd>
                  <a
                    className="font-semibold text-white underline-offset-4 hover:underline"
                    href={`mailto:${links.financeEmail}`}
                  >
                    {links.financeEmail}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-sm text-white/70">
                  {t("contact.boardLabel")}
                </dt>
                <dd>
                  <a
                    className="font-semibold text-white underline-offset-4 hover:underline"
                    href={`mailto:${links.boardEmail}`}
                  >
                    {links.boardEmail}
                  </a>
                </dd>
              </div>
            </dl>

            {links.isOpen ? (
              <div className="mt-8">
                <Button
                  asChild
                  className="bg-white text-brand-dark hover:bg-white/90"
                  size="lg"
                >
                  <a
                    aria-label={t("cta.applyAria")}
                    href={links.applicationUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {t("cta.apply")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
            ) : null}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export function FundingSupportPageClient({
  links,
}: {
  links: FundingSupportLinks;
}) {
  const t = useTranslations("fundingProgram");

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <AboutHero
        breadcrumbs={[
          { label: t("hero.breadcrumbHome"), href: "/" },
          { label: t("hero.breadcrumbStudents"), href: "/students" },
          { label: t("hero.title") },
        ]}
        compact
        icon={<HandCoins className="h-8 w-8 text-white" />}
        subtitle={t("hero.subtitle")}
        title={t("hero.title")}
      />

      <IntroSection links={links} />
      <EligibilitySection />
      <UsesSection />
      <ProcessSection />
      <TipsSection />
      <DocumentsSection links={links} />
      <FaqSection />
      <ContactSection links={links} />
    </div>
  );
}
