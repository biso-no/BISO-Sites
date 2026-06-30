"use server";

import { listJobs } from "../../_actions/jobs";

/**
 * Runtime context the recruitment tour needs to build its multi-page step
 * routes — currently a representative vacancy id so the tour can navigate into a
 * real workspace (`/jobs/[id]/applications`). Returns `null` when the user has
 * no accessible vacancy, in which case the workspace steps are skipped.
 */
export async function getRecruitmentTourContext(): Promise<{
  vacancyId: string | null;
}> {
  try {
    const { rows } = await listJobs({ page: 1 });
    return { vacancyId: rows[0]?.$id ?? null };
  } catch {
    return { vacancyId: null };
  }
}
