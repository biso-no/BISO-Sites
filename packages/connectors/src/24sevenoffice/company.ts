/**
 * 24SevenOffice Company Service
 *
 * Handles customer (company) lookup and creation in 24SevenOffice CRM.
 * Companies in 24SO represent customers - including individual consumers.
 */

import { createAuthenticatedClient } from "./client";
import { getValidSession } from "./auth";
import type {
  Company,
  CompanySearchParams,
  CustomerData,
  GetCompaniesResult,
  SaveCompaniesResult,
} from "./types";

/**
 * Find an existing customer or create a new one in 24SevenOffice
 *
 * Search order:
 * 1. ExternalId (studentId) - most reliable if available
 * 2. "FirstName LastName" - common format
 * 3. "LastName, FirstName" - formal format
 * 4. "LastName FirstName" - alternate format
 * 5. Email address - fallback
 */
export async function findOrCreateCompany(
  customer: CustomerData
): Promise<Company> {
  const session = await getValidSession();

  // Build search strategies in priority order
  const searchStrategies: (CompanySearchParams | null)[] = [
    // 1. Search by studentId (ExternalId) if available
    customer.studentId ? { ExternalId: customer.studentId } : null,
    // 2. "FirstName LastName"
    { CompanyName: `${customer.firstName} ${customer.lastName}` },
    // 3. "LastName, FirstName"
    { CompanyName: `${customer.lastName}, ${customer.firstName}` },
    // 4. "LastName FirstName"
    { CompanyName: `${customer.lastName} ${customer.firstName}` },
    // 5. Email fallback
    customer.email ? { CompanyEmail: customer.email } : null,
  ];

  // Try each search strategy
  for (const params of searchStrategies) {
    if (!params) continue;

    const companies = await getCompanies(session, params);
    if (companies.length > 0) {
      const found = companies[0];
      console.log(
        `[24SO Company] Found existing customer: ${found.Name} (ID: ${found.Id})`
      );
      return found;
    }
  }

  // No existing customer found - create new one
  console.log(
    `[24SO Company] Creating new customer: ${customer.firstName} ${customer.lastName}`
  );
  return await saveCompany(session, customer);
}

/**
 * Search for companies in 24SevenOffice
 */
async function getCompanies(
  sessionToken: string,
  searchParams: CompanySearchParams
): Promise<Company[]> {
  try {
    const client = await createAuthenticatedClient("company", sessionToken);

    const [result]: [GetCompaniesResult] = await client.GetCompaniesAsync({
      searchParams,
      returnProperties: {
        string: ["Id", "Name", "ExternalId", "FirstName", "EmailAddresses"],
      },
    });

    const companies = result.GetCompaniesResult?.Company;

    if (!companies) {
      return [];
    }

    // Handle single or multiple results
    return Array.isArray(companies) ? companies : [companies];
  } catch (error) {
    console.error("[24SO Company] Search failed:", error);
    return [];
  }
}

/**
 * Create a new company (customer) in 24SevenOffice
 */
async function saveCompany(
  sessionToken: string,
  customer: CustomerData
): Promise<Company> {
  const client = await createAuthenticatedClient("company", sessionToken);

  const newCompany: Company = {
    Name: `${customer.firstName} ${customer.lastName}`,
    FirstName: customer.firstName,
    ExternalId: customer.studentId || customer.userId,
    Type: "Consumer",
    Private: true,
    Country: "NO",
    CurrencyId: "NOK",
  };

  // Add email if provided
  if (customer.email) {
    newCompany.EmailAddresses = {
      Primary: { Value: customer.email },
    };
  }

  // Add phone if provided
  if (customer.phone) {
    newCompany.PhoneNumbers = {
      Mobile: { Value: customer.phone },
    };
  }

  const [result]: [SaveCompaniesResult] = await client.SaveCompaniesAsync({
    companies: {
      Company: newCompany,
    },
  });

  const saved = result.SaveCompaniesResult?.Company;
  if (!saved) {
    throw new Error("[24SO Company] Failed to create customer - no result");
  }

  const company = Array.isArray(saved) ? saved[0] : saved;

  if (!company) {
    throw new Error("[24SO Company] Failed to create customer - empty result");
  }

  console.log(
    `[24SO Company] Created customer: ${company.Name} (ID: ${company.Id})`
  );
  return company;
}

/**
 * Get a company by ID
 */
export async function getCompanyById(companyId: number): Promise<Company | null> {
  const session = await getValidSession();
  const companies = await getCompanies(session, { CompanyId: companyId });
  return companies[0] ?? null;
}
