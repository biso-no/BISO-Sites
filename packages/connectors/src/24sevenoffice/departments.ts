/**
 * 24SevenOffice ClientService — Departments (SOAP)
 *
 * The Finago REST API only returns ACTIVE departments. The SOAP
 * ClientService.GetDepartmentList returns ALL departments registered on the
 * client, regardless of whether they're marked active (a documented quirk of
 * the SOAP API). Diffing the two lets us detect which departments are inactive.
 */

import { getValidSession } from "./auth";
import { createAuthenticatedClient } from "./client";

export interface SoapDepartment {
  id: string;
  name: string;
}

interface SoapDepartmentNode {
  Id?: string | number;
  Name?: string;
}

interface GetDepartmentListResult {
  GetDepartmentListResult?: {
    Department?: SoapDepartmentNode | SoapDepartmentNode[];
  };
}

/**
 * All departments registered on the client, active or not.
 */
export async function getAllDepartmentsSoap(): Promise<SoapDepartment[]> {
  const session = await getValidSession();
  const client = await createAuthenticatedClient("client", session);

  const [result]: [GetDepartmentListResult] =
    await client.GetDepartmentListAsync({});

  const departments = result.GetDepartmentListResult?.Department;
  if (!departments) {
    return [];
  }

  const list = Array.isArray(departments) ? departments : [departments];
  return list
    .filter((node) => node.Id !== undefined && node.Id !== null)
    .map((node) => ({
      id: String(node.Id),
      name: (node.Name ?? "").trim(),
    }));
}
