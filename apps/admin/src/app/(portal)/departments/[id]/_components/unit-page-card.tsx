"use client";

import { ExternalLink, Plus, SquarePen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { createUnitPage } from "@/app/(portal)/_actions/departments";
import {
  SERIF_STACK,
  STUDIO,
  StudioButton,
  StudioPanel,
} from "@/app/(portal)/_components/studio";

interface Labels {
  createPage: string;
  createPageDisabledInactive: string;
  draft: string;
  editPage: string;
  inactiveLiveNotice: string;
  noPage: string;
  noSlug: string;
  notPublished: string;
  pageHeading: string;
  published: string;
  slugConflict: string;
  viewLive: string;
}

/**
 * One row per editor locale. `exists` distinguishes "there is a draft in this
 * language" from "this language was never written", which the labels below
 * report differently.
 */
export interface UnitPageLocaleStatus {
  exists: boolean;
  label: string;
  locale: string;
  published: boolean;
}

function localeStatusLabel(
  status: UnitPageLocaleStatus,
  labels: Labels
): string {
  if (status.published) {
    return labels.published;
  }
  if (status.exists) {
    return labels.draft;
  }
  return labels.notPublished;
}

export function UnitPageCard({
  canonicalPath,
  departmentId,
  isDepartmentActive,
  labels,
  liveUrl,
  localeStatuses,
  pageId,
  slugConflict,
}: {
  canonicalPath: string | null;
  departmentId: string;
  isDepartmentActive: boolean;
  labels: Labels;
  liveUrl: string | null;
  localeStatuses: UnitPageLocaleStatus[];
  pageId: string | null;
  slugConflict: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Publishing is per-locale (page_translations.is_published) while
  // pages.status flips to "published" the moment ANY locale goes live. Drive
  // every signal here off the per-locale rows so a board that published only
  // Norwegian is not told English is live too.
  const anyPublished = localeStatuses.some((status) => status.published);

  // createUnitPage itself rejects an inactive department (both public
  // lookups filter active = true, so a page created for one can only ever
  // 404) — mirror that here so the button isn't offered only to bounce off
  // a server error. Hiding "View live" for an inactive department while
  // still offering creation would be half the rule.
  const noPageYet = !(pageId || slugConflict);
  const canCreatePage = noPageYet && isDepartmentActive;
  const showInactiveCreateNotice = noPageYet && !isDepartmentActive;

  const handleCreate = () => {
    startTransition(async () => {
      const result = await createUnitPage(departmentId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      router.push(`/pages/${result.pageId}`);
    });
  };

  // StudioPanel is a bare surface — { children, className?, style? }, no title
  // prop and no padding of its own. The heading and padding belong here.
  return (
    <StudioPanel className="p-5">
      <h2
        className="mb-4 text-xl leading-6"
        style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
      >
        {labels.pageHeading}
      </h2>
      {canonicalPath === null ? (
        <p className="text-sm" style={{ color: STUDIO.ink3 }}>
          {labels.noSlug}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {pageId ? (
            <div className="flex flex-col gap-2">
              <code className="text-xs" style={{ color: STUDIO.ink4 }}>
                {canonicalPath}
              </code>
              <ul className="flex flex-wrap gap-x-6 gap-y-1">
                {localeStatuses.map((status) => (
                  <li
                    className="flex items-center gap-2 text-sm"
                    key={status.locale}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{
                        background: status.published
                          ? STUDIO.claret
                          : STUDIO.ink4,
                      }}
                    />
                    <span style={{ color: STUDIO.ink3 }}>{status.label}</span>
                    <span style={{ color: STUDIO.ink4 }}>
                      {localeStatusLabel(status, labels)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm" style={{ color: STUDIO.ink3 }}>
              {slugConflict ? labels.slugConflict : labels.noPage}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {pageId ? (
              <StudioButton
                onClick={() => router.push(`/pages/${pageId}`)}
                variant="primary"
              >
                <SquarePen size={15} />
                {labels.editPage}
              </StudioButton>
            ) : (
              canCreatePage && (
                <StudioButton
                  disabled={pending}
                  onClick={handleCreate}
                  variant="primary"
                >
                  <Plus size={15} />
                  {labels.createPage}
                </StudioButton>
              )
            )}

            {anyPublished && liveUrl && (
              <a
                className="inline-flex items-center gap-1 text-sm underline"
                href={liveUrl}
                rel="noopener"
                style={{ color: STUDIO.ink3 }}
                target="_blank"
              >
                <ExternalLink size={14} />
                {labels.viewLive}
              </a>
            )}
          </div>

          {showInactiveCreateNotice && (
            <p className="text-sm" style={{ color: STUDIO.ink3 }}>
              {labels.createPageDisabledInactive}
            </p>
          )}

          {anyPublished && !isDepartmentActive && (
            <p className="text-sm" style={{ color: STUDIO.ink3 }}>
              {labels.inactiveLiveNotice}
            </p>
          )}
        </div>
      )}
    </StudioPanel>
  );
}
