import type { RecruitmentStageId } from "../view-model";

/** Bulk Archive moves candidates to the stage the UI labels "Archived". */
export const BULK_ARCHIVE_STAGE: RecruitmentStageId = "rejected";

/** Runs the bulk Archive action: it moves the selection and opens no composer. */
export function runBulkArchive(
  onMoveStage: (stage: RecruitmentStageId) => void
): void {
  onMoveStage(BULK_ARCHIVE_STAGE);
}

/**
 * Ids of the candidates whose move succeeded, in request order. These are the
 * candidates a rejection draft can be offered for.
 */
export function movedIds(
  ids: string[],
  results: PromiseSettledResult<unknown>[]
): string[] {
  return ids.filter((_, index) => results[index]?.status === "fulfilled");
}
