import { reorderBenefits } from "../../_actions/benefits";

/**
 * The board's server action behind a module of its own. Component tests stub
 * this file; stubbing `_actions/benefits` itself would replace it for every
 * other suite in the run, since `mock.module` is process-wide.
 */
export function saveBenefitOrder(
  campusId: string,
  section: string,
  orderedIds: string[]
): Promise<{ data: true } | { error: string }> {
  return reorderBenefits(campusId, section, orderedIds);
}
