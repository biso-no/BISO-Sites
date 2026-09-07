import { CalendarClock, Inbox, MapPin, UserRound, Video } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listMyApplications, type MyApplicationView } from "@/app/actions/jobs";
import { getLocale } from "@/app/actions/locale";
import { PageHeader } from "@/components/ui/page-header";
import { Pill, type PillTone } from "@/components/ui/pill";
import { Section } from "@/components/ui/section";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("applications");
  return { title: `${t("title")} | BISO`, description: t("lede") };
}

/** Visual tone per state; the labels come from the bundle. */
const STATUS_TONE: Record<MyApplicationView["status"], PillTone> = {
  accepted: "success",
  interview: "accent",
  rejected: "danger",
  reviewed: "neutral",
  submitted: "neutral",
};

const linkClass =
  "inline-flex items-center gap-2 text-ink-accent underline underline-offset-4 hover:no-underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

type T = Awaited<ReturnType<typeof getTranslations<"applications">>>;

function formatDate(value: string | null, locale: string, fallback: string) {
  if (!value) {
    return fallback;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  // The visitor's locale, not the Node process's — `toLocaleString(undefined)`
  // on a Server Component is the container's.
  return date.toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function InterviewDetails({
  interview,
  locale,
  t,
}: {
  interview: NonNullable<MyApplicationView["next_interview"]>;
  locale: string;
  t: T;
}) {
  return (
    <div className="mt-4 rounded-biso-md border border-edge bg-surface-sunken p-4">
      <p className="type-label text-ink-accent">
        {t("interview", { title: interview.title })}
      </p>
      <ul className="type-body-sm mt-3 grid gap-2 text-ink-muted sm:grid-cols-2">
        <li className="flex items-center gap-2">
          <CalendarClock aria-hidden="true" className="size-4 shrink-0" />
          {formatDate(interview.starts_at, locale, t("tbd"))}
        </li>
        {interview.location ? (
          <li className="flex items-center gap-2">
            <MapPin aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 break-words">{interview.location}</span>
          </li>
        ) : null}
        {interview.meeting_url ? (
          <li>
            <a
              className={linkClass}
              href={interview.meeting_url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Video aria-hidden="true" className="size-4 shrink-0" />
              {t("joinMeeting")}
            </a>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function ApplicationCard({
  application,
  locale,
  t,
}: {
  application: MyApplicationView;
  locale: string;
  t: T;
}) {
  return (
    <li className="rounded-biso-md border border-edge p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="type-heading-card min-w-0 break-words text-ink">
              {application.job?.title ?? t("vacancy")}
            </h2>
            <Pill tone={STATUS_TONE[application.status]}>
              {t(`status.${application.status}`)}
            </Pill>
          </div>
          <p className="type-body-sm mt-2 text-ink-muted">
            {application.job?.campus_name
              ? `${application.job.campus_name} · `
              : ""}
            {t("applied", {
              date: formatDate(application.$createdAt, locale, t("tbd")),
            })}
          </p>
          {application.hr_assigned_name ? (
            <p className="type-body-sm mt-1 flex items-center gap-2 text-ink-muted">
              <UserRound aria-hidden="true" className="size-4 shrink-0" />
              {t("reviewer", { name: application.hr_assigned_name })}
            </p>
          ) : null}
        </div>
        {application.job?.slug ? (
          <Link
            className={`type-body-sm shrink-0 ${linkClass}`}
            href={`/jobs/${application.job.slug}`}
          >
            {t("viewVacancy")}
          </Link>
        ) : null}
      </div>

      {application.next_interview ? (
        <InterviewDetails
          interview={application.next_interview}
          locale={locale}
          t={t}
        />
      ) : null}

      {application.answers.length > 0 ? (
        <details className="mt-4">
          <summary className="type-body-sm cursor-pointer text-ink-muted hover:text-ink focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
            {t("answers", { count: application.answers.length })}
          </summary>
          <dl className="mt-3 border-edge border-s ps-4">
            {application.answers.map((answer) => (
              <div className="mb-3 last:mb-0" key={answer.question_label}>
                <dt className="type-body-sm font-medium text-ink">
                  {answer.question_label}
                </dt>
                <dd className="type-body-sm whitespace-pre-line text-ink-muted">
                  {answer.answer ?? "—"}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}

      <p className="type-body-sm mt-4 text-ink-muted">
        {t("storedUntil", {
          date: formatDate(application.data_retention_until, locale, t("tbd")),
        })}
      </p>
    </li>
  );
}

export default async function MyApplicationsPage() {
  const [applications, locale, t, tNav] = await Promise.all([
    listMyApplications(),
    getLocale(),
    getTranslations("applications"),
    getTranslations("common.navigation"),
  ]);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: tNav("account.heading"), href: "/profile" },
          { label: t("title") },
        ]}
        lede={t("lede")}
        title={t("title")}
      />

      <Section tone="paper">
        {applications.length === 0 ? (
          <div className="flex flex-col items-start gap-4 rounded-biso-md border border-edge p-10">
            <Inbox aria-hidden="true" className="size-8 text-ink-muted" />
            <h2 className="type-heading-card text-ink">{t("emptyTitle")}</h2>
            <p className="type-body max-w-(--measure) text-ink-muted">
              {t("emptyBody")}
            </p>
            <Link
              className="type-label mt-2 inline-flex items-center gap-2 rounded-biso-pill bg-action px-5 py-3 text-action-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              href="/jobs"
            >
              {t("browse")}
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-5">
            {applications.map((application) => (
              <ApplicationCard
                application={application}
                key={application.$id}
                locale={locale}
                t={t}
              />
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
