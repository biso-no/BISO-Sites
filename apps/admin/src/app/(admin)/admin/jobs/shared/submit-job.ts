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
        type: values.type,
        application_deadline: values.application_deadline,
        start_date: values.start_date,
        contact_name: values.contact_name,
        contact_email: values.contact_email,
        apply_url: values.apply_url,
        image: values.image,
      },
      translations: {
        ...(values.en_title &&
          values.en_description && {
            en: {
              title: values.en_title,
              description: values.en_description,
            },
          }),
        ...(values.no_title &&
          values.no_description && {
            no: {
              title: values.no_title,
              description: values.no_description,
            },
          }),
      },
    };

    if (job?.$id) {
      await updateJob(job.$id, jobData);
      showToast({ title: t("messages.jobUpdated") });
    } else {
      await createJob(jobData);
      showToast({ title: t("messages.jobCreated") });
      router.push("/admin/jobs");
    }
  } catch (e) {
    console.error(e);
    showToast({ title: t("messages.saveFailed"), variant: "destructive" });
  }
}
