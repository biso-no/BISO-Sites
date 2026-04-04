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

const filterDepartments = (
  departments: { $id: string; Name: string; campus_id?: string }[] | undefined,
  selectedCampus: string
) => {
  if (!departments) return [];
  if (!selectedCampus) return departments;
  return departments.filter((d) => d.campus_id === selectedCampus);
};

const buildDefaultValues = (job?: AdminJob | null): FormValues => {
  const metadata = job?.metadata_parsed ?? {};
  const en = job?.translations?.en;
  const no = job?.translations?.no;

  return {
    slug: job?.slug ?? "",
    status: (job?.status as FormValues["status"]) ?? "draft",
    campus_id: job?.campus_id ?? "",
    department_id: job?.department_id ?? "",
    type: (metadata.type as string) ?? "",
    application_deadline: (metadata.application_deadline as string) ?? "",
    start_date: (metadata.start_date as string) ?? "",
    contact_name: (metadata.contact_name as string) ?? "",
    contact_email: (metadata.contact_email as string) ?? "",
    apply_url: (metadata.apply_url as string) ?? "",
    image: (metadata.image as string) ?? "",
    translations: {
      en: {
        title: en?.title ?? "",
        description: en?.description ?? "",
      },
      no: {
        title: no?.title ?? "",
        description: no?.description ?? "",
      },
    },
  };
};

export function useJobEditor(
  job: AdminJob | null | undefined,
  departments: { $id: string; Name: string; campus_id?: string }[] | undefined
) {
  const router = useRouter();
  const t = useTranslations("adminJobs");
  const [selectedCampus, setSelectedCampus] = useState<string>(
    job?.campus_id ?? ""
  );
  const [isTranslating, setIsTranslating] = useState(false);
  const [activeLocale, setActiveLocale] = useState<"en" | "no">("en");

  const filteredDepartments = useMemo(
    () => filterDepartments(departments, selectedCampus),
    [departments, selectedCampus]
  );

  const form: UseFormReturn<FormValues> = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: buildDefaultValues(job),
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
      setActiveLocale,
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
    activeLocale,
    setActiveLocale,
    filteredDepartments,
    onSubmit,
    handleTranslate: onTranslate,
  };
}
