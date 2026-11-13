/**
 * Finago REST API — the organisation the REST token is logged in to.
 */

import { finago } from "./client";

/** The name of the organisation `TFSO_REST_ORG_ID` points at. */
export async function getOrganizationName(): Promise<string | null> {
  const { data, error } = await finago.GET("/organization/information", {
    params: { header: { Authorization: "" } },
  });
  if (error || !data) {
    throw new Error(
      `[Finago] Could not read organization information: ${JSON.stringify(error)}`
    );
  }
  return data.name ?? null;
}
