import {
  createBenefitPartner,
  deleteBenefitPartner,
  endBenefitPartner,
  type PartnerInput,
  restartBenefitPartner,
  updateBenefitPartner,
} from "../../../_actions/benefit-partners";
import type { BoardPartner } from "../../../_actions/benefits";

/*
 * The partners page's server actions behind a module of its own. Component
 * tests stub this file; stubbing `_actions/benefit-partners` itself would
 * replace it for every other suite in the run, since `mock.module` is
 * process-wide.
 */

export function createPartner(
  input: PartnerInput
): Promise<{ data: BoardPartner } | { error: string }> {
  return createBenefitPartner(input);
}

export function updatePartner(
  id: string,
  input: PartnerInput
): Promise<{ data: BoardPartner } | { error: string }> {
  return updateBenefitPartner(id, input);
}

export function endPartner(
  id: string
): Promise<{ data: { hiddenDeals: number } } | { error: string }> {
  return endBenefitPartner(id);
}

export function restartPartner(
  id: string
): Promise<{ data: true } | { error: string }> {
  return restartBenefitPartner(id);
}

export function deletePartner(
  id: string
): Promise<{ data: { deletedDeals: number } } | { error: string }> {
  return deleteBenefitPartner(id);
}
