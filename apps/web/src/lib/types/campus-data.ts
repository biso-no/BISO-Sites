import type { Models } from "@repo/api";

export interface CampusData extends Models.Row {
  businessBenefits?: string[];
  businessBenefits_en?: string[];
  businessBenefits_nb?: string[];
  careerAdvantages?: string[];
  careerAdvantages_en?: string[];
  careerAdvantages_nb?: string[];
  departmentBoard?: Array<{
    name?: string;
    imageUrl?: string;
    role?: string;
    [key: string]: unknown;
  }>;
  description?: string | null;
  description_en?: string | null;
  description_nb?: string | null;
  location?: string | null;
  name?: string | null;
  name_en?: string | null;
  name_nb?: string | null;
  safety?: string[];
  safety_en?: string[];
  safety_nb?: string[];
  socialNetwork?: string[];
  socialNetwork_en?: string[];
  socialNetwork_nb?: string[];
  studentBenefits?: string[];
  studentBenefits_en?: string[];
  studentBenefits_nb?: string[];
}
