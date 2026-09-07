"use client";

import type { JobsStatus } from "@repo/api/types/appwrite";
import type { RecruitmentVacancy } from "@repo/shared/types/recruitment";
import {
  ArrowUpRight,
  Briefcase,
  CalendarClock,
  Copy,
  Filter,
  MapPin,
  Pencil,
  Play,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { GuideVideoDialog } from "@/components/tours/guide-video-dialog";
import { deleteJob } from "../../_actions/jobs";
import { JOBS_PAGE_SIZE } from "../../_actions/schemas";
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
  gold: "#b08a3e",
  green: "#2f5d3a",
  ink: "#07111f",
  ink2: "#1a2d44",
  ink3: "#4a6080",
  ink4: "#7a90a8",
  navy: "#000a16",
  paper: "#faf7f2",
  paper2: "#f3eee5",
  paper3: "#ede6d8",
  red: "#9b2929",
  rule: "#ddd9d0",
  rule2: "#cdc9c0",
} as const;

const FILTERS = ["all", "published", "draft", "closed"] as const;

function normalizeLocale(locale: string): "en" | "no" {
  return locale === "no" ? "no" : "en";
}

function getTitle(job: RecruitmentVacancy, locale: "en" | "no") {
  return (
    job.translations.find((translation) => translation.locale === locale)
      ?.title ??
    job.translations[0]?.title ??
    ""
  );
}

function getDescription(job: RecruitmentVacancy, locale: "en" | "no") {
  return (
    job.translations.find((translation) => translation.locale === locale)
      ?.short_description ??
    job.translations[0]?.short_description ??
    job.metadata.short_description ??
    ""
  );
}

function formatDate(
  value: string | null | undefined,
  locale: string,
  labels: { invalidDate: string; noDeadline: string }
) {
  if (!value) {
    return labels.noDeadline;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return labels.invalidDate;
  }
  return new Intl.DateTimeFormat(locale === "no" ? "nb-NO" : "en-GB", {
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

function crestFor(job: RecruitmentVacancy, locale: "en" | "no") {
  const source =
    job.department?.Name ?? job.campus?.name ?? getTitle(job, locale);
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

function StatusPill({ status }: { status: JobsStatus }) {
  const t = useTranslations("adminPortal.common.status");
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
      {t(status)}
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
    <div
      className="border-r px-5 py-4 last:border-r-0"
      style={{ borderColor: BRAND.rule }}
    >
      <p
        className="font-medium text-[11px] uppercase tracking-[0.12em]"
        style={{ color: BRAND.ink4 }}
      >
        {label}
      </p>
      <p
        className="mt-2 font-light text-4xl tracking-tight"
        style={{ color: alert ? BRAND.gold : BRAND.blue }}
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
  const locale = normalizeLocale(useLocale());
  const t = useTranslations("adminPortal.jobs.studio");
  const draft =
    jobs.find((job) => job.status === "draft") ??
    jobs.find((job) => Boolean(job.application_deadline)) ??
    jobs[0];

  if (!draft) {
    return null;
  }

  const title = getTitle(draft, locale);
  const completionFields = [
    title,
    draft.department_id,
    getDescription(draft, locale),
    draft.application_deadline,
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
          {t("featured.eyebrow")}
        </div>
        <h2 className="mt-4 max-w-xl font-light text-4xl tracking-tight md:text-5xl">
          {title}{" "}
          <span style={{ color: BRAND.accent }}>
            {t("featured.almostReady")}
          </span>
        </h2>
        <p className="mt-4 max-w-xl text-slate-600 text-sm leading-6">
          {getDescription(draft, locale) || t("fallback.noTeaser")}
        </p>
        <div className="mt-6 flex flex-wrap gap-8">
          <div>
            <b className="font-light text-3xl">{complete}%</b>
            <p className="text-[11px] text-slate-500 uppercase tracking-[0.12em]">
              {t("featured.complete")}
            </p>
          </div>
          <div>
            <b className="font-light text-3xl">
              {draft.application_deadline
                ? (daysUntil(draft.application_deadline) ?? "—")
                : "—"}
            </b>
            <p className="text-[11px] text-slate-500 uppercase tracking-[0.12em]">
              {t("featured.daysLeft")}
            </p>
          </div>
          <div>
            <b className="font-light text-3xl">{draft.metadata.tags.length}</b>
            <p className="text-[11px] text-slate-500 uppercase tracking-[0.12em]">
              {t("featured.tags")}
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-between bg-[#001731] p-6 text-white md:p-7">
        <div>
          <p className="font-medium text-[11px] text-white/45 uppercase tracking-[0.14em]">
            {t("featured.checklistTitle")}
          </p>
          <h3 className="mt-3 max-w-sm font-light text-2xl leading-tight">
            {t("featured.checklistDescription")}
          </h3>
        </div>
        <div className="my-6 space-y-3 text-sm">
          {[
            [
              t("checklist.titleDepartment"),
              Boolean(title && draft.department_id),
            ],
            [
              t("checklist.descriptionTeaser"),
              Boolean(getDescription(draft, locale)),
            ],
            [
              t("checklist.applicationDeadline"),
              Boolean(draft.application_deadline),
            ],
            [
              t("checklist.contactDetails"),
              Boolean(draft.metadata.contact_email),
            ],
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
          {t("featured.resume")}
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
  const locale = normalizeLocale(useLocale());
  const t = useTranslations("adminPortal.jobs.studio");
  const common = useTranslations("adminPortal.common");
  const deadlineDays = daysUntil(job.application_deadline);
  return (
    <div
      className="group grid items-center gap-4 border-t px-4 py-4 transition hover:bg-black/[0.02] md:grid-cols-[1.45fr_0.85fr_0.55fr_0.65fr_0.45fr]"
      style={{ borderColor: BRAND.rule, color: BRAND.ink }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="grid h-12 w-10 shrink-0 place-items-center rounded-md border font-light text-xl"
          style={{
            background: BRAND.paper2,
            borderColor: "rgba(61,169,224,0.25)",
            color: BRAND.blue,
          }}
        >
          {crestFor(job, locale)}
        </div>
        <div className="min-w-0">
          <Link
            className="block truncate font-medium text-sm transition hover:text-[#3DA9E0]"
            href={`/jobs/${job.$id}`}
            style={{ color: BRAND.ink }}
          >
            {getTitle(job, locale) || t("fallback.untitled")}
          </Link>
          <p className="mt-1 truncate text-xs" style={{ color: BRAND.ink4 }}>
            <span
              className="rounded px-1.5 py-0.5 font-mono text-[10px]"
              style={{
                border: `0.5px solid ${BRAND.rule2}`,
                color: BRAND.ink4,
              }}
            >
              NO
            </span>{" "}
            {getTitle(job, "no") || t("fallback.untitled")} · {job.slug}
          </p>
        </div>
      </div>
      <div className="text-sm" style={{ color: BRAND.ink3 }}>
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: BRAND.accent }}
          />
          <span className="truncate">
            {job.department?.Name ?? t("fallback.anyDepartment")}
          </span>
        </div>
        <p className="mt-1 text-xs" style={{ color: BRAND.ink4 }}>
          {job.campus?.name ?? common("campus")}
        </p>
      </div>
      <StatusPill status={job.status} />
      <div className="text-xs" style={{ color: BRAND.ink4 }}>
        <p className="font-mono" style={{ color: BRAND.ink3 }}>
          {formatDate(job.application_deadline, locale, {
            invalidDate: t("fallback.invalidDate"),
            noDeadline: t("fallback.noDeadline"),
          })}
        </p>
        {deadlineDays != null && (
          <p
            style={{
              color: deadlineDays <= 5 ? BRAND.gold : BRAND.ink4,
            }}
          >
            {deadlineDays >= 0
              ? t("deadlineDaysLeft", { count: deadlineDays })
              : t("pastDeadline")}
          </p>
        )}
      </div>
      <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:transition md:group-hover:opacity-100">
        <Link
          aria-label={labels.applications}
          className="grid h-8 w-8 place-items-center rounded-lg transition"
          href={`/jobs/${job.$id}/applications`}
          style={{
            background: BRAND.paper2,
            border: `0.5px solid ${BRAND.rule2}`,
            color: BRAND.ink3,
          }}
        >
          <Users size={14} />
        </Link>
        <Link
          aria-label={labels.edit}
          className="grid h-8 w-8 place-items-center rounded-lg transition"
          href={`/jobs/${job.$id}`}
          style={{
            background: BRAND.paper2,
            border: `0.5px solid ${BRAND.rule2}`,
            color: BRAND.ink3,
          }}
        >
          <Pencil size={14} />
        </Link>
        <button
          aria-label={t("duplicate")}
          className="grid h-8 w-8 place-items-center rounded-lg transition"
          style={{
            background: BRAND.paper2,
            border: `0.5px solid ${BRAND.rule2}`,
            color: BRAND.ink3,
          }}
          type="button"
        >
          <Copy size={14} />
        </button>
        <button
          aria-label={isConfirmingDelete ? t("confirmDelete") : labels.delete}
          className="grid h-8 w-8 place-items-center rounded-lg transition"
          onBlur={onCancelDelete}
          onClick={() => {
            if (isConfirmingDelete) {
              onDelete(job.$id);
              return;
            }
            onRequestDelete(job.$id);
          }}
          style={{
            background: "rgba(155,41,41,0.08)",
            border: "0.5px solid rgba(155,41,41,0.2)",
            color: BRAND.red,
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
  const [guideOpen, setGuideOpen] = useState(false);
  const [, startTransition] = useTransition();
  const t = useTranslations("adminPortal.jobs");
  const ts = useTranslations("adminPortal.jobs.studio");
  const tc = useTranslations("adminPortal.common");
  const tt = useTranslations("adminPortal.tours");
  const locale = normalizeLocale(useLocale());

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
    const days = daysUntil(job.application_deadline);
    return days != null && days >= 0 && days <= 5;
  }).length;

  const filteredJobs = initialJobs.filter((job) => {
    const haystack = [
      getTitle(job, locale),
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
      toast.success(t("deleteSuccess"));
    });
  }

  return (
    <div className="space-y-6 pb-12">
      <header
        className="flex flex-col gap-5 border-b pb-6 lg:flex-row lg:items-end lg:justify-between"
        style={{ borderColor: BRAND.rule }}
      >
        <div>
          <p
            className="font-medium text-[11px] uppercase tracking-[0.16em]"
            style={{ color: BRAND.accent }}
          >
            {ts("eyebrow")}
          </p>
          <h1
            className="mt-2 font-light text-5xl tracking-tight md:text-6xl"
            style={{ color: BRAND.blue }}
          >
            {t("title")}{" "}
            <span style={{ color: BRAND.accent }}>{ts("titleAccent")}</span>
          </h1>
          <p
            className="mt-3 max-w-2xl text-sm leading-6"
            style={{ color: BRAND.ink3 }}
          >
            {ts("description")}
          </p>
        </div>
        <div className="flex w-fit flex-wrap items-center gap-3">
          <button
            className="inline-flex items-center gap-2 rounded-full border px-4 py-3 font-medium text-sm transition hover:-translate-y-0.5 hover:shadow-md"
            onClick={() => setGuideOpen(true)}
            style={{
              background: "rgba(255,255,255,0.6)",
              borderColor: BRAND.rule,
              color: BRAND.blue,
            }}
            type="button"
          >
            <span
              className="grid h-6 w-6 place-items-center rounded-full"
              style={{ background: BRAND.blue, color: BRAND.paper }}
            >
              <Play size={12} />
            </span>
            {tt("guideVideo.trigger")}
          </button>
          <Link
            className="inline-flex items-center gap-2 rounded-full px-5 py-3 font-medium text-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            data-tour="create-vacancy"
            href="/jobs/new"
            style={{ background: BRAND.blue, color: BRAND.paper }}
          >
            <span
              className="grid h-6 w-6 place-items-center rounded-full"
              style={{ background: BRAND.paper, color: BRAND.blue }}
            >
              <Plus size={14} />
            </span>
            {t("create")}
          </Link>
        </div>
      </header>

      <GuideVideoDialog onOpenChange={setGuideOpen} open={guideOpen} />

      <section
        className="grid overflow-hidden rounded-2xl border md:grid-cols-4"
        style={{
          background: "rgba(255,255,255,0.6)",
          borderColor: BRAND.rule,
        }}
      >
        <KpiCard
          helper={ts("kpi.liveNow", { count: counts.published })}
          label={ts("kpi.openPositions")}
          value={String(counts.published)}
        />
        <KpiCard
          helper={ts("kpi.waitingForPolish", { count: counts.draft })}
          label={t("filters.draft")}
          value={String(counts.draft)}
        />
        <KpiCard
          helper={ts("kpi.accessibleRecords", { count: total })}
          label={ts("kpi.totalJobs")}
          value={String(total)}
        />
        <KpiCard
          alert
          helper={ts("kpi.needsAttention")}
          label={ts("kpi.closingSoon")}
          value={String(closingSoon)}
        />
      </section>

      <FeaturedDraft jobs={initialJobs} />

      <section
        className="overflow-hidden rounded-2xl border"
        data-tour="vacancy-list"
        style={{ background: "rgba(255,255,255,0.5)", borderColor: BRAND.rule }}
      >
        <div
          className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center"
          style={{ borderColor: BRAND.rule }}
        >
          <div
            className="flex overflow-x-auto rounded-xl p-1"
            style={{
              background: BRAND.paper2,
              border: `0.5px solid ${BRAND.rule2}`,
            }}
          >
            {FILTERS.map((item) => (
              <button
                className="whitespace-nowrap rounded-lg px-3 py-1.5 font-medium text-xs capitalize transition"
                key={item}
                onClick={() => setFilter(item)}
                style={
                  filter === item
                    ? {
                        background: "#fff",
                        boxShadow: "0 1px 2px rgba(0,0,0,.06)",
                        color: BRAND.blue,
                      }
                    : { color: BRAND.ink3 }
                }
                type="button"
              >
                {t(`filters.${item}`)}{" "}
                <span
                  className="font-mono"
                  style={{
                    color: filter === item ? BRAND.ink4 : BRAND.ink4,
                    opacity: 0.7,
                  }}
                >
                  {counts[item]}
                </span>
              </button>
            ))}
          </div>
          <div className="relative min-w-0 flex-1 md:max-w-sm">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
              size={15}
              style={{ color: BRAND.ink4 }}
            />
            <input
              className="h-10 w-full rounded-xl pr-3 pl-9 text-sm outline-none transition"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={labels.searchPlaceholder}
              style={{
                background: "rgba(255,255,255,0.85)",
                border: `0.5px solid ${BRAND.rule2}`,
                color: BRAND.ink,
              }}
              value={query}
            />
          </div>
          <div
            className="flex flex-wrap gap-2 text-xs"
            style={{ color: BRAND.ink4 }}
          >
            <button
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2"
              style={{
                background: "rgba(255,255,255,0.7)",
                border: `0.5px solid ${BRAND.rule2}`,
              }}
              type="button"
            >
              <Filter size={13} />
              {tc("department")}
            </button>
            <button
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2"
              style={{
                background: "rgba(255,255,255,0.7)",
                border: `0.5px solid ${BRAND.rule2}`,
              }}
              type="button"
            >
              <MapPin size={13} />
              {tc("campus")}
            </button>
            <button
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2"
              style={{
                background: "rgba(255,255,255,0.7)",
                border: `0.5px solid ${BRAND.rule2}`,
              }}
              type="button"
            >
              <CalendarClock size={13} />
              {tc("lastUpdated")}
            </button>
          </div>
        </div>

        {filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div
              className="grid h-16 w-16 place-items-center rounded-2xl border"
              style={{
                background: BRAND.paper2,
                borderColor: BRAND.rule2,
                color: BRAND.ink4,
              }}
            >
              <Briefcase size={28} />
            </div>
            <h2
              className="mt-4 font-medium text-lg"
              style={{ color: BRAND.ink }}
            >
              {labels.empty}
            </h2>
            <p className="mt-1 max-w-sm text-sm" style={{ color: BRAND.ink4 }}>
              {labels.emptyDescription}
            </p>
          </div>
        ) : (
          <>
            <div
              className="hidden grid-cols-[1.45fr_0.85fr_0.55fr_0.65fr_0.45fr] gap-4 px-4 py-3 font-medium text-[11px] uppercase tracking-[0.12em] md:grid"
              style={{ color: BRAND.ink4 }}
            >
              <div>{ts("table.position")}</div>
              <div>{tc("department")}</div>
              <div>{t("fields.status")}</div>
              <div>{ts("table.deadline")}</div>
              <div className="text-right">{tc("actions")}</div>
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

      <PaginationBar page={page} size={JOBS_PAGE_SIZE} total={total} />
    </div>
  );
}
