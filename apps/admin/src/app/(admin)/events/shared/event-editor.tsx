"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  useEntityContext,
  usePageContext,
} from "@repo/ai/hooks/use-copilot-context";
import { useCopilotForm } from "@repo/ai/hooks/use-copilot-form";
import { eventFormFields } from "@repo/ai/schemas/registry";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/ui/components/ui/breadcrumb";
import { Form } from "@repo/ui/components/ui/form";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { getCampusWithDepartments } from "@/app/actions/campus";
import { createEvent, updateEvent } from "@/app/actions/events";
import { DraftRestoreBanner } from "@/components/forms/DraftRestoreBanner";
import { FormSection } from "@/components/forms/FormSection";
import { SaveBar, type SaveStatus } from "@/components/forms/SaveBar";
import { EventPreviewPane } from "@/components/preview/EventPreviewPane";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import { useAutosave } from "@/hooks/useAutosave";
import { useDirtyWarning } from "@/hooks/useDirtyWarning";
import { toast } from "@/lib/hooks/use-toast";
import type { AdminEvent } from "@/lib/types/event";
import type { Campus } from "@/lib/types/post";

import { EventOptions } from "./event-options";
import { EventSchedule } from "./event-schedule";
import { EventSidebar } from "./event-sidebar";
import { EventTranslations } from "./event-translations";
import type { FormValues } from "./schema";
import {
  formSchema,
  getEventDefaultValues,
  mapFormValuesToPayload,
} from "./schema";

interface EventEditorProps {
  campuses: Campus[];
  event?: AdminEvent | null;
}

export default function EventEditor({ event, campuses }: EventEditorProps) {
  const router = useRouter();
  const t = useTranslations("adminEvents");

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [departments, setDepartments] = useState<
    Array<{ $id: string; Name: string }>
  >([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<{
    values: FormValues;
    savedAt: Date;
  } | null>(null);

  const isEditing = !!event;
  const storageKey = `event:${event?.$id ?? "new"}`;
  const eventTitle = event?.translation_refs?.[0]?.title ?? event?.slug ?? "";

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getEventDefaultValues(event ?? undefined),
    mode: "onBlur",
  });

  const { isDirty, isSubmitting } = form.formState;

  // Autosave
  const {
    lastSaved,
    enabled: autosaveEnabled,
    setEnabled: setAutosave,
    clearDraft,
  } = useAutosave<FormValues>({
    storageKey,
    values: form.watch(),
    isDirty,
    onRestoreDraft: (draft) => {
      // Surface the banner instead of silently restoring
      setPendingDraft({ values: draft, savedAt: new Date() });
    },
  });

  // Dirty state warning
  useDirtyWarning({ isDirty, isSubmitting });

  // AI copilot wiring (unchanged)
  useCopilotForm({
    form,
    capability: isEditing ? "edit-event" : "create-event",
    fields: eventFormFields,
  });

  useEntityContext(
    event
      ? {
          type: "event",
          id: event.$id,
          title: eventTitle,
          data: event as unknown as Record<string, unknown>,
          locale: event.translation_refs?.[0]?.locale,
          metadata: { status: event.status },
        }
      : null
  );

  usePageContext({
    section: "events",
    viewType: isEditing ? "editor" : "create",
    breadcrumb: isEditing ? ["Events", eventTitle] : ["Events", "New Event"],
  });

  // Load departments when campus changes
  const loadDepartmentsForCampus = useCallback(async (campusId: string) => {
    if (!campusId) {
      setDepartments([]);
      return;
    }
    setLoadingDepartments(true);
    try {
      const result = await getCampusWithDepartments(campusId);
      if (result.success && result.campus?.departments) {
        setDepartments(
          result.campus.departments.filter(
            (dept: { active?: boolean }) => dept.active
          )
        );
      } else {
        setDepartments([]);
      }
    } catch {
      toast({ title: "Failed to load departments", variant: "destructive" });
      setDepartments([]);
    } finally {
      setLoadingDepartments(false);
    }
  }, []);

  // Initial department load
  useEffect(() => {
    if (event?.campus_id) {
      loadDepartmentsForCampus(event.campus_id);
    }
  }, [event, loadDepartmentsForCampus]);

  // Watch campus changes
  useEffect(() => {
    const sub = form.watch((value, { name }) => {
      if (name === "campus_id" && value.campus_id) {
        form.setValue("department_id", "");
        loadDepartmentsForCampus(value.campus_id);
      }
    });
    return () => sub.unsubscribe();
  }, [form, loadDepartmentsForCampus]);

  const onSubmit = async (values: FormValues) => {
    setSaveStatus("saving");
    try {
      const payload = mapFormValuesToPayload(values);

      if (event?.$id) {
        await updateEvent(event.$id, payload);
        toast({ title: t("messages.eventUpdated") });
      } else {
        await createEvent(payload);
        toast({ title: t("messages.eventCreated") });
      }

      clearDraft();
      setSaveStatus("saved");
      router.push("/events");
    } catch (error) {
      console.error(error);
      setSaveStatus("error");
      toast({ title: t("messages.eventSaveFailed"), variant: "destructive" });
    }
  };

  const handleSave = form.handleSubmit(onSubmit);
  const handleCancel = () => {
    if (isDirty) {
      const ok = window.confirm(
        "You have unsaved changes. Leave without saving?"
      );
      if (!ok) {
        return;
      }
    }
    router.back();
  };

  const formValues = form.watch();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Breadcrumb header */}
      <div className="border-border/40 border-b bg-background/80 px-6 py-3 backdrop-blur-sm">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/events">
                {t("editor.events") || "Events"}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                {isEditing
                  ? eventTitle || t("editor.edit")
                  : t("editor.newEvent") || "New Event"}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Draft restore banner */}
      {pendingDraft && (
        <div className="px-6 pt-4">
          <DraftRestoreBanner
            onDiscard={() => {
              clearDraft();
              setPendingDraft(null);
            }}
            onRestore={() => {
              form.reset(pendingDraft.values);
              setPendingDraft(null);
            }}
            savedAt={pendingDraft.savedAt}
          />
        </div>
      )}

      {/* Main content — PreviewPanel handles resizable split */}
      <div className="flex-1 overflow-hidden">
        <PreviewPanel
          renderPreview={(locale) => (
            <EventPreviewPane data={formValues} locale={locale} />
          )}
        >
          <Form {...form}>
            <form
              className="space-y-6 px-6 py-6 lg:grid lg:grid-cols-[1fr_360px] lg:gap-6 lg:space-y-0"
              onSubmit={handleSave}
            >
              {/* LEFT COLUMN */}
              <div className="space-y-5">
                <FormSection
                  subtitle="Title and description in all languages"
                  title={t("editor.eventContentTitle") || "Event Content"}
                >
                  <EventTranslations />
                </FormSection>

                <FormSection
                  subtitle="Dates, times, and venue"
                  title={t("editor.scheduleTitle") || "Schedule & Location"}
                >
                  <EventSchedule
                    campuses={campuses}
                    departments={departments}
                    loadingDepartments={loadingDepartments}
                  />
                </FormSection>

                <FormSection
                  collapsible
                  defaultOpen={isEditing}
                  subtitle="Pricing, ticket links, member access, collections"
                  title={t("editor.optionsTitle") || "Options"}
                >
                  <EventOptions event={event} />
                </FormSection>
              </div>

              {/* RIGHT COLUMN — Sidebar */}
              <EventSidebar
                campuses={campuses}
                departments={departments}
                loadingDepartments={loadingDepartments}
              />
            </form>
          </Form>
        </PreviewPanel>
      </div>

      {/* Sticky save bar */}
      <SaveBar
        autosaveEnabled={autosaveEnabled}
        isDirty={isDirty}
        isSubmitting={isSubmitting}
        lastSaved={lastSaved}
        onAutosaveToggle={setAutosave}
        onCancel={handleCancel}
        onSave={handleSave}
        saveLabel={isEditing ? t("editor.saveEvent") : t("editor.saveEvent")}
        status={saveStatus}
      />
    </div>
  );
}
