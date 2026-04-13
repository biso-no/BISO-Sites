import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  getDocument,
  listCampusesForDocuments,
  listSharePointDrives,
} from "../../_actions/documents";
import { DocumentEditorClient } from "./_components/document-editor-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DocumentEditorPage({ params }: Props) {
  const { id } = await params;
  const t = await getTranslations("adminPortal.documents");
  const tc = await getTranslations("adminPortal.common");

  const isNew = id === "new";
  const [document, campuses, drives] = await Promise.all([
    isNew ? null : getDocument(id),
    listCampusesForDocuments(),
    isNew ? listSharePointDrives() : Promise.resolve([]),
  ]);

  if (!(isNew || document)) {
    notFound();
  }

  return (
    <DocumentEditorClient
      campuses={campuses}
      document={document}
      drives={drives}
      isNew={isNew}
      labels={{
        back: t("title"),
        title: t("fields.title"),
        description: t("fields.description"),
        category: t("fields.category"),
        scope: t("fields.scope"),
        campus: t("fields.campus"),
        version: t("fields.version"),
        versionNumber: t("fields.versionNumber"),
        status: t("fields.status"),
        sortOrder: t("fields.sortOrder"),
        file: t("fields.file"),
        sharepointDriveId: t("fields.sharepointDriveId"),
        sharepointFolderPath: t("fields.sharepointFolderPath"),
        fileSize: t("fields.fileSize"),
        lastUpdated: t("fields.lastUpdated"),
        discard: tc("discard"),
        save: tc("save"),
        publish: tc("publish"),
        saveSuccess: t("saveSuccess"),
        saveError: t("saveError"),
        uploadSuccess: t("uploadSuccess"),
        uploadError: t("uploadError"),
        sharepointError: t("sharepointError"),
        uploadVersion: t("actions.uploadVersion"),
        viewOnSharePoint: t("actions.viewOnSharePoint"),
        versionUploadHint: t("versionUploadHint"),
        sharepointHint: t("sharepointHint"),
      }}
    />
  );
}
