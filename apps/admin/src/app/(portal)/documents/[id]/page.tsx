import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import {
  getDocument,
  listCampusesForDocuments,
} from "../../_actions/documents";
import { DocumentEditorClient } from "./_components/document-editor-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DocumentEditorPage({ params }: Props) {
  await requireNavAccess("portal.documents");
  const { id } = await params;
  const t = await getTranslations("adminPortal.documents");
  const tc = await getTranslations("adminPortal.common");

  const isNew = id === "new";
  const [document, campuses] = await Promise.all([
    isNew ? null : getDocument(id),
    listCampusesForDocuments(),
  ]);

  if (!(isNew || document)) {
    notFound();
  }

  return (
    <DocumentEditorClient
      campuses={campuses}
      document={document}
      isNew={isNew}
      labels={{
        back: t("title"),
        title: t("fields.title"),
        description: t("fields.description"),
        category: t("fields.category"),
        scope: t("fields.scope"),
        campus: t("fields.campus"),
        language: t("fields.language"),
        "category_national-statutes": t("categories.national-statutes"),
        "category_campus-bylaws": t("categories.campus-bylaws"),
        "category_code-of-conduct": t("categories.code-of-conduct"),
        "category_authorization-matrix": t("categories.authorization-matrix"),
        "category_target-documents": t("categories.target-documents"),
        version: t("fields.version"),
        versionNumber: t("fields.versionNumber"),
        status: t("fields.status"),
        sortOrder: t("fields.sortOrder"),
        file: t("fields.file"),
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
        languageNo: t("languages.no"),
        languageEn: t("languages.en"),
      }}
    />
  );
}
