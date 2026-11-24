import { Users } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getBigEvent } from "../../../_actions/big-events";
import { EmptyState } from "../../../_components/empty-state";

interface BigEventParticipantsPageProps {
  params: Promise<{ id: string }>;
}

/** Placeholder until the participants list arrives (Task 8 replaces it). */
export default async function BigEventParticipantsPage({
  params,
}: BigEventParticipantsPageProps) {
  const { id } = await params;
  const found = await getBigEvent(id);
  if (!found) {
    notFound();
  }
  const t = await getTranslations("adminPortal.bigEvents.participantsSoon");

  return (
    <EmptyState
      description={t("description")}
      icon={<Users aria-hidden size={28} />}
      title={t("title")}
    />
  );
}
