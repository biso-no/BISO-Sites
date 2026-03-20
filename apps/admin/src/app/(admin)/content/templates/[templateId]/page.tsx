import { notFound, redirect } from "next/navigation";
import { getManagedContentTemplate } from "@/app/actions/editorial";
import { isGlobalAdmin } from "@/lib/authorization";
import { TemplateStudioClient } from "../../_components/template-studio-client";

type TemplatePageProps = {
  params: Promise<{
    templateId: string;
  }>;
};

export default async function ContentTemplatePage({
  params,
}: TemplatePageProps) {
  if (!(await isGlobalAdmin())) {
    redirect("/content/entries");
  }

  const { templateId } = await params;
  const template = await getManagedContentTemplate(templateId);

  if (!template) {
    notFound();
  }

  return <TemplateStudioClient initialTemplate={template} />;
}
