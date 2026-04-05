import type { Models } from "@repo/api";

export interface FundingProgram extends Models.Row {
  application_url?: string;
  contact_email?: string;
  contact_name?: string;
  contact_phone?: string;
  document_url?: string;
  hero_image_url?: string;
  metadata?: string;
  slug: string;
  status?: string;
}

export interface ParsedFundingProgram extends FundingProgram {
  parsedMetadata: FundingProgramMetadata;
}

export interface FundingProgramMetadata {
  contact_en?: string;
  contact_nb?: string;
  documents?: Array<{ label_nb: string; label_en: string; url: string }>;
  eligibility_en?: string[];
  eligibility_nb?: string[];
  faqs_en?: Array<{ question: string; answer: string }>;
  faqs_nb?: Array<{ question: string; answer: string }>;
  grant_en?: string[];
  grant_nb?: string[];
  intro_en?: string;
  intro_nb?: string;
  steps_en?: string[];
  steps_nb?: string[];
  title_en?: string;
  title_nb?: string;
}
