"use client";

import { FeedCardShell, FeedSection } from "@/blocks/_v2/feed-section";
import { Pill } from "@/blocks/_v2/pill";
import { useBlockFeed } from "@/blocks/_v2/use-block-feed";
import type { PatchFn } from "@/blocks/types";
import type { EditorLocale, JobsBlock } from "@/editor/types";

interface FeedJob {
  commitment?: string;
  deadline?: string;
  deadlineIso?: string;
  department?: string;
  employmentType?: string;
  href?: string;
  id?: string;
  paid?: boolean;
  title?: string;
}

const LABELS: Record<EditorLocale, { deadline: string; paid: string }> = {
  en: { deadline: "Apply by", paid: "Paid" },
  no: { deadline: "Søknadsfrist", paid: "Betalt" },
};

const CARD =
  "group flex h-full flex-col rounded-biso-md border border-edge p-5 transition-colors hover:border-ink-accent";

function JobCard({
  edit,
  job,
  locale,
}: {
  edit: boolean;
  job: FeedJob;
  locale: EditorLocale;
}) {
  const labels = LABELS[locale] ?? LABELS.no;
  const kind = job.employmentType || job.commitment;
  return (
    <FeedCardShell className={CARD} edit={edit} href={job.href}>
      {kind || job.paid ? (
        <span className="mb-3 flex flex-wrap gap-2">
          {kind ? (
            <Pill tone="accent" uppercase>
              {kind}
            </Pill>
          ) : null}
          {job.paid ? <Pill tone="success">{labels.paid}</Pill> : null}
        </span>
      ) : null}
      <span className="type-heading-card text-ink group-hover:text-ink-accent">
        {job.title}
      </span>
      {job.department ? (
        <span className="type-body-sm mt-2 text-ink-muted">
          {job.department}
        </span>
      ) : null}
      {job.deadline ? (
        <time
          className="type-data mt-auto pt-4 text-ink-muted"
          dateTime={job.deadlineIso}
        >
          {labels.deadline} {job.deadline}
        </time>
      ) : null}
    </FeedCardShell>
  );
}

interface Props {
  block: JobsBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function JobsRender({ block, edit, onPatch }: Props) {
  const { dept, items, locale } = useBlockFeed<FeedJob>(
    "jobs",
    block.source,
    block.limit
  );
  return (
    <FeedSection
      dept={dept}
      edit={edit}
      heading={block.heading}
      items={items}
      locale={locale}
      noun="open roles"
      onPatch={onPatch}
      seeAll={block.seeAll !== false}
      seeAllHref="/jobs"
    >
      {(items ?? []).map((job, i) => (
        <JobCard edit={edit} job={job} key={job.id ?? i} locale={locale} />
      ))}
    </FeedSection>
  );
}
