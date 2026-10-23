"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createProjectHubPage } from "@/app/(portal)/_actions/departments";
import { StudioButton } from "@/app/(portal)/_components/studio";
import { HUB_PROJECTS } from "@/lib/project-hub";

/**
 * Global admins only (the page hides it from everyone else, and the action
 * checks the role itself): creates the department-less hub page of a
 * multi-campus project and opens it in the editor.
 */
export function CreateProjectHubButton({
  label,
  projectLabel,
}: {
  label: string;
  projectLabel: string;
}) {
  const router = useRouter();
  const [project, setProject] = useState<string>(HUB_PROJECTS[0]?.slug ?? "");
  const [pending, startTransition] = useTransition();

  const create = () => {
    startTransition(async () => {
      const result = await createProjectHubPage(project);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      router.push(`/pages/${result.pageId}`);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label={projectLabel}
        className="rounded-lg border bg-transparent px-3 py-2.5 text-sm"
        disabled={pending}
        onChange={(event) => setProject(event.target.value)}
        value={project}
      >
        {HUB_PROJECTS.map((entry) => (
          <option key={entry.slug} value={entry.slug}>
            {entry.name}
          </option>
        ))}
      </select>
      <StudioButton disabled={pending} onClick={create}>
        <Plus size={15} />
        {label}
      </StudioButton>
    </div>
  );
}
