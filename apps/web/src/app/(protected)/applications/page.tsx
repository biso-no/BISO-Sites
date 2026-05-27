import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import {
  CalendarClock,
  Inbox,
  MapPin,
  Sparkles,
  UserRound,
  Video,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { listMyApplications, type MyApplicationView } from "@/app/actions/jobs";

export const metadata: Metadata = {
  title: "My Applications | BISO",
  description: "Track your applications to BISO volunteer positions.",
};

const STATUS_LABEL: Record<MyApplicationView["status"], string> = {
  accepted: "Accepted",
  interview: "Interview",
  rejected: "Not selected",
  reviewed: "Reviewed",
  submitted: "Submitted",
};

const STATUS_TONE: Record<
  MyApplicationView["status"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  accepted: "default",
  interview: "default",
  rejected: "destructive",
  reviewed: "secondary",
  submitted: "outline",
};

function formatDate(value: string | null): string {
  if (!value) {
    return "TBD";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ApplicationCard({ application }: { application: MyApplicationView }) {
  return (
    <Card className="border-border/60 p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-foreground text-lg">
              {application.job?.title ?? "Vacancy"}
            </h3>
            <Badge variant={STATUS_TONE[application.status]}>
              {STATUS_LABEL[application.status]}
            </Badge>
          </div>
          <p className="mt-1 text-muted-foreground text-sm">
            {application.job?.campus_name
              ? `${application.job.campus_name} · `
              : ""}
            Applied {formatDate(application.$createdAt)}
          </p>
          {application.hr_assigned_name ? (
            <p className="mt-1 flex items-center gap-1 text-muted-foreground text-sm">
              <UserRound className="h-3.5 w-3.5" />
              Reviewer: {application.hr_assigned_name}
            </p>
          ) : null}
        </div>
        {application.job?.slug ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`/jobs/${application.job.slug}`}>View vacancy</Link>
          </Button>
        ) : null}
      </div>

      {application.next_interview ? (
        <div className="mt-4 rounded-lg border border-brand/30 bg-brand/5 p-4">
          <div className="flex items-center gap-2 text-brand text-sm">
            <Sparkles className="h-4 w-4" />
            <span className="font-medium">
              Upcoming interview · {application.next_interview.title}
            </span>
          </div>
          <div className="mt-3 grid gap-2 text-muted-foreground text-sm sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              {formatDate(application.next_interview.starts_at)}
            </div>
            {application.next_interview.location ? (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {application.next_interview.location}
              </div>
            ) : null}
            {application.next_interview.meeting_url ? (
              <a
                className="flex items-center gap-2 text-brand hover:underline"
                href={application.next_interview.meeting_url}
                rel="noopener"
                target="_blank"
              >
                <Video className="h-4 w-4" />
                Join meeting
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {application.answers.length > 0 ? (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Your answers ({application.answers.length})
          </summary>
          <div className="mt-2 space-y-2 border-border/60 border-l pl-4">
            {application.answers.map((answer) => (
              <div key={answer.question_label}>
                <p className="font-medium text-foreground">
                  {answer.question_label}
                </p>
                <p className="whitespace-pre-line text-muted-foreground">
                  {answer.answer ?? "—"}
                </p>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <p className="mt-3 text-muted-foreground text-xs">
        Stored until {formatDate(application.data_retention_until)}
      </p>
    </Card>
  );
}

export default async function MyApplicationsPage() {
  const applications = await listMyApplications();

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <header className="mb-8">
        <h1 className="font-semibold text-3xl text-foreground">
          My applications
        </h1>
        <p className="mt-2 text-muted-foreground">
          See the status of every BISO position you've applied for, plus any
          upcoming interview details.
        </p>
      </header>

      {applications.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 border-border/60 p-12 text-center shadow-sm">
          <Inbox className="h-10 w-10 text-muted-foreground" />
          <h2 className="font-semibold text-foreground text-xl">
            No applications yet
          </h2>
          <p className="max-w-md text-muted-foreground text-sm">
            When you apply for a BISO vacancy, it'll show up here so you can
            track its progress and interview times.
          </p>
          <Button asChild className="mt-2">
            <Link href="/jobs">Browse open positions</Link>
          </Button>
        </Card>
      ) : (
        <ul className="space-y-4">
          {applications.map((application) => (
            <li key={application.$id}>
              <ApplicationCard application={application} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
