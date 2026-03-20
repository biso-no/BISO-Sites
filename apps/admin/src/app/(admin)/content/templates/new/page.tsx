import { redirect } from "next/navigation";
import { isGlobalAdmin } from "@/lib/authorization";
import { TemplateStudioClient } from "../../_components/template-studio-client";

export default async function NewContentTemplatePage() {
  if (!(await isGlobalAdmin())) {
    redirect("/content/entries");
  }

  return <TemplateStudioClient />;
}
