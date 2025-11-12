"use server"

import { createAdminClient } from "@repo/api/server"
import { CampusData } from "@repo/api/types/appwrite"

const NATIONAL_CAMPUS_ID = "5"
const NATIONAL_CAMPUS_NAME = "national"

function normaliseName(value?: string | null) {
  return (value ?? "").trim().toLowerCase()
}

export async function getGlobalMembershipBenefits(): Promise<CampusData | null> {
  try {
    const { db } = await createAdminClient()

    try {
      const document = await db.getRow<CampusData>("app", "campus_data", NATIONAL_CAMPUS_ID)
      return document
    } catch (error) {
      const response = await db.listRows<CampusData>("app", "campus_data")
      const document = response.rows.find((item: CampusData) => {
        return (
          item &&
          (item.$id === NATIONAL_CAMPUS_ID ||
            normaliseName(item.name) === NATIONAL_CAMPUS_NAME ||
            normaliseName(item?.name_nb) === NATIONAL_CAMPUS_NAME)
        )
      })

      return document ? document : null
    }
  } catch (error) {
    console.error("Failed to fetch global membership benefits:", error)
    return null
  }
}
