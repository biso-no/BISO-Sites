import { Card } from "@repo/ui/components/ui/card";
import { notFound } from "next/navigation";
import { getBookingContext } from "@/app/actions/booking";
import { BookingClient } from "./booking-client";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function CandidateBookingPage({ params }: PageProps) {
  const { token } = await params;
  const result = await getBookingContext(token);

  if ("error" in result) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <Card className="border-border/60 p-8 shadow-sm">
          <h1 className="font-semibold text-foreground text-xl">
            Booking link unavailable
          </h1>
          <p className="mt-3 text-muted-foreground text-sm">{result.error}</p>
          <p className="mt-3 text-muted-foreground text-xs">
            Reach out to your BISO contact for a fresh link.
          </p>
        </Card>
      </main>
    );
  }

  if (!result.data) {
    return notFound();
  }
  const { data } = result;

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="font-semibold text-2xl text-foreground">
        Pick an interview slot
      </h1>
      <p className="mt-2 text-muted-foreground text-sm">
        Hi {data.application.applicant_name} — please choose a time that works
        for your interview with BISO
        {data.job.campus_name ? ` ${data.job.campus_name}` : ""}.
      </p>
      <BookingClient
        durationMinutes={data.token.duration_minutes}
        token={token}
        windowFrom={data.token.window_from}
        windowTo={data.token.window_to}
      />
    </main>
  );
}
