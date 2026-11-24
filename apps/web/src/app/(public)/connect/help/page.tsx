import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { HelpForm } from "./help-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("bigEvents.help");
  return {
    title: `${t("title")} | BISO`,
    robots: { follow: false, index: false },
  };
}

/** "Didn't get the email?": new connect links, to the ticket's own address. */
export default async function ConnectHelpPage() {
  const t = await getTranslations("bigEvents.help");
  return (
    <>
      <PageHeader lede={t("lede")} title={t("title")} />
      <Section tone="paper" width="prose">
        <HelpForm />
      </Section>
    </>
  );
}
