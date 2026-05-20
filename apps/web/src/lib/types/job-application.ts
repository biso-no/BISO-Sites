import type { Models } from "@repo/api";

export interface JobApplication extends Models.Row {
  applicant_email: string;
  applicant_name: string;
  applicant_phone?: string | null;
  consent_date: string;
  cover_letter?: string | null;
  data_processing_purpose: string;
  data_retention_until: string;
  gdpr_consent: boolean;
  job_id: string;
  resume_file_id?: string | null;
  review_metadata?: string | null;
  candidate_profile_id?: string | null;
  ai_screening?: string | null;
  screening_score?: number | null;
  embedding_status?: "pending" | "ready" | "failed";
  source?: string | null;
  status: "submitted" | "reviewed" | "interview" | "accepted" | "rejected";
  // Relationship references (populated at runtime by the API view)
  job?: {
    $id: string;
    title: string;
    campus_id: string;
    department_id: string;
    locale: string;
  };
}

export interface JobApplicationFormData {
  applicant_email: string;
  applicant_name: string;
  applicant_phone?: string;
  cover_letter?: string;
  gdpr_consent: boolean;
  resume?: File;
  linkedin_url?: string;
  current_role?: string;
  current_employer?: string;
  answers?: Array<{
    question_id: string;
    question_label: string;
    answer_type:
      | "text"
      | "long_text"
      | "select"
      | "multi_select"
      | "boolean"
      | "number";
    answer: string | null;
  }>;
}
