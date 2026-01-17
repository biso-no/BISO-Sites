"use client";

import { Status } from "@repo/api/types/appwrite";
import { AdminSummary } from "@/components/admin/admin-summary";
import type { Events } from "@repo/api/types/appwrite";
import { formatPercentage } from "@/lib/utils/admin";
import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { useTranslations } from "next-intl";
import { use } from "react";

export function EventsSummary({
  eventsPromise,
}: {
  eventsPromise: Promise<Events[]>;
}) {
  const events = use(eventsPromise);
  const t = useTranslations("adminEvents");

  const totalEvents = events.length;
  const publishedEvents = events.filter(
    (evt) => evt.status === Status.PUBLISHED
  ).length;
  const draftEvents = events.filter((evt) => evt.status === Status.DRAFT).length;
  const translationCoverage = formatPercentage(
    events.filter((evt) => {
      const refs = evt.translation_refs ?? [];
      const locales = refs.map((ref: any) => ref.locale);
      return locales.includes("no") && locales.includes("en");
    }).length,
    totalEvents
  );

  const summaryCards = [
    {
      label: t("metrics.activeEvents"),
      value: totalEvents,
      description: t("metrics.totalRegistered"),
    },
    {
      label: t("metrics.published"),
      value: publishedEvents,
      description: t("metrics.visibleToMembers"),
    },
    {
      label: t("metrics.drafts"),
      value: totalEvents - publishedEvents, // Simplified logic or reuse exact count
      // Actually let's use drafts count
      value: draftEvents,
      description: t("metrics.forReview"),
    },
    {
      label: t("metrics.translations"),
      value: translationCoverage,
      description: t("metrics.translationComplete"),
    },
  ];

  return (
    <AdminSummary
      action={
        <Button
          asChild
          className="rounded-full bg-primary-40 px-4 py-2 font-semibold text-sm text-white shadow-[0_18px_45px_-30px_rgba(0,23,49,0.55)] hover:bg-primary-30"
        >
          <Link href="/events/new">{t("newEvent")}</Link>
        </Button>
      }
      badge={t("badge")}
      description={t("workbenchDescription")}
      metrics={summaryCards.map((card) => ({
        label: card.label,
        value: card.value,
        hint: card.description,
      }))}
      title={t("workbenchTitle")}
    />
  );
}
