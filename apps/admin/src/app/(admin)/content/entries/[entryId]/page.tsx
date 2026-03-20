import {
  type EditorialQueryCollection,
  type EditorialQueryItem,
  runEditorialQuery,
} from "@repo/api/editorial";
import { Locale } from "@repo/api/types/appwrite";
import { notFound } from "next/navigation";
import { getManagedContentEntry } from "@/app/actions/editorial";
import { EntryEditorClient } from "../../_components/entry-editor-client";

type EntryPageProps = {
  params: Promise<{
    entryId: string;
  }>;
};

export default async function ContentEntryPage({ params }: EntryPageProps) {
  const { entryId } = await params;
  const result = await getManagedContentEntry(entryId);

  if (!result?.template?.publishedVersion) {
    notFound();
  }

  const relationFields = result.template.publishedVersion.fieldSchema.filter(
    (field) => field.type === "relation" && field.collection
  );
  const relationOptionsEntries = await Promise.all(
    relationFields.map(async (field) => {
      const collection = field.collection as EditorialQueryCollection;
      const [noOptions, enOptions] = await Promise.all([
        runEditorialQuery(
          {
            collection,
            limit: 50,
            mode: "list",
          },
          { locale: Locale.NO, viewerIsAuthenticated: true }
        ),
        runEditorialQuery(
          {
            collection,
            limit: 50,
            mode: "list",
          },
          { locale: Locale.EN, viewerIsAuthenticated: true }
        ),
      ]);

      return [
        field.id,
        {
          no: noOptions,
          en: enOptions,
        },
      ] as const;
    })
  );

  return (
    <EntryEditorClient
      entry={result.entry}
      relationOptions={
        Object.fromEntries(relationOptionsEntries) as Record<
          string,
          { no: EditorialQueryItem[]; en: EditorialQueryItem[] }
        >
      }
      template={result.template}
    />
  );
}
