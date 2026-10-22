import {
  deleteSiteLogo,
  reorderSiteLogos,
  type SiteLogo,
  saveSiteLogo,
} from "../../../_actions/site-logos";

/*
 * The logos tab's server actions behind a module of its own. Component
 * tests stub this file; stubbing `_actions/site-logos` itself would replace
 * it for every other suite in the run, since `mock.module` is process-wide.
 */

export interface LogoInput {
  campus_id: string;
  /** Left out for a new logo. */
  id?: string;
  image_url: string;
  name: string;
  url: string | null;
}

export function saveLogo(
  input: LogoInput
): Promise<{ data: SiteLogo } | { error: string }> {
  return saveSiteLogo(input);
}

export function deleteLogo(
  id: string
): Promise<{ data: true } | { error: string }> {
  return deleteSiteLogo(id);
}

export function saveLogoOrder(
  campusId: string,
  orderedIds: string[]
): Promise<{ data: true } | { error: string }> {
  return reorderSiteLogos(campusId, orderedIds);
}
