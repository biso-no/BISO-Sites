import type { Models } from "@repo/api";

export interface JobApplication extends Models.Row {
  ai_screening?: string | null;
  applicant_email: string;
  applicant_name: string;
  applicant_phone?: string | null;
  candidate_profile_id?: string | null;
  consent_date: string;
  cover_letter?: string | null;
  data_processing_purpose: string;
  data_retention_until: string;
  embedding_status?: "pending" | "ready" | "failed";
  gdpr_consent: boolean;
  // Relationship references (populated at runtime by the API view)
  job?: {
    $id: string;
    title: string;
    campus_id: string;
    department_id: string;
    locale: string;
  };
  job_id: string;
  resume_file_id?: string | null;
  review_metadata?: string | null;
  screening_score?: number | null;
  source?: string | null;
  status: "submitted" | "reviewed" | "interview" | "accepted" | "rejected";
}

export interface JobApplicationFormData {
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
  applicant_email: string;
  applicant_name: string;
  applicant_phone?: string;
  cover_letter?: string;
  current_employer?: string;
  current_role?: string;
  gdpr_consent: boolean;
  linkedin_url?: string;
  resume?: File;
}
