"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Form } from "@repo/ui/components/ui/form";
import { Languages } from "lucide-react";
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
  const {
    form,
    t,
    router,
    setSelectedCampus,
    isTranslating,
    activeTab,
    setActiveTab,
    filteredDepartments,
    onSubmit,
    handleTranslate,
  } = useJobEditor(job, departments);

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>{t("editor.jobDetailsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                className="space-y-6"
                onSubmit={form.handleSubmit(onSubmit)}
              >
                <JobBasicInfo
                  campuses={campuses}
                  filteredDepartments={filteredDepartments}
                  onCampusChange={setSelectedCampus}
                />

                <JobMetadata />

                <JobTranslations
                  activeTab={activeTab}
                  isTranslating={isTranslating}
                  jobId={job?.$id}
                  onTranslate={handleTranslate}
                  setActiveTab={setActiveTab}
                />

                <div className="flex justify-end gap-3">
                  <Button
                    onClick={() => router.back()}
                    type="button"
                    variant="outline"
                  >
                    {t("form.cancel")}
                  </Button>
                  <Button disabled={isTranslating} type="submit">
                    {job?.$id ? t("editor.updateJob") : t("editor.createJob")}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* Preview Panel */}
      <div className="space-y-4">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Languages className="h-4 w-4" />
              {t("editor.translationStatusTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">{t("editor.english")}</span>
              {form.watch("en_title") ? (
                <Badge
                  className="bg-green-100 text-green-800"
                  variant="default"
                >
                  {t("editor.complete")}
                </Badge>
              ) : (
                <Badge variant="secondary">{t("editor.missing")}</Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">{t("editor.norwegian")}</span>
              {form.watch("no_title") ? (
                <Badge
                  className="bg-green-100 text-green-800"
                  variant="default"
                >
                  {t("editor.complete")}
                </Badge>
              ) : (
                <Badge variant="secondary">{t("editor.missing")}</Badge>
              )}
            </div>

            {job?.$id && (
              <div className="border-t pt-3">
                <p className="text-muted-foreground text-xs">
                  {t("editor.saveBeforeTranslate")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Preview */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>{t("editor.previewTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <h4 className="font-medium">
                {activeTab === "en"
                  ? form.watch("en_title")
                  : form.watch("no_title") || t("editor.noTitle")}
              </h4>
              <p className="text-muted-foreground text-sm">
                {form.watch("campus_id") &&
                  campuses?.find((c) => c.$id === form.watch("campus_id"))
                    ?.name}
                {form.watch("type") && ` • ${form.watch("type")}`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
