import { tool } from 'ai';
import { z } from 'zod';
// Lazy import heavy indexing service to reduce initial bundle size
import { documentClassifier } from '@/lib/ai/document-classifier';

export type RagSearchResult = {
  text: string;
  source: string;
  title: string;
  site: string;
  lastModified: string;
  score: number;
  documentViewerUrl?: string;
  webUrl?: string;
};

// Helper functions for language-aware responses
function getLanguageInfo(results: any[], queryLanguage: string) {
  const norwegianDocs = results.filter(r => r.metadata?.documentLanguage === 'norwegian').length;
  const englishDocs = results.filter(r => r.metadata?.documentLanguage === 'english').length;
  const authoritativeDocs = results.filter(r => r.metadata?.isAuthoritative).length;
  const latestVersions = results.filter(r => r.metadata?.isLatest).length;
  
  return {
    norwegianDocs,
    englishDocs,
    authoritativeDocs,
    latestVersions,
    totalResults: results.length
  };
}

function generateSearchMessage(resultCount: number, queryLanguage: string, languageInfo: any) {
  const { norwegianDocs, englishDocs, authoritativeDocs } = languageInfo;
  
  if (queryLanguage === 'norwegian') {
    let message = `Fant ${resultCount} relevante dokumenter for søket ditt.`;
    if (norwegianDocs > 0) {
      message += ` ${norwegianDocs} av disse er på norsk (autoritative).`;
    }
    if (englishDocs > 0 && norwegianDocs === 0) {
      message += ` Fant ${englishDocs} engelske oversettelser.`;
    }
    if (authoritativeDocs > 0) {
      message += ` ${authoritativeDocs} er gjeldende/autoritative dokumenter.`;
    }
    message += ' Hver resultat inkluderer en lenke for å se dokumentet.';
    return message;
  } else {
    let message = `Found ${resultCount} relevant documents for your query.`;
    if (norwegianDocs > 0) {
      message += ` ${norwegianDocs} are in Norwegian (authoritative).`;
    }
    if (englishDocs > 0) {
      message += ` ${englishDocs} are English translations.`;
    }
    if (authoritativeDocs > 0) {
      message += ` ${authoritativeDocs} are current/authoritative documents.`;
    }
    message += ' Each result includes a link to view the document publicly.';
    return message;
  }
}

export const searchSharePoint = tool({
  description: 'Search the SharePoint knowledge base and return top matching passages with citations. Supports both semantic search and exact matching for specific references like paragraph numbers (§ 6.3, paragraf 6.3, etc.)',
  inputSchema: z.object({
    query: z.string().min(1).describe('Search query to run against SharePoint index. For specific paragraph/section references, include the exact format like "§ 6.3" or "paragraf 6.3"'),
    k: z.number().int().min(1).max(15).default(5).describe('Number of results to return (max 15 for better coverage of specific searches)'),
    filter: z.record(z.string(), z.any()).optional().describe('Optional filter for search results'),
  }),
  execute: async ({ query, k, filter }: { query: string; k: number; filter?: Record<string, any> }) => {
    try {
      const { createIndexingService } = await import('@/lib/ai/indexing-service');
      const indexingService = await createIndexingService();
      
      // Detect query language for better response handling
      const queryLanguage = documentClassifier.detectQueryLanguage(query);
      
      const results = await indexingService.searchDocuments(query, {
        k,
        filter,
        includeMetadata: true,
      });

      // Transform results to match expected format with enhanced metadata
      const transformedResults: RagSearchResult[] = results.map(result => ({
        text: result.content,
        source: result.source || 'Unknown', // This will be the documentViewerUrl from indexing service
        title: result.title || 'Untitled',
        site: result.site || 'Unknown Site',
        lastModified: result.lastModified || 'Unknown',
        score: result.score,
        documentViewerUrl: result.documentViewerUrl,
      }));

      // Generate language-aware message
      const languageInfo = getLanguageInfo(results, queryLanguage);
      const message = generateSearchMessage(transformedResults.length, queryLanguage, languageInfo);

      return { 
        results: transformedResults,
        totalResults: transformedResults.length,
        query,
        queryLanguage,
        languageInfo,
        message
      };
    } catch (error) {
      console.error('Error searching SharePoint index:', error);
      return { 
        results: [],
        totalResults: 0,
        query,
        error: error instanceof Error ? error.message : 'Unknown error occurred during search'
      };
    }
  },
});

// Additional tool for getting document statistics
export const getDocumentStats = tool({
  description: 'Get statistics about the indexed SharePoint documents',
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const { createIndexingService } = await import('@/lib/ai/indexing-service');
      const indexingService = await createIndexingService();
      const stats = await indexingService.getDocumentStats();
      
      return {
        totalDocuments: stats.totalDocuments,
        totalChunks: stats.totalChunks,
        message: `Index contains ${stats.totalDocuments} documents with ${stats.totalChunks} searchable chunks.`
      };
    } catch (error) {
      console.error('Error getting document stats:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error occurred while getting statistics'
      };
    }
  },
});

// Tool for listing available SharePoint sites
export const listSharePointSites = tool({
  description: 'List available SharePoint sites that can be indexed',
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const { SharePointService, getSharePointConfig } = await import('@/lib/sharepoint');
      const sharePointService = new SharePointService(getSharePointConfig());
      const sites = await sharePointService.listSites();
      
      return {
        sites: sites.map(site => ({
          id: site.id,
          name: site.name,
          displayName: site.displayName,
          webUrl: site.webUrl,
        })),
        totalSites: sites.length,
        message: `Found ${sites.length} SharePoint sites available for indexing.`
      };
    } catch (error) {
      console.error('Error listing SharePoint sites:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error occurred while listing sites'
      };
    }
  },
});
