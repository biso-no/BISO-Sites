import { createJob, updateJob } from "@/app/actions/jobs";
import type { AdminJob } from "@/lib/types/job";
import type { FormValues } from "./schema";

type Toast = {
  title: string;
  variant?: "default" | "destructive";
};

type SubmitJobOptions = {
  values: FormValues;
  job?: AdminJob | null;
  t: (key: string) => string;
  router: { push: (url: string) => void };
  showToast: (props: Toast) => void;
};

export async function submitJob({
  values,
  job,
  t,
  router,
  showToast,
}: SubmitJobOptions) {
  try {
    const jobData = {
      slug: values.slug,
      status: values.status,
      campus_id: values.campus_id,
      department_id: values.department_id,
      metadata: {
        type: values.type || undefined,
        application_deadline: values.application_deadline || undefined,
        start_date: values.start_date || undefined,
        contact_name: values.contact_name || undefined,
        contact_email: values.contact_email || undefined,
        apply_url: values.apply_url || undefined,
        image: values.image || undefined,
      },
      translations: {
        en: {
          title: values.translations.en.title,
          description: values.translations.en.description,
        },
        no: {
          title: values.translations.no.title,
          description: values.translations.no.description,
        },
      },
    };

    if (job?.$id) {
      await updateJob(job.$id, jobData);
      showToast({ title: t("messages.jobUpdated") });
    } else {
      await createJob(jobData);
      showToast({ title: t("messages.jobCreated") });
      router.push("/jobs");
    }
  } catch (e) {
    console.error(e);
    showToast({ title: t("messages.saveFailed"), variant: "destructive" });
  }
}
