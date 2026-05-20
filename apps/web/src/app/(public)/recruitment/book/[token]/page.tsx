import { Card } from "@repo/ui/components/ui/card";
import { notFound } from "next/navigation";
import { BookingClient } from "./booking-client";

interface PageProps {
  params: Promise<{ token: string }>;
}

interface BookingData {
  data?: {
    application: { applicant_name: string; applicant_email: string };
    job: { $id: string; slug: string; campus_name: string | null };
    token: {
      window_from: string;
      window_to: string;
      duration_minutes: number;
      expires_at: string;
    };
  };
  error?: string;
}

async function fetchBookingContext(token: string): Promise<BookingData | null> {
  const apiBase =
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://localhost:3003";
  try {
    const response = await fetch(
      `${apiBase}/api/recruitment/booking/${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );
    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      return { error: error?.error ?? "This link is no longer valid." };
    }
    return (await response.json()) as BookingData;
  } catch {
    return null;
  }
}

export default async function CandidateBookingPage({ params }: PageProps) {
  const { token } = await params;
  const result = await fetchBookingContext(token);
  if (!result) {
    notFound();
  }
  if (result.error) {
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
  const data = result.data;
  if (!data) {
    return notFound();
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="font-semibold text-foreground text-2xl">
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
