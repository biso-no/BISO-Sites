"use client";

// External libraries
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft } from "lucide-react";

// UI components
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Form } from "@repo/ui/components/ui/form";

// Internal server actions
import { getCampuses, getCampusWithDepartments } from "@/app/actions/campus";
import { createEvent, updateEvent } from "@/app/actions/events";

// Internal hooks & types
import { toast } from "@/lib/hooks/use-toast";
import type { AdminEvent } from "@/lib/types/event";
import type { Campus } from "@/lib/types/post";

// Local components
import { EventOptions } from "./EventOptions";
import { EventSchedule } from "./EventSchedule";
import { EventSidebar } from "./EventSidebar";
import { EventTranslations } from "./EventTranslations";

// Local schema
import { formSchema, getEventDefaultValues, mapFormValuesToPayload } from "./schema";
import type { FormValues } from "./schema";


type EventEditorProps = {
  event?: AdminEvent | null;
};

export default function EventEditor({ event }: EventEditorProps) {
  const router = useRouter();
  const t = useTranslations("adminEvents");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [departments, setDepartments] = useState<
    Array<{ $id: string; Name: string }>
  >([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);

  const isEditing = !!event;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getEventDefaultValues(event || undefined),
  });

  // Load campuses
  useEffect(() => {
    async function fetchCampuses() {
      try {
        const campusData = await getCampuses();
        setCampuses(campusData);
      } catch (error) {
        console.error("Error fetching campuses:", error);
        toast({ title: "Failed to load campuses", variant: "destructive" });
      }
    }
    fetchCampuses();
  }, []);

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
          result.campus.departments.filter((dept: any) => dept.active)
        );
      } else {
        setDepartments([]);
      }
    } catch (error) {
      console.error("Error loading departments:", error);
      toast({ title: "Failed to load departments", variant: "destructive" });
      setDepartments([]);
    } finally {
      setLoadingDepartments(false);
    }
  }, []);

  // Initial departments load
  useEffect(() => {
    if (event?.campus_id) {
      loadDepartmentsForCampus(event.campus_id);
    }
  }, [event, loadDepartmentsForCampus]);

  // Watch for campus changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "campus_id" && value.campus_id) {
        // Clear department when campus changes
        form.setValue("department_id", "");
        loadDepartmentsForCampus(value.campus_id);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, loadDepartmentsForCampus]);

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const payload = mapFormValuesToPayload(values);

      if (event?.$id) {
        await updateEvent(event.$id, payload);
        toast({ title: t("messages.eventUpdated") });
      } else {
        await createEvent(payload);
        toast({ title: t("messages.eventCreated") });
      }

      router.push("/admin/events");
    } catch (error) {
      console.error(error);
      toast({ title: t("messages.eventSaveFailed"), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const eventTitle = event?.translation_refs?.[0]?.title || event?.slug || "";
  const headerTitle = isEditing
    ? t("editor.headerEdit", { title: eventTitle || t("editor.title") })
    : t("editor.headerNew");

  return (
    <div className="flex min-h-screen w-full flex-col">
      <div className="flex flex-col sm:gap-4">
        <main className="grid flex-1 items-start gap-4">
          {/* Header */}
          <div className="mb-4 flex items-center gap-4">
            <Button
              className="h-7 w-7"
              onClick={() => router.back()}
              size="icon"
              variant="outline"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">{t("editor.back")}</span>
            </Button>
            <h1 className="flex-1 shrink-0 whitespace-nowrap font-semibold text-xl tracking-tight sm:grow-0">
              {headerTitle}
            </h1>
            <Badge className="ml-auto sm:ml-0" variant="outline">
              {form.watch("status")}
            </Badge>
            <div className="hidden items-center gap-2 md:ml-auto md:flex">
              <Button onClick={() => router.back()} size="sm" variant="outline">
                {t("form.cancel")}
              </Button>
              <Button
                disabled={isSubmitting}
                onClick={form.handleSubmit(onSubmit)}
                size="sm"
              >
                {isSubmitting ? t("editor.saving") : t("editor.saveEvent")}
              </Button>
            </div>
          </div>

          <Form {...form}>
            <form
              className="grid gap-6 lg:grid-cols-[1fr_400px]"
              onSubmit={form.handleSubmit(onSubmit)}
            >
              {/* LEFT COLUMN - Form Content */}
              <div className="space-y-6">
                <EventTranslations />
                <EventSchedule
                  campuses={campuses}
                  departments={departments}
                  loadingDepartments={loadingDepartments}
                />
                <EventOptions event={event} />
              </div>

              {/* RIGHT COLUMN - Sticky Sidebar */}
              <EventSidebar
                campuses={campuses}
                departments={departments}
                loadingDepartments={loadingDepartments}
              />
            </form>
          </Form>

          {/* Mobile Actions */}
          <div className="mt-4 flex items-center justify-center gap-2 md:hidden">
            <Button onClick={() => router.back()} size="sm" variant="outline">
              {t("form.cancel")}
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={form.handleSubmit(onSubmit)}
              size="sm"
            >
              {isSubmitting ? t("editor.saving") : t("editor.saveEvent")}
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}
