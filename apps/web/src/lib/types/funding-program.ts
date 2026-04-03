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

export type FundingProgramMetadata = {
  title_nb?: string;
  title_en?: string;
  intro_nb?: string;
  intro_en?: string;
  grant_nb?: string[];
  grant_en?: string[];
  eligibility_nb?: string[];
  eligibility_en?: string[];
  steps_nb?: string[];
  steps_en?: string[];
  documents?: Array<{ label_nb: string; label_en: string; url: string }>;
  faqs_nb?: Array<{ question: string; answer: string }>;
  faqs_en?: Array<{ question: string; answer: string }>;
  contact_nb?: string;
  contact_en?: string;
};
