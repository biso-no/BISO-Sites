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

/**
 * Get multiple companies by their IDs.
 * Since the API doesn't support batch lookup well via CompanyIds,
 * we'll fetch companies one by one but run them in parallel batches.
 *
 * @param companyIds - Array of company IDs to fetch
 * @returns Array of companies found
 */
export async function getCompaniesByIds(companyIds: number[]): Promise<Company[]> {
  if (companyIds.length === 0) {
    return [];
  }

  const session = await getValidSession();

  // Process in smaller parallel batches to avoid 429 Too Many Requests
  const PARALLEL_BATCH_SIZE = 5;
  const allCompanies: Company[] = [];

  for (let i = 0; i < companyIds.length; i += PARALLEL_BATCH_SIZE) {
    const batch = companyIds.slice(i, i + PARALLEL_BATCH_SIZE);

    // Fetch each company in the batch in parallel
    const batchResults = await Promise.all(
      batch.map(async (id) => {
        try {
          const companies = await getCompanies(session, { CompanyId: id });
          return companies[0] || null;
        } catch {
          return null;
        }
      })
    );

    // Add non-null results
    for (const company of batchResults) {
      if (company) {
        allCompanies.push(company);
      }
    }

    // Add a small delay between batches to be nice to the API
    if (i + PARALLEL_BATCH_SIZE < companyIds.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log(`[24SO Company] Fetched ${allCompanies.length} companies by IDs`);
  return allCompanies;
}



/**
 * Search for a customer by student ID.
 * Searches both CompanyId and ExternalId fields since BI operates with
 * multiple ID types (student ID and another ID).
 *
 * @param studentId - Raw student ID (e.g., "s1234567" or "1234567")
 * @returns The customer if found, null otherwise
 */
export async function searchCustomerByStudentId(
  studentId: string
): Promise<Company | null> {
  // Sanitize student ID - remove non-numeric characters
  const sanitizedId = studentId.replace(/[^0-9]/g, "");
  if (!sanitizedId) {
    return null;
  }

  const session = await getValidSession();

  // Search by ExternalId first (most common for students)
  const byExternalId = await getCompanies(session, { ExternalId: sanitizedId });
  if (byExternalId.length > 0) {
    console.log(
      `[24SO Company] Found customer by ExternalId ${sanitizedId}: ${byExternalId[0].Name}`
    );
    return byExternalId[0];
  }

  // Also search by CompanyId (numeric ID) as fallback
  const numericId = parseInt(sanitizedId, 10);
  if (!isNaN(numericId)) {
    const byCompanyId = await getCompanies(session, { CompanyId: numericId });
    if (byCompanyId.length > 0) {
      console.log(
        `[24SO Company] Found customer by CompanyId ${numericId}: ${byCompanyId[0].Name}`
      );
      return byCompanyId[0];
    }
  }

  console.log(`[24SO Company] No customer found for ID ${sanitizedId}`);
  return null;
}


/**
 * Create a student customer in 24SevenOffice with standard naming format.
 *
 * Format: "(Student) LastName, FirstName"
 * ExternalId: Sanitized student ID (only numbers)
 *
 * @param studentId - Raw student ID (e.g., "s1234567")
 * @param firstName - Student's first name
 * @param lastName - Student's last name
 * @returns The created customer
 */
export async function createStudentCustomer(
  studentId: string,
  firstName: string,
  lastName: string
): Promise<Company> {
  const session = await getValidSession();
  const client = await createAuthenticatedClient("company", session);

  // Sanitize student ID
  const sanitizedId = studentId.replace(/[^0-9]/g, "");
  if (!sanitizedId) {
    throw new Error("Invalid student ID - no numeric characters found");
  }

  // Standard student naming format
  const name = `(Student) ${lastName}, ${firstName}`;

  const newCompany: Company = {
    Name: name,
    FirstName: firstName,
    ExternalId: sanitizedId,
    Type: "Consumer",
    Private: true,
    Country: "NO",
    CurrencyId: "NOK",
  };

  const [result]: [SaveCompaniesResult] = await client.SaveCompaniesAsync({
    companies: {
      Company: newCompany,
    },
  });

  const saved = result.SaveCompaniesResult?.Company;
  if (!saved) {
    throw new Error("[24SO Company] Failed to create student customer - no result");
  }

  const company = Array.isArray(saved) ? saved[0] : saved;
  if (!company) {
    throw new Error("[24SO Company] Failed to create student customer - empty result");
  }

  console.log(
    `[24SO Company] Created student customer: ${company.Name} (ID: ${company.Id}, ExternalId: ${sanitizedId})`
  );

  return company;
}
