"use client";

import type { JobStatus } from "@repo/api/types/appwrite";
import type { RecruitmentVacancy } from "@repo/shared/types/recruitment";
import {
  ArrowUpRight,
  Briefcase,
  CalendarClock,
  Copy,
  Filter,
  MapPin,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteJob } from "../../_actions/jobs";
import { PaginationBar } from "../../_components/pagination-bar";

interface JobStudioDashboardProps {
  initialJobs: RecruitmentVacancy[];
  labels: {
    applications: string;
    delete: string;
    deleteConfirm: string;
    edit: string;
    empty: string;
    emptyDescription: string;
    searchPlaceholder: string;
  };
  page: number;
  total: number;
}

const BRAND = {
  accent: "#3DA9E0",
  blue: "#001731",
  gold: "#F7D64A",
  green: "#4ade80",
  ink: "#07111f",
  navy: "#000a16",
  paper: "#faf7f2",
  red: "#f87171",
} as const;

const STATUS_LABELS: Record<string, string> = {
  closed: "Closed",
  draft: "Draft",
  published: "Published",
};

const FILTERS = ["all", "published", "draft", "closed"] as const;

function getTitle(job: RecruitmentVacancy, locale: "en" | "no" = "en") {
  return (
    job.translation_refs.find((translation) => translation.locale === locale)
      ?.title ??
    job.translation_refs[0]?.title ??
    "Untitled vacancy"
  );
}

function getDescription(job: RecruitmentVacancy) {
  return (
    job.metadata.short_description ??
    job.translation_refs.find((translation) => translation.locale === "en")
      ?.short_description ??
    job.translation_refs[0]?.short_description ??
    "No teaser has been written yet."
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "No deadline";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function daysUntil(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86_400_000);
}

function crestFor(job: RecruitmentVacancy) {
  const source = job.department?.Name ?? job.campus?.name ?? getTitle(job);
  return source.trim().charAt(0).toUpperCase() || "B";
}

function statusColor(status: string) {
  if (status === "published") {
    return BRAND.green;
  }
  if (status === "closed") {
    return BRAND.red;
  }
  return BRAND.gold;
}

function StatusPill({ status }: { status: JobStatus }) {
  const color = statusColor(status);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium text-[11px] uppercase"
      style={{
        background: `${color}18`,
        borderColor: `${color}45`,
        color,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: color }}
      />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function KpiCard({
  label,
  value,
  helper,
  alert,
}: {
  alert?: boolean;
  helper: string;
  label: string;
  value: string;
}) {
  return (
    <div className="border-white/10 border-r px-5 py-4 last:border-r-0">
      <p className="font-medium text-[11px] text-white/45 uppercase tracking-[0.12em]">
        {label}
      </p>
      <p
        className="mt-2 font-light text-4xl tracking-tight"
        style={{ color: alert ? BRAND.gold : "#fff" }}
      >
        {value}
      </p>
      <p
        className="mt-1 text-xs"
        style={{ color: alert ? BRAND.gold : BRAND.green }}
      >
        {helper}
      </p>
    </div>
  );
}

function FeaturedDraft({ jobs }: { jobs: RecruitmentVacancy[] }) {
  const draft =
    jobs.find((job) => job.status === "draft") ??
    jobs.find((job) => Boolean(job.metadata.application_deadline)) ??
    jobs[0];

  if (!draft) {
    return null;
  }

  const title = getTitle(draft);
  const completionFields = [
    title,
    draft.department_id,
    getDescription(draft),
    draft.metadata.application_deadline,
    draft.metadata.contact_email,
  ];
  const complete = Math.round(
    (completionFields.filter(Boolean).length / completionFields.length) * 100
  );

  return (
    <section
      className="grid overflow-hidden rounded-2xl border lg:grid-cols-[1.05fr_0.95fr]"
      style={{
        background:
          "linear-gradient(135deg, rgba(250,247,242,0.98), rgba(232,242,247,0.92))",
        borderColor: "rgba(61,169,224,0.20)",
        color: BRAND.ink,
      }}
    >
      <div className="p-6 md:p-7">
        <div
          className="flex items-center gap-2 font-medium text-[11px] uppercase tracking-[0.14em]"
          style={{ color: BRAND.blue }}
        >
          <Sparkles size={14} style={{ color: BRAND.accent }} />
          Pick up where you left off
        </div>
        <h2 className="mt-4 max-w-xl font-light text-4xl tracking-tight md:text-5xl">
          {title} <span style={{ color: BRAND.accent }}>almost ready.</span>
        </h2>
        <p className="mt-4 max-w-xl text-slate-600 text-sm leading-6">
          {getDescription(draft)}
        </p>
        <div className="mt-6 flex flex-wrap gap-8">
          <div>
            <b className="font-light text-3xl">{complete}%</b>
            <p className="text-[11px] text-slate-500 uppercase tracking-[0.12em]">
              Complete
            </p>
          </div>
          <div>
            <b className="font-light text-3xl">
              {draft.metadata.application_deadline
                ? (daysUntil(draft.metadata.application_deadline) ?? "—")
                : "—"}
            </b>
            <p className="text-[11px] text-slate-500 uppercase tracking-[0.12em]">
              Days left
            </p>
          </div>
          <div>
            <b className="font-light text-3xl">{draft.metadata.tags.length}</b>
            <p className="text-[11px] text-slate-500 uppercase tracking-[0.12em]">
              Tags
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-between bg-[#001731] p-6 text-white md:p-7">
        <div>
          <p className="font-medium text-[11px] text-white/45 uppercase tracking-[0.14em]">
            Publishing checklist
          </p>
          <h3 className="mt-3 max-w-sm font-light text-2xl leading-tight">
            From draft to student-facing listing in a few focused steps.
          </h3>
        </div>
        <div className="my-6 space-y-3 text-sm">
          {[
            ["Title and department", Boolean(title && draft.department_id)],
            ["Description and teaser", Boolean(getDescription(draft))],
            [
              "Application deadline",
              Boolean(draft.metadata.application_deadline),
            ],
            ["Contact details", Boolean(draft.metadata.contact_email)],
          ].map(([label, done]) => (
            <div className="flex items-center gap-3" key={String(label)}>
              <span
                className="h-3.5 w-3.5 rounded-full border"
                style={{
                  background: done ? BRAND.accent : "transparent",
                  borderColor: done ? BRAND.accent : "rgba(255,255,255,0.35)",
                }}
              />
              <span className={done ? "text-white" : "text-white/55"}>
                {label}
              </span>
            </div>
          ))}
        </div>
        <Link
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm transition hover:bg-white/15"
          href={`/jobs/${draft.$id}`}
        >
          Resume composer
          <ArrowUpRight size={14} />
        </Link>
      </div>
    </section>
  );
}

function JobRow({
  job,
  labels,
  isConfirmingDelete,
  onCancelDelete,
  onDelete,
  onRequestDelete,
}: {
  isConfirmingDelete: boolean;
  job: RecruitmentVacancy;
  labels: JobStudioDashboardProps["labels"];
  onCancelDelete: () => void;
  onDelete: (id: string) => void;
  onRequestDelete: (id: string) => void;
}) {
  const deadlineDays = daysUntil(job.metadata.application_deadline);
  return (
    <div
      className="group grid items-center gap-4 border-white/10 border-t px-4 py-4 transition hover:bg-white/[0.04] md:grid-cols-[1.45fr_0.85fr_0.55fr_0.65fr_0.45fr]"
      style={{ color: "#fff" }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="grid h-12 w-10 shrink-0 place-items-center rounded-md border font-light text-xl"
          style={{
            background: "rgba(250,247,242,0.95)",
            borderColor: "rgba(61,169,224,0.18)",
            color: BRAND.blue,
          }}
        >
          {crestFor(job)}
        </div>
        <div className="min-w-0">
          <Link
            className="block truncate font-medium text-sm transition hover:text-[#3DA9E0]"
            href={`/jobs/${job.$id}`}
          >
            {getTitle(job)}
          </Link>
          <p className="mt-1 truncate text-white/40 text-xs">
            <span className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/35">
              NO
            </span>{" "}
            {getTitle(job, "no")} · {job.slug}
          </p>
        </div>
      </div>
      <div className="text-sm text-white/65">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: BRAND.accent }}
          />
          <span className="truncate">
            {job.department?.Name ?? "Any department"}
          </span>
        </div>
        <p className="mt-1 text-white/35 text-xs">
          {job.campus?.name ?? "Campus"}
        </p>
      </div>
      <StatusPill status={job.status} />
      <div className="text-white/50 text-xs">
        <p className="font-mono text-white/70">
          {formatDate(job.metadata.application_deadline)}
        </p>
        {deadlineDays != null && (
          <p
            style={{
              color: deadlineDays <= 5 ? BRAND.gold : "rgba(255,255,255,0.35)",
            }}
          >
            {deadlineDays >= 0 ? `${deadlineDays}d left` : "Past deadline"}
          </p>
        )}
      </div>
      <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:transition md:group-hover:opacity-100">
        <Link
          aria-label={labels.applications}
          className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-white/50 transition hover:bg-white/10 hover:text-white"
          href={`/jobs/${job.$id}/applications`}
        >
          <Users size={14} />
        </Link>
        <Link
          aria-label={labels.edit}
          className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-white/50 transition hover:bg-white/10 hover:text-white"
          href={`/jobs/${job.$id}`}
        >
          <Pencil size={14} />
        </Link>
        <button
          aria-label="Duplicate"
          className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-white/50 transition hover:bg-white/10 hover:text-white"
          type="button"
        >
          <Copy size={14} />
        </button>
        <button
          aria-label={isConfirmingDelete ? "Confirm delete" : labels.delete}
          className="grid h-8 w-8 place-items-center rounded-lg bg-red-400/10 text-red-300 transition hover:bg-red-400/15"
          onBlur={onCancelDelete}
          onClick={() => {
            if (isConfirmingDelete) {
              onDelete(job.$id);
              return;
            }
            onRequestDelete(job.$id);
          }}
          title={isConfirmingDelete ? labels.deleteConfirm : labels.delete}
          type="button"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export function JobStudioDashboard({
  initialJobs,
  labels,
  page,
  total,
}: JobStudioDashboardProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const counts = useMemo(
    () => ({
      all: initialJobs.length,
      closed: initialJobs.filter((job) => job.status === "closed").length,
      draft: initialJobs.filter((job) => job.status === "draft").length,
      published: initialJobs.filter((job) => job.status === "published").length,
    }),
    [initialJobs]
  );

  const closingSoon = initialJobs.filter((job) => {
    const days = daysUntil(job.metadata.application_deadline);
    return days != null && days >= 0 && days <= 5;
  }).length;

  const filteredJobs = initialJobs.filter((job) => {
    const haystack = [
      getTitle(job),
      getTitle(job, "no"),
      job.slug,
      job.department?.Name,
      job.campus?.name,
      job.metadata.company,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      (filter === "all" || job.status === filter) &&
      (!query.trim() || haystack.includes(query.trim().toLowerCase()))
    );
  });

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteJob(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setPendingDeleteId(null);
      toast.success("Vacancy deleted");
    });
  }

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-col gap-5 border-white/10 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-medium text-[#3DA9E0] text-[11px] uppercase tracking-[0.16em]">
            BISO recruitment studio
          </p>
          <h1 className="mt-2 font-light text-5xl text-white tracking-tight md:text-6xl">
            Jobs <span className="text-[#3DA9E0]">this term.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-white/50 leading-6">
            Create, review, and publish student-facing roles with the BISO
            visual system while keeping each posting tied to campus and
            department access.
          </p>
        </div>
        <Link
          className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 font-medium text-[#001731] text-sm transition hover:-translate-y-0.5 hover:shadow-lg"
          href="/jobs/new"
        >
          <span className="grid h-6 w-6 place-items-center rounded-full bg-[#001731] text-white">
            <Plus size={14} />
          </span>
          Compose new job
        </Link>
      </header>

      <section className="grid overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] md:grid-cols-4">
        <KpiCard
          helper={`${counts.published} live right now`}
          label="Open positions"
          value={String(counts.published)}
        />
        <KpiCard
          helper={`${counts.draft} waiting for polish`}
          label="Drafts"
          value={String(counts.draft)}
        />
        <KpiCard
          helper={`${total} accessible records`}
          label="Total jobs"
          value={String(total)}
        />
        <KpiCard
          alert
          helper="Needs attention"
          label="Closing in 5 days"
          value={String(closingSoon)}
        />
      </section>

      <FeaturedDraft jobs={initialJobs} />

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
        <div className="flex flex-col gap-3 border-white/10 border-b p-4 md:flex-row md:items-center">
          <div className="flex overflow-x-auto rounded-xl border border-white/10 bg-white/[0.04] p-1">
            {FILTERS.map((item) => (
              <button
                className="whitespace-nowrap rounded-lg px-3 py-1.5 font-medium text-xs capitalize transition"
                key={item}
                onClick={() => setFilter(item)}
                style={
                  filter === item
                    ? { background: "#fff", color: BRAND.blue }
                    : { color: "rgba(255,255,255,0.48)" }
                }
                type="button"
              >
                {item === "all" ? "All" : item}{" "}
                <span className="font-mono opacity-60">{counts[item]}</span>
              </button>
            ))}
          </div>
          <div className="relative min-w-0 flex-1 md:max-w-sm">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-white/30"
              size={15}
            />
            <input
              className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] pr-3 pl-9 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#3DA9E0]/60"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={labels.searchPlaceholder}
              value={query}
            />
          </div>
          <div className="flex flex-wrap gap-2 text-white/45 text-xs">
            <button
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2"
              type="button"
            >
              <Filter size={13} />
              Department
            </button>
            <button
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2"
              type="button"
            >
              <MapPin size={13} />
              Campus
            </button>
            <button
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2"
              type="button"
            >
              <CalendarClock size={13} />
              Last edited
            </button>
          </div>
        </div>

        {filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/30">
              <Briefcase size={28} />
            </div>
            <h2 className="mt-4 font-medium text-lg text-white">
              {labels.empty}
            </h2>
            <p className="mt-1 max-w-sm text-sm text-white/40">
              {labels.emptyDescription}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[1.45fr_0.85fr_0.55fr_0.65fr_0.45fr] gap-4 px-4 py-3 font-medium text-[11px] text-white/30 uppercase tracking-[0.12em] md:grid">
              <div>Position</div>
              <div>Department</div>
              <div>Status</div>
              <div>Deadline</div>
              <div className="text-right">Actions</div>
            </div>
            {filteredJobs.map((job) => (
              <JobRow
                isConfirmingDelete={pendingDeleteId === job.$id}
                job={job}
                key={job.$id}
                labels={labels}
                onCancelDelete={() => setPendingDeleteId(null)}
                onDelete={handleDelete}
                onRequestDelete={setPendingDeleteId}
              />
            ))}
          </>
        )}
      </section>

      <PaginationBar page={page} total={total} />
    </div>
  );
}
