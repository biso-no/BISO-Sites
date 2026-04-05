import type { Models } from "@repo/api";

export interface JobApplication extends Models.Row {
  applicant_email: string;
  applicant_name: string;
  applicant_phone?: string;
  consent_date: string;
  cover_letter?: string;
  data_processing_purpose: string;
  data_retention_until: string;
  gdpr_consent: boolean;
  // Relationship references (populated at runtime)
  job?: {
    $id: string;
    title: string;
    campus_id: string;
    department_id: string;
    locale: string;
  };
  job_id: string;
  resume_file_id?: string;
  status: "submitted" | "reviewed" | "interview" | "accepted" | "rejected";
}

export interface JobApplicationFormData {
  applicant_email: string;
  applicant_name: string;
  applicant_phone?: string;
  cover_letter?: string;
  gdpr_consent: boolean;
  resume?: File;
}
