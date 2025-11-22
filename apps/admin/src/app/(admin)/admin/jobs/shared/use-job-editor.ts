"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  type SubmitHandler,
  type UseFormReturn,
  useForm,
} from "react-hook-form";
import { toast } from "@/lib/hooks/use-toast";
import type { AdminJob } from "@/lib/types/job";
import { handleTranslate } from "./handle-translate";
import { type FormValues, formSchema } from "./schema";
import { submitJob } from "./submit-job";

export function useJobEditor(
  job: AdminJob | null | undefined,
  departments: { $id: string; Name: string; campus_id?: string }[] | undefined
) {
  const router = useRouter();
  const t = useTranslations("adminJobs");
  const [selectedCampus, setSelectedCampus] = useState<string>(
    job?.campus_id || ""
  );
  const [isTranslating, setIsTranslating] = useState(false);
  const [activeTab, setActiveTab] = useState<"en" | "no">("en");

  const filteredDepartments = useMemo(() => {
    if (!departments) {
      return [];
    }
    if (!selectedCampus) {
      return departments;
    }
    return departments.filter((d) => d.campus_id === selectedCampus);
  }, [departments, selectedCampus]);

  const getTranslation = (locale: "en" | "no") => job?.translations?.[locale];
  const metadata = job?.metadata_parsed ?? {};

  const form: UseFormReturn<FormValues> = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      slug: job?.slug || "",
      status: (job?.status as "draft" | "published" | "closed") || "draft",
      campus_id: job?.campus_id || "",
      department_id: job?.department_id || "",
      type: metadata.type || "",
      application_deadline: metadata.application_deadline || "",
      start_date: metadata.start_date || "",
      contact_name: metadata.contact_name || "",
      contact_email: metadata.contact_email || "",
      apply_url: metadata.apply_url || "",
      image: metadata.image || "",
      en_title: getTranslation("en")?.title || "",
      en_description: getTranslation("en")?.description || "",
      no_title: getTranslation("no")?.title || "",
      no_description: getTranslation("no")?.description || "",
    },
  });

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    await submitJob({ values, job, t, router, showToast: toast });
  };

  const onTranslate = async (
    fromLocale: "en" | "no",
    toLocale: "en" | "no"
  ) => {
    await handleTranslate({
      jobId: job?.$id,
      fromLocale,
      toLocale,
      t,
      setIsTranslating,
      setValue: form.setValue,
      setActiveTab,
      showToast: toast,
    });
  };

  return {
    form,
    t,
    router,
    selectedCampus,
    setSelectedCampus,
    isTranslating,
    activeTab,
    setActiveTab,
    filteredDepartments,
    onSubmit,
    handleTranslate: onTranslate,
  };
}
