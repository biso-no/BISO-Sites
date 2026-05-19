import { notFound } from "next/navigation";
import type { PageDoc } from "@repo/editor";
import { listDepartments } from "@/app/(portal)/_actions/departments";
import { getPageById } from "@/app/(portal)/_actions/pages";
import { PageEditorClient } from "./_components/page-editor-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PageEditorPage({ params }: Props) {
  const { id } = await params;

  const isNew = id === "new";

  const [pageResult, departments] = await Promise.all([
    isNew ? null : getPageById(id, "no"),
    listDepartments(),
  ]);

  if (!isNew && !pageResult) {
    notFound();
  }

  const editorDepartments = departments.map((d) => ({
    id: d.$id,
    name: d.Name ?? d.$id,
  }));

  return (
    <PageEditorClient
      initial={(pageResult?.doc as PageDoc) ?? null}
      pageId={isNew ? null : id}
      departments={editorDepartments}
    />
  );
}
