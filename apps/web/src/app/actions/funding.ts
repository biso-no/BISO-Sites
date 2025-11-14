"use server"

import { Query } from "@repo/api"
import { createAdminClient } from "@repo/api/server"
import type { FundingProgram, ParsedFundingProgram, FundingProgramMetadata } from "@/lib/types/funding-program"

const parseFundingMetadata = (value?: string | null): FundingProgramMetadata => {
  if (!value) return {}
  try {
    return JSON.parse(value) as FundingProgramMetadata
  } catch (error) {
    console.error("Failed to parse funding metadata", error)
    return {}
  }
}

const toParsedProgram = (program: FundingProgram): ParsedFundingProgram => ({
  ...program,
  parsedMetadata: parseFundingMetadata(program.metadata)
})

async function listFundingPrograms(status: string = "active"): Promise<ParsedFundingProgram[]> {
  try {
    const { db } = await createAdminClient()
    const queries = [Query.orderAsc("slug"), Query.limit(50)]
    if (status) {
      queries.push(Query.equal("status", status))
    }
    const response = await db.listRows<FundingProgram>("app", "funding_programs", queries)
    return response.rows.map((doc) => toParsedProgram(doc))
  } catch (error) {
    console.error("Failed to fetch funding programs", error)
    return []
  }
}

export async function getFundingProgramBySlug(slug: string): Promise<ParsedFundingProgram | null> {
  if (!slug) return null
  try {
    const { db } = await createAdminClient()
    const response = await db.listRows<FundingProgram>("app", "funding_programs", [
      Query.equal("slug", slug),
      Query.limit(1)
    ])

    if (response.total === 0 || !response.rows[0]) {
      return null
    }

    return toParsedProgram(response.rows[0])
  } catch (error) {
    console.error("Failed to fetch funding program", error)
    return null
  }
}
