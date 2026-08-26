"use client";

import type { Pages } from "@repo/api/types/appwrite";
import { PagesStatus } from "@repo/api/types/appwrite";
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
  draft: string;
  editPage: string;
  noPage: string;
  noSlug: string;
  pageHeading: string;
  published: string;
  viewLive: string;
}

export function UnitPageCard({
  canonicalPath,
  departmentId,
  labels,
  liveUrl,
  page,
}: {
  canonicalPath: string | null;
  departmentId: string;
  labels: Labels;
  liveUrl: string | null;
  page: Pages | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const isPublished = page?.status === PagesStatus.PUBLISHED;
  const statusLabel = page && (isPublished ? labels.published : labels.draft);

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
          <div className="flex items-center gap-2 text-sm">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                background: isPublished ? STUDIO.claret : STUDIO.ink4,
              }}
            />
            <span style={{ color: STUDIO.ink3 }}>{statusLabel}</span>
            {page ? (
              <code className="text-xs" style={{ color: STUDIO.ink4 }}>
                {canonicalPath}
              </code>
            ) : (
              <span style={{ color: STUDIO.ink3 }}>{labels.noPage}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {page ? (
              <StudioButton
                onClick={() => router.push(`/pages/${page.$id}`)}
                variant="primary"
              >
                <SquarePen size={15} />
                {labels.editPage}
              </StudioButton>
            ) : (
              <StudioButton
                disabled={pending}
                onClick={handleCreate}
                variant="primary"
              >
                <Plus size={15} />
                {labels.createPage}
              </StudioButton>
            )}

            {isPublished && liveUrl && (
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
        </div>
      )}
    </StudioPanel>
  );
}
