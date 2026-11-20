/**
 * Finago REST API — Projects
 *
 * Projects are dimension elements with dimensionType=1.
 */

import { listDimensionElements } from "./departments";

export const PROJECT_DIMENSION_TYPE = 1;

/** The active Finago projects. */
export async function getProjects(): Promise<
  { projectId: string; name: string }[]
> {
  const elements = await listDimensionElements(PROJECT_DIMENSION_TYPE);
  return elements.map((element) => ({
    projectId: String(element.value),
    name: element.name,
  }));
}
