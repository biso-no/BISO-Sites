import type { AutoTranslationOptions } from "@/lib/content-translation";
import { createBenefitPartner as createPartnerAction } from "../../_actions/benefit-partners";
import {
  type BenefitMutationResult,
  type BoardPartner,
  createBenefit as createBenefitAction,
  deleteBenefit as deleteBenefitAction,
  setBenefitStatus as setBenefitStatusAction,
  updateBenefit as updateBenefitAction,
} from "../../_actions/benefits";
import type { BenefitFormValues } from "../../_actions/schemas";

/*
 * The panel's server actions behind a module of its own. Component tests stub
 * this file; stubbing `_actions/benefits` itself would replace it for every
 * other suite in the run, since `mock.module` is process-wide.
 */

export function createBenefit(
  values: BenefitFormValues,
  autoTranslation?: AutoTranslationOptions
): Promise<BenefitMutationResult> {
  return createBenefitAction(values, autoTranslation);
}

export function updateBenefit(
  id: string,
  values: BenefitFormValues,
  autoTranslation?: AutoTranslationOptions
): Promise<BenefitMutationResult> {
  return updateBenefitAction(id, values, autoTranslation);
}

/** Changes only the status; everything else is rebuilt from the stored row. */
export function setBenefitStatus(
  id: string,
  status: "archived" | "draft" | "published"
): Promise<BenefitMutationResult> {
  return setBenefitStatusAction(id, status);
}

export function deleteBenefit(
  id: string
): Promise<{ data: string } | { error: string }> {
  return deleteBenefitAction(id);
}

export function createBenefitPartner(input: {
  campus_id: string;
  logo_url?: string | null;
  name: string;
  website_url?: string | null;
}): Promise<{ data: BoardPartner } | { error: string }> {
  return createPartnerAction(input);
}
