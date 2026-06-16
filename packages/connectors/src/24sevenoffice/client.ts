/**
 * 24SevenOffice SOAP Client Factory
 *
 * Creates configured SOAP clients for 24SevenOffice services.
 * Uses the soap library for Node.js SOAP client functionality.
 */

import { createClientAsync, type Client as SoapClient } from "soap";

// WSDL endpoints for 24SevenOffice services
export const WSDL_URLS = {
  authenticate:
    "https://api.24sevenoffice.com/authenticate/v001/authenticate.asmx?wsdl",
  client:
    "https://api.24sevenoffice.com/Client/V001/ClientService.asmx?wsdl",
  company:
    "https://api.24sevenoffice.com/CRM/Company/V001/CompanyService.asmx?wsdl",
  invoice:
    "https://api.24sevenoffice.com/Economy/InvoiceOrder/V001/InvoiceService.asmx?wsdl",
  product:
    "https://api.24sevenoffice.com/Logistics/Product/V001/ProductService.asmx?wsdl",
} as const;

export type ServiceName = keyof typeof WSDL_URLS;

// Client cache to avoid recreating clients
const clientCache = new Map<string, SoapClient>();

/**
 * Create a SOAP client for a 24SevenOffice service
 */
export async function createSoapClient(
  serviceName: ServiceName
): Promise<SoapClient> {
  const wsdlUrl = WSDL_URLS[serviceName];
  const cacheKey = serviceName;

  // Return cached client if available
  const cached = clientCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Create new client
  const client = await createClientAsync(wsdlUrl);

  // Cache the client
  clientCache.set(cacheKey, client);

  return client;
}

/**
 * Create an authenticated SOAP client with session cookie
 */
export async function createAuthenticatedClient(
  serviceName: ServiceName,
  sessionToken: string
): Promise<SoapClient> {
  const client = await createSoapClient(serviceName);

  // Add session cookie to all requests
  client.addHttpHeader("Cookie", `ASP.NET_SessionId=${sessionToken}`);

  return client;
}

/**
 * Clear the client cache (useful for testing or token refresh)
 */
function _clearClientCache(): void {
  clientCache.clear();
}
