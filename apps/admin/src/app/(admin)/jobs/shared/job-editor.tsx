"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/ui/components/ui/breadcrumb";
import { Form } from "@repo/ui/components/ui/form";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { DraftRestoreBanner } from "@/components/forms/draft-restore-banner";
import { FormSection } from "@/components/forms/form-section";
import type { SaveStatus } from "@/components/forms/save-bar";
import { SaveBar } from "@/components/forms/save-bar";
import { JobPreviewPane } from "@/components/preview/job-preview-pane";
import { PreviewPanel } from "@/components/preview/preview-panel";
import { useAutosave } from "@/hooks/use-autosave";
import { useDirtyWarning } from "@/hooks/use-dirty-warning";
import type { AdminJob } from "@/lib/types/job";
import { JobBasicInfo } from "./job-basic-info";
import { JobMetadata } from "./job-metadata";
import { JobTranslations } from "./job-translations";
import { useJobEditor } from "./use-job-editor";

export default function JobEditor({
  job,
  campuses,
  departments,
}: {
  job?: AdminJob | null;
  campuses?: { $id: string; name: string }[];
  departments?: { $id: string; Name: string; campus_id?: string }[];
}) {
  const t = useTranslations("adminJobs");
  const storageKey = `job:${job?.$id ?? "new"}`;

  const {
    form,
    router,
    setSelectedCampus,
    isTranslating,
    activeLocale,
    setActiveLocale,
    filteredDepartments,
    onSubmit,
    handleTranslate,
  } = useJobEditor(job, departments);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [draftRestoreData, setDraftRestoreData] = useState<{
    values: ReturnType<typeof form.getValues>;
    savedAt: Date;
  } | null>(null);

  const { isDirty, isSubmitting } = form.formState;

  const autosave = useAutosave({
    storageKey,
    values: form.watch(),
    isDirty,
    onRestoreDraft: (draft) => {
      setDraftRestoreData({
        values: draft as ReturnType<typeof form.getValues>,
        savedAt: new Date(),
      });
    },
  });

  useDirtyWarning({ isDirty, isSubmitting });

  const handleSave = async () => {
    setSaveStatus("saving");
    try {
      await form.handleSubmit(async (values) => {
        await onSubmit(values);
        setSaveStatus("saved");
        autosave.clearDraft();
      })();
    } catch {
      setSaveStatus("error");
    }
  };

  const watchValues = form.watch();
  const campusName = campuses?.find(
    (c) => c.$id === watchValues.campus_id
  )?.name;

  const pageTitle = job?.$id
    ? (job.translations?.en?.title ?? job.slug ?? t("edit"))
    : t("new");

  return (
    <div className="flex h-full flex-col gap-0">
      {/* Breadcrumb */}
      <div className="shrink-0 border-border/40 border-b bg-background px-6 py-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/jobs">{t("jobs")}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <PreviewPanel
        renderPreview={(locale) => (
          <JobPreviewPane
            data={{
              status: watchValues.status,
              type: watchValues.type,
              application_deadline: watchValues.application_deadline,
              start_date: watchValues.start_date,
              contact_name: watchValues.contact_name,
              contact_email: watchValues.contact_email,
              apply_url: watchValues.apply_url,
              image: watchValues.image,
              campusName,
              translations: {
                en: watchValues.translations?.en,
                no: watchValues.translations?.no,
              },
            }}
            locale={locale}
          />
        )}
      >
        <div className="space-y-6 p-6">
          {/* Draft restore banner */}
          {draftRestoreData && (
            <DraftRestoreBanner
              onDiscard={() => {
                autosave.clearDraft();
                setDraftRestoreData(null);
              }}
              onRestore={() => {
                form.reset(draftRestoreData.values);
                setDraftRestoreData(null);
              }}
              savedAt={draftRestoreData.savedAt}
            />
          )}

          <Form {...form}>
            <form
              className="space-y-6"
              id="job-form"
              onSubmit={form.handleSubmit(onSubmit)}
            >
              {/* Content section */}
              <FormSection
                subtitle="Write compelling content in both languages to reach all students"
                title={t("editor.contentTranslations")}
              >
                <JobTranslations
                  activeLocale={activeLocale}
                  isTranslating={isTranslating}
                  jobId={job?.$id}
                  onTranslate={handleTranslate}
                  setActiveLocale={setActiveLocale}
                />
              </FormSection>

              {/* Organisation section */}
              <FormSection
                subtitle="Campus, department and publishing settings"
                title={t("editor.basicInformation")}
              >
                <JobBasicInfo
                  campuses={campuses}
                  filteredDepartments={filteredDepartments}
                  onCampusChange={setSelectedCampus}
                />
              </FormSection>

              {/* Details section */}
              <FormSection
                collapsible
                defaultOpen
                subtitle="Deadline, contact, and application details"
                title={t("editor.metadataTitle")}
              >
                <JobMetadata />
              </FormSection>
            </form>
          </Form>
        </div>
      </PreviewPanel>

      <SaveBar
        autosaveEnabled={autosave.enabled}
        cancelLabel={t("form.cancel")}
        isDirty={isDirty}
        isSubmitting={isSubmitting}
        lastSaved={autosave.lastSaved}
        onAutosaveToggle={autosave.setEnabled}
        onCancel={() => router.back()}
        onSave={handleSave}
        saveLabel={job?.$id ? t("editor.updateJob") : t("editor.createJob")}
        status={autosave.isSaving ? "saving" : saveStatus}
      />
    </div>
  );
}
