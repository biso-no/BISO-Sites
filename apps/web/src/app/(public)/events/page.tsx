import { notFound } from "next/navigation";
import { Suspense } from "react";
import { listEvents } from "@/app/actions/events";
import { getLocale } from "@/app/actions/locale";
import { EventsV2 } from "@/components/events/v2/events-v2";
import { FeedSkeleton } from "@/components/ui/loading-shell";
import { getUserPreferences } from "@/lib/auth-utils";
import { resolveRequestCampus } from "@/lib/campus-scope";

// This is a server component
export const metadata = {
  // A campus-scoped feed is a filtered view of the same collection, so it
  // points its canonical at the unscoped URL rather than competing with it.
  alternates: { canonical: "/events" },
  title: "Events | BISO",
  description:
    "Discover amazing events and experiences at BI Norwegian Business School",
};

async function EventsListV2({
  locale,
  campus,
  searchParams,
}: {
  campus: string | null;
  locale: "en" | "no";
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const events = await listEvents({
    locale,
    status: "published",
    limit: 50,
    campus: campus ?? "all",
  });

  return (
    <EventsV2
      campusId={campus}
      events={events}
      locale={locale}
      searchParams={searchParams}
    />
  );
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, sp, prefs] = await Promise.all([
    getLocale(),
    searchParams,
    getUserPreferences(),
  ]);

  // URL beats cookie beats "all". An unrecognised campus is a 404, not a
  // silent fallback to everything — see `resolveRequestCampus`.
  const campus = resolveRequestCampus(sp.campus, prefs?.campusId);
  if (campus === undefined) {
    notFound();
  }

  return (
    <Suspense fallback={<FeedSkeleton />}>
      <EventsListV2 campus={campus} locale={locale} searchParams={sp} />
    </Suspense>
  );
}
