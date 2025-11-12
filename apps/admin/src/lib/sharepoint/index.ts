import 'server-only';
import { Client, ResponseType } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { z } from 'zod';

export interface SharePointConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  authority: string;
  /**
   * Optional list of SharePoint site identifiers that the app is allowed to access.
   * Each entry can be either a full site URL (e.g., https://contoso.sharepoint.com/sites/mysite)
   * or a Graph site ID (e.g., contoso.sharepoint.com,1234-...,...).
   * When provided, site listing will resolve only these sites instead of attempting to enumerate all sites.
   */
  siteIdentifiers?: string[];
}

export interface SharePointDocument {
  id: string;
  name: string;
  webUrl: string;
  siteId: string;
  siteName: string;
  driveId: string;
  folderPath: string;
  contentType: string;
  size: number;
  lastModified: string;
  createdBy: string;
  content?: string;
  metadata: Record<string, any>;
}

export interface SharePointSite {
  id: string;
  name: string;
  displayName: string;
  webUrl: string;
}

export class SharePointService {
  private msalClient: ConfidentialClientApplication;

  constructor(private config: SharePointConfig) {
    this.msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        authority: config.authority,
      },
    });
  }

  private async getAccessToken(): Promise<string> {
    const result = await this.msalClient.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default'],
    });

    if (!result?.accessToken) {
      throw new Error('Failed to acquire access token');
    }

    return result.accessToken;
  }

  private async getAuthenticatedClient(): Promise<Client> {
    const token = await this.getAccessToken();
    return Client.init({
      authProvider: (done) => {
        done(null, token);
      },
    });
  }

  async listSites(): Promise<SharePointSite[]> {
    const client = await this.getAuthenticatedClient();

    // If specific sites are configured (recommended for Sites.Selected), resolve only those
    const configured = this.config.siteIdentifiers || [];
    if (configured.length > 0) {
      const resolvedSites: SharePointSite[] = [];
      const uniqueIdentifiers = Array.from(
        new Set(
          configured
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        )
      );
      for (const identifier of uniqueIdentifiers) {
        try {
          let site: any;
          if (/^https?:\/\//i.test(identifier)) {
            site = await this.getSiteByUrl(client, identifier);
          } else {
            // Treat as site ID
            site = await client.api(`/sites/${identifier}`).get();
          }
          if (site) {
            resolvedSites.push({
              id: site.id,
              name: site.name,
              displayName: site.displayName,
              webUrl: site.webUrl,
            });
          }
        } catch (error) {
          console.error(`Failed to resolve configured site identifier: ${identifier}`, error);
        }
      }
      // De-duplicate by site ID
      const uniqueSitesMap = new Map<string, SharePointSite>(
        resolvedSites.map((s: SharePointSite) => [s.id, s])
      );
      return Array.from(uniqueSitesMap.values());
    }

    // Fallback: attempt to enumerate sites (requires Sites.Read.All). With Sites.Selected this
    // will typically return 403 or empty; handle gracefully.
    try {
      const response = await client.api('/sites').get();
      const sites: SharePointSite[] = response.value.map((site: any) => ({
        id: site.id,
        name: site.name,
        displayName: site.displayName,
        webUrl: site.webUrl,
      }));
      // De-duplicate by site ID
      const uniqueSitesMap = new Map<string, SharePointSite>(
        sites.map((s: SharePointSite) => [s.id, s])
      );
      return Array.from(uniqueSitesMap.values());
    } catch (error) {
      console.warn('Site enumeration failed. Provide SHAREPOINT_SITES to list specific sites.');
      return [];
    }
  }

  async listDocuments(
    siteId: string,
    folderPath: string = '/',
    recursive: boolean = false
  ): Promise<SharePointDocument[]> {
    const client = await this.getAuthenticatedClient();
    const documents: SharePointDocument[] = [];

    try {
      const drivesResponse = await client.api(`/sites/${siteId}/drives`).get();

      for (const drive of drivesResponse.value) {
        const items = await this.getDriveItems(client, drive.id, folderPath, recursive);
        documents.push(
          ...items.map((item) => ({
            ...item,
            siteId,
            driveId: drive.id,
          }))
        );
      }
    } catch (error) {
      console.error('Error listing documents:', error);
    }

    return documents;
  }

  private async getDriveItems(
    client: Client,
    driveId: string,
    folderPath: string,
    recursive: boolean
  ): Promise<SharePointDocument[]> {
    const documents: SharePointDocument[] = [];

    try {
      if (folderPath === '/') {
        const response = await client.api(`/drives/${driveId}/root/children`).get();
        for (const item of response.value) {
          if (item.file) {
            documents.push({
              id: item.id,
              name: item.name,
              webUrl: item.webUrl,
              siteId: '',
              siteName: '',
              driveId: '',
              folderPath,
              contentType: item.file.mimeType,
              size: item.size,
              lastModified: item.lastModifiedDateTime,
              createdBy: item.createdBy?.user?.displayName || 'Unknown',
              metadata: {
                fileName: item.name,
                fileType: item.file.mimeType,
                fileSize: item.size,
                lastModified: item.lastModifiedDateTime,
                createdBy: item.createdBy?.user?.displayName,
                webUrl: item.webUrl,
              },
            });
          } else if (item.folder && recursive) {
            const subPath = `/${item.name}`;
            const subItems = await this.getDriveItems(client, driveId, subPath, recursive);
            documents.push(...subItems);
          }
        }
      } else {
        const response = await client.api(`/drives/${driveId}/root:${folderPath}:/children`).get();

        for (const item of response.value) {
          if (item.file) {
            documents.push({
              id: item.id,
              name: item.name,
              webUrl: item.webUrl,
              siteId: '',
              siteName: '',
              driveId: '',
              folderPath,
              contentType: item.file.mimeType,
              size: item.size,
              lastModified: item.lastModifiedDateTime,
              createdBy: item.createdBy?.user?.displayName || 'Unknown',
              metadata: {
                fileName: item.name,
                fileType: item.file.mimeType,
                fileSize: item.size,
                lastModified: item.lastModifiedDateTime,
                createdBy: item.createdBy?.user?.displayName,
                webUrl: item.webUrl,
              },
            });
          } else if (item.folder && recursive) {
            const subPath = `${folderPath}/${item.name}`;
            const subItems = await this.getDriveItems(client, driveId, subPath, recursive);
            documents.push(...subItems);
          }
        }
      }
    } catch (error) {
      console.error('Error getting drive items:', error);
    }

    return documents;
  }

  async downloadDocument(driveId: string, itemId: string): Promise<ArrayBuffer> {
    const client = await this.getAuthenticatedClient();
    const data = await client
      .api(`/drives/${driveId}/items/${itemId}/content`)
      .responseType(ResponseType.ARRAYBUFFER)
      .get();

    // Normalize to ArrayBuffer regardless of environment
    if (data instanceof ArrayBuffer) return data as ArrayBuffer;
    if (Buffer.isBuffer(data)) {
      const buf: Buffer = data;
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      return ab as ArrayBuffer;
    }
    // If for any reason a stream is returned, read it fully
    if (typeof (data as any)?.pipe === 'function') {
      const stream: NodeJS.ReadableStream = data as any;
      const chunks: Buffer[] = await new Promise((resolve, reject) => {
        const acc: Buffer[] = [];
        stream.on('data', (chunk) => acc.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        stream.on('end', () => resolve(acc));
        stream.on('error', reject);
      });
      const buf = Buffer.concat(chunks);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    }

    throw new Error('Unexpected response type when downloading document content');
  }

  async getDocumentMetadata(driveId: string, itemId: string): Promise<Record<string, any>> {
    const client = await this.getAuthenticatedClient();
    const response = await client.api(`/drives/${driveId}/items/${itemId}`).get();

    return {
      fileName: response.name,
      fileType: response.file?.mimeType,
      fileSize: response.size,
      lastModified: response.lastModifiedDateTime,
      createdBy: response.createdBy?.user?.displayName,
      webUrl: response.webUrl,
      description: response.description,
      tags: response.tags,
    };
  }

  async getSiteById(siteId: string): Promise<SharePointSite> {
    const client = await this.getAuthenticatedClient();
    const site = await client.api(`/sites/${siteId}`).get();
    return {
      id: site.id,
      name: site.name,
      displayName: site.displayName,
      webUrl: site.webUrl,
    };
  }

  async getSiteDetailsRaw(siteId: string): Promise<any> {
    const client = await this.getAuthenticatedClient();
    return await client.api(`/sites/${siteId}`).get();
  }

  private async getSiteByUrl(client: Client, siteUrl: string): Promise<any> {
    const parsed = new URL(siteUrl);
    const hostname = parsed.hostname; // e.g., contoso.sharepoint.com
    // Relative path after host, without leading slash
    const relativePath = parsed.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
    const pathSegment = relativePath.length > 0 ? `:/${relativePath}` : '';
    // Graph expects /sites/{hostname}:/{site-path}
    const apiPath = `/sites/${hostname}${pathSegment}`;
    return await client.api(apiPath).get();
  }
}

// Configuration schema
export const SharePointConfigSchema = z.object({
  clientId: z.string(),
  clientSecret: z.string(),
  tenantId: z.string(),
  authority: z.string().url(),
  siteIdentifiers: z.array(z.string()).optional(),
});

// Environment variable helper
export function getSharePointConfig(): SharePointConfig {
  // Validate required environment variables first
  const tenantId = process.env.SHAREPOINT_TENANT_ID;
  const clientId = process.env.SHAREPOINT_CLIENT_ID;
  const clientSecret = process.env.SHAREPOINT_CLIENT_SECRET;
  
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      'Missing required SharePoint configuration. Please ensure SHAREPOINT_TENANT_ID, ' +
      'SHAREPOINT_CLIENT_ID, and SHAREPOINT_CLIENT_SECRET environment variables are set.'
    );
  }
  
  const rawSites = process.env.SHAREPOINT_SITES;
  let siteIdentifiers: string[] | undefined = undefined;
  if (rawSites) {
    try {
      const trimmed = rawSites.trim();
      if (trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          siteIdentifiers = parsed.map((s) => String(s)).filter(Boolean);
        }
      } else {
        siteIdentifiers = trimmed
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      }
    } catch (err) {
      console.warn('Failed to parse SHAREPOINT_SITES; expected JSON array or comma-separated list.');
    }
  }

  const config = {
    clientId,
    clientSecret,
    tenantId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    siteIdentifiers,
  };

  return SharePointConfigSchema.parse(config);
}
