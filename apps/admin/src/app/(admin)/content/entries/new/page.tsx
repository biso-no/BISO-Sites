import { listPublishedTemplateOptions } from "@/app/actions/editorial";
import { EntryTemplatePickerClient } from "../../_components/entry-template-picker-client";

export default async function NewContentEntryPage() {
  const templates = await listPublishedTemplateOptions();

  return <EntryTemplatePickerClient templates={templates} />;
}
