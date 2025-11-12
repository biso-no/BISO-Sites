import { Models } from "@repo/api"

export interface CampusData extends Models.Row {
  name?: string | null
  name_nb?: string | null
  name_en?: string | null
  description?: string | null
  description_nb?: string | null
  description_en?: string | null
  businessBenefits?: string[]
  businessBenefits_nb?: string[]
  businessBenefits_en?: string[]
  studentBenefits?: string[]
  studentBenefits_nb?: string[]
  studentBenefits_en?: string[]
  careerAdvantages?: string[]
  careerAdvantages_nb?: string[]
  careerAdvantages_en?: string[]
  socialNetwork?: string[]
  socialNetwork_nb?: string[]
  socialNetwork_en?: string[]
  safety?: string[]
  safety_nb?: string[]
  safety_en?: string[]
  location?: string | null
  departmentBoard?: Array<{
    name?: string
    imageUrl?: string
    role?: string
    [key: string]: unknown
  }>
}
