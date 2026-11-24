import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { resolveConnectToken } from "@/lib/big-events/connect";
import { ConnectStates } from "./connect-states";

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("bigEvents.connect");
  return {
    title: `${t("title")} | BISO`,
    // A personal link: keep it out of every index.
    robots: { follow: false, index: false },
  };
}

/**
 * Where a "connect your ticket" email lands (spec D4). Reading the link
 * changes nothing; the student signs in with BI and confirms with a button.
 */
export default async function ConnectTicketPage({ params }: PageProps) {
  const { token } = await params;
  const [view, t] = await Promise.all([
    resolveConnectToken(token),
    getTranslations("bigEvents.connect"),
  ]);

  return (
    <>
      <PageHeader title={t("title")} />
      <Section tone="paper" width="prose">
        <ConnectStates token={token} view={view} />
      </Section>
    </>
  );
}
