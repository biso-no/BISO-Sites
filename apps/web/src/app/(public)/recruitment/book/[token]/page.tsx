import { CalendarX } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getBookingContext } from "@/app/actions/booking";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { BookingClient } from "./booking-client";

interface PageProps {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = {
  title: "Interview Booking | BISO",
  // Tokenized one-off links must not end up in search indexes.
  robots: { index: false, follow: false },
};

export default async function CandidateBookingPage({ params }: PageProps) {
  const t = await getTranslations("jobs.booking");
  const { token } = await params;
  const result = await getBookingContext(token);

  if ("error" in result) {
    // The `StatusPanel` shape, with two paragraphs: why the link failed (the
    // server's reason — invalid, used or expired) and what to do about it.
    return (
      <Section clearNav tone="paper" width="prose">
        <div className="flex flex-col items-start gap-4 rounded-biso-md border border-edge p-10">
          <span aria-hidden="true" className="text-ink-muted">
            <CalendarX className="size-8" />
          </span>
          <h1 className="type-display-sm break-words text-ink">
            {t("unavailable")}
          </h1>
          <p className="type-body text-ink-muted">{result.error}</p>
          <p className="type-body-sm text-ink-muted">{t("expired")}</p>
        </div>
      </Section>
    );
  }

  if (!result.data) {
    return notFound();
  }
  const { data } = result;
  const name = data.application.applicant_name;

  return (
    <>
      <PageHeader
        lede={
          data.job.campus_name
            ? t("introCampus", { campus: data.job.campus_name, name })
            : t("intro", { name })
        }
        title={t("title")}
      />
      <Section tone="paper" width="prose">
        <BookingClient
          applicantEmail={data.application.applicant_email}
          availabilityChecked={data.availabilityChecked}
          durationMinutes={data.token.duration_minutes}
          slots={data.slots}
          token={token}
        />
      </Section>
    </>
  );
}
