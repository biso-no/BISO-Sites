import { listPublishedTemplateOptions } from "@/app/actions/editorial";
import { ContentTypePicker } from "../../_components/content-type-picker";

export default async function NewContentEntryPage() {
  const templates = await listPublishedTemplateOptions();

  return <ContentTypePicker templates={templates} />;
}
