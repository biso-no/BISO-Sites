import 'server-only';
import { SharePointService, SharePointDocument } from '@/lib/sharepoint';
import { DocumentProcessor, ProcessedDocument } from './document-processor';
import { isSupportedContentType } from './content-types';
import { correctMimeType } from './mime-utils';
import { VectorDocument } from './vector-store.types';
import { getDocumentViewerUrl } from './document-utils';
import { documentClassifier, DocumentClassification } from './document-classifier';

export interface IndexingJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  siteId: string;
  siteName: string;
  folderPath: string;
  recursive: boolean;
  totalDocuments: number;
  processedDocuments: number;
  failedDocuments: number;
  skippedDocuments: number; // New: track skipped docs
  startTime: Date;
  endTime?: Date;
  error?: string;
  processingDetails: {
    chunksCreated: number;
    avgChunksPerDocument: number;
    tokenCounts: {
      total: number;
      average: number;
      min: number;
      max: number;
    };
  };
}

export interface IndexingOptions {
  siteId: string;
  folderPath?: string;
  recursive?: boolean;
  batchSize?: number;
  maxConcurrency?: number;
  validateChunks?: boolean; // New: enable chunk validation
}

export interface ProcessedDocumentResult {
  documentId: string;
  chunks: VectorDocument[];
  chunksCreated: number;
  tokensProcessed: number;
  processingTimeMs: number;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

export class IndexingService {
  private sharePointService: SharePointService;
  private documentProcessor: DocumentProcessor;
  private vectorStore: import('./vector-store.types').IVectorStore;
  private jobs: Map<string, IndexingJob> = new Map();

  constructor(
    sharePointService: SharePointService, 
    vectorStore: import('./vector-store.types').IVectorStore
  ) {
    this.sharePointService = sharePointService;
    this.documentProcessor = new DocumentProcessor();
    this.vectorStore = vectorStore;
  }

  async startIndexing(options: IndexingOptions): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: IndexingJob = {
      id: jobId,
      status: 'pending',
      siteId: options.siteId,
      siteName: 'Unknown',
      folderPath: options.folderPath || '/',
      recursive: options.recursive || false,
      totalDocuments: 0,
      processedDocuments: 0,
      failedDocuments: 0,
      skippedDocuments: 0,
      startTime: new Date(),
      processingDetails: {
        chunksCreated: 0,
        avgChunksPerDocument: 0,
        tokenCounts: {
          total: 0,
          average: 0,
          min: Number.MAX_SAFE_INTEGER,
          max: 0,
        },
      },
    };

    this.jobs.set(jobId, job);

    // Start processing in background
    this.processIndexingJob(jobId, options).catch(error => {
      console.error('❌ Indexing job failed:', error);
      const job = this.jobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : 'Unknown error';
        job.endTime = new Date();
      }
    });

    return jobId;
  }

  private async processIndexingJob(jobId: string, options: IndexingOptions): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('Job not found');

    console.log(`🚀 Starting indexing job ${jobId}`);

    try {
      job.status = 'processing';

      // Get site information
      const sites = await this.sharePointService.listSites();
      let site = sites.find(s => s.id === options.siteId);
      if (!site) {
        try {
          site = await this.sharePointService.getSiteById(options.siteId);
        } catch {}
      }
      if (site) {
        job.siteName = site.displayName;
      }

      // List documents from SharePoint
      const allDocuments = await this.sharePointService.listDocuments(
        options.siteId,
        options.folderPath || '/',
        options.recursive || false
      );

      console.log(`📂 Found ${allDocuments.length} total documents`);

      // Enhanced document filtering
      const { supportedDocuments, filteredDocuments } = this.filterAndValidateDocuments(allDocuments);
      
      console.log(`✅ ${supportedDocuments.length} supported documents`);
      console.log(`❌ ${allDocuments.length - supportedDocuments.length} unsupported/filtered documents`);

      // Apply intelligent document prioritization
      const prioritizedDocuments = this.prioritizeDocuments(supportedDocuments);
      
      job.totalDocuments = prioritizedDocuments.length;
      console.log(`🎯 Processing ${prioritizedDocuments.length} prioritized documents`);

      // Process documents in batches with enhanced monitoring
      const batchSize = options.batchSize || 5; // Reduced for better quality control
      const maxConcurrency = options.maxConcurrency || 2; // Reduced to avoid overwhelming services

      const processingResults: ProcessedDocumentResult[] = [];

      for (let i = 0; i < prioritizedDocuments.length; i += batchSize) {
        const batch = prioritizedDocuments.slice(i, i + batchSize);
        console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(prioritizedDocuments.length / batchSize)}`);
        
        // Process batch with concurrency limit
        const promises = batch.map(doc => this.processDocumentWithValidation(doc, jobId, options));
        const results = await Promise.allSettled(promises);
        
        // Collect and analyze results
        for (const result of results) {
          if (result.status === 'fulfilled') {
            const docResult = result.value;
            processingResults.push(docResult);
            
            if (docResult.skipped) {
              job.skippedDocuments++;
              console.log(`⏭️ Skipped: ${docResult.skipReason}`);
            } else if (docResult.error) {
              job.failedDocuments++;
              console.error(`❌ Failed: ${docResult.error}`);
            } else {
              job.processedDocuments++;
              
              // Update processing statistics
              job.processingDetails.chunksCreated += docResult.chunksCreated;
              job.processingDetails.tokenCounts.total += docResult.tokensProcessed;
              job.processingDetails.tokenCounts.min = Math.min(
                job.processingDetails.tokenCounts.min,
                docResult.tokensProcessed
              );
              job.processingDetails.tokenCounts.max = Math.max(
                job.processingDetails.tokenCounts.max,
                docResult.tokensProcessed
              );
              
              console.log(`✅ Processed: ${docResult.chunksCreated} chunks, ${docResult.tokensProcessed} tokens, ${docResult.processingTimeMs}ms`);
            }
          } else {
            job.failedDocuments++;
            console.error('❌ Document processing failed:', result.reason);
          }
        }

        // Calculate running averages
        if (job.processedDocuments > 0) {
          job.processingDetails.avgChunksPerDocument = 
            job.processingDetails.chunksCreated / job.processedDocuments;
          job.processingDetails.tokenCounts.average = 
            job.processingDetails.tokenCounts.total / job.processedDocuments;
        }

        // Progress update
        const totalProcessed = job.processedDocuments + job.failedDocuments + job.skippedDocuments;
        const progressPercent = ((totalProcessed / job.totalDocuments) * 100).toFixed(1);
        console.log(`📊 Progress: ${progressPercent}% (${totalProcessed}/${job.totalDocuments})`);

        // Add delay between batches to avoid overwhelming services
        if (i + batchSize < prioritizedDocuments.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Final statistics calculation
      if (job.processingDetails.tokenCounts.min === Number.MAX_SAFE_INTEGER) {
        job.processingDetails.tokenCounts.min = 0;
      }

      job.status = 'completed';
      job.endTime = new Date();
      
      const duration = (job.endTime.getTime() - job.startTime.getTime()) / 1000;
      console.log(`🎉 Indexing job ${jobId} completed in ${duration.toFixed(1)}s`);
      console.log(`📊 Final stats: ${job.processedDocuments} processed, ${job.failedDocuments} failed, ${job.skippedDocuments} skipped`);
      console.log(`📦 Chunks created: ${job.processingDetails.chunksCreated} (avg: ${job.processingDetails.avgChunksPerDocument.toFixed(1)} per doc)`);

    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.endTime = new Date();
      console.error(`❌ Job ${jobId} failed:`, error);
      throw error;
    }
  }

  private filterAndValidateDocuments(documents: SharePointDocument[]): {
    supportedDocuments: SharePointDocument[];
    filteredDocuments: SharePointDocument[];
  } {
    const supportedDocuments: SharePointDocument[] = [];
    const filteredDocuments: SharePointDocument[] = [];

    for (const doc of documents) {
      // Size validation (skip very large files that might cause issues)
      if (doc.size > 50 * 1024 * 1024) { // 50MB limit
        console.log(`⚠️ Skipping large file: ${doc.name} (${(doc.size / 1024 / 1024).toFixed(1)}MB)`);
        filteredDocuments.push(doc);
        continue;
      }

      // Content type validation
      const correctedType = correctMimeType(doc.contentType, doc.name);
      if (!isSupportedContentType(correctedType, doc.name)) {
        console.log(`⚠️ Skipping unsupported file: ${doc.name} (${correctedType})`);
        filteredDocuments.push(doc);
        continue;
      }

      // File name validation (skip temporary/system files)
      if (this.isSystemOrTempFile(doc.name)) {
        console.log(`⚠️ Skipping system/temp file: ${doc.name}`);
        filteredDocuments.push(doc);
        continue;
      }

      supportedDocuments.push(doc);
    }

    return { supportedDocuments, filteredDocuments };
  }

  private isSystemOrTempFile(fileName: string): boolean {
    const systemPatterns = [
      /^~\$/, // Word temp files
      /^\./, // Hidden files
      /thumbs\.db$/i,
      /desktop\.ini$/i,
      /\.tmp$/i,
      /\.temp$/i,
      /^_vti_/, // SharePoint system folders
    ];

    return systemPatterns.some(pattern => pattern.test(fileName));
  }

  private prioritizeDocuments(documents: SharePointDocument[]): SharePointDocument[] {
    // Group documents by base name to find versions
    const documentGroups = new Map<string, SharePointDocument[]>();
    
    documents.forEach(doc => {
      const baseName = this.getDocumentBaseName(doc.name);
      const key = `${baseName}_${doc.folderPath}`.toLowerCase();
      
      if (!documentGroups.has(key)) {
        documentGroups.set(key, []);
      }
      documentGroups.get(key)!.push(doc);
    });

    const prioritizedDocuments: SharePointDocument[] = [];

    // For each group, select the most authoritative document(s)
    for (const [groupKey, groupDocs] of Array.from(documentGroups.entries())) {
      if (groupDocs.length === 1) {
        prioritizedDocuments.push(groupDocs[0]);
      } else {
        // Multiple documents - apply prioritization
        const classified = groupDocs.map(doc => ({
          doc,
          classification: documentClassifier.classifyDocument(
            doc.name, 
            doc.folderPath || '/'
          )
        }));

        // Sort by authority
        classified.sort((a, b) => 
          documentClassifier.compareAuthority(a.classification, b.classification)
        );

        // Include the most authoritative
        prioritizedDocuments.push(classified[0].doc);

        // Also include English version if Norwegian is primary
        if (classified[0].classification.language === 'norwegian') {
          const englishVersion = classified.find(c => 
            c.classification.language === 'english' && c.classification.authority.isTranslation
          );
          if (englishVersion) {
            prioritizedDocuments.push(englishVersion.doc);
          }
        }
        
        if (groupDocs.length > 2) {
          console.log(`📋 Group ${groupKey}: Selected ${classified[0].doc.name} from ${groupDocs.length} versions`);
        }
      }
    }

    return prioritizedDocuments;
  }

  private getDocumentBaseName(fileName: string): string {
    return fileName
      .replace(/\s*v\d+(\.\d+)*(\.\d+)*/gi, '') // Remove version patterns
      .replace(/\s*(nor|norsk|eng|english)\s*/gi, '') // Remove language indicators
      .replace(/\s*\([^)]*\)\s*/g, '') // Remove parenthetical content
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async processDocumentWithValidation(
    document: SharePointDocument, 
    jobId: string,
    options: IndexingOptions
  ): Promise<ProcessedDocumentResult> {
    const startTime = Date.now();
    
    try {
      // Enhanced content type detection
      const correctedContentType = correctMimeType(document.contentType, document.name);
      
      // Final validation at processing time
      if (!isSupportedContentType(correctedContentType, document.name)) {
        return {
          documentId: document.id,
          chunks: [],
          chunksCreated: 0,
          tokensProcessed: 0,
          processingTimeMs: Date.now() - startTime,
          skipped: true,
          skipReason: `Unsupported content type: ${correctedContentType}`,
        };
      }

      // Download document content
      const buffer = await this.sharePointService.downloadDocument(document.driveId, document.id);
      
      // Process document with enhanced error handling
      const processed = await this.documentProcessor.processDocument(
        buffer,
        correctedContentType,
        {
          ...document.metadata,
          originalContentType: document.contentType,
          correctedContentType,
        }
      );

      // Validate processing results
      const validationResult = this.validateProcessedDocument(processed, document.name);
      if (!validationResult.isValid) {
        return {
          documentId: document.id,
          chunks: [],
          chunksCreated: 0,
          tokensProcessed: 0,
          processingTimeMs: Date.now() - startTime,
          error: validationResult.error,
        };
      }

      // Document classification for enhanced metadata
      const classification = documentClassifier.classifyDocument(
        document.name,
        document.folderPath || '/',
        processed.content.substring(0, 5000)
      );

      // Generate document viewer URL
      const documentViewerUrl = getDocumentViewerUrl({ 
        fileName: document.name,
        baseUrl: process.env.NEXT_PUBLIC_BASE_URL 
      });

      // Prepare vector documents with enhanced metadata
      const vectorDocuments: VectorDocument[] = processed.chunks.map(chunk => ({
        id: `${document.id}_chunk_${chunk.chunkIndex}`,
        content: chunk.content,
        metadata: {
          ...chunk.metadata,
          // Core document metadata
          documentId: document.id,
          documentName: document.name,
          fileName: document.name,
          siteId: document.siteId,
          siteName: document.siteName,
          driveId: document.driveId,
          webUrl: document.webUrl,
          documentViewerUrl,
          contentType: correctedContentType,
          originalContentType: document.contentType,
          fileSize: document.size,
          lastModified: document.lastModified,
          createdBy: document.createdBy,
          jobId,
          
          // Enhanced metadata from classification
          documentLanguage: classification.language,
          documentVersion: classification.version.version,
          versionMajor: classification.version.major,
          versionMinor: classification.version.minor,
          isAuthoritative: classification.authority.isAuthoritative,
          isLatest: classification.authority.isLatest,
          isTranslation: classification.authority.isTranslation,
          authorityPriority: classification.authority.priority,
          documentCategory: classification.path.category,
          isInLanguageFolder: classification.path.isInLanguageFolder,
          languageFolder: classification.path.languageFolder,
          
          // Processing metadata
          processingTimestamp: new Date().toISOString(),
          processingTimeMs: Date.now() - startTime,
        },
      }));

      // Add to vector store
      await this.vectorStore.addDocuments(vectorDocuments);

      const tokensProcessed = processed.chunks.reduce(
        (sum, chunk) => sum + (chunk.metadata.tokenCount || 0), 
        0
      );

      return {
        documentId: document.id,
        chunks: vectorDocuments,
        chunksCreated: processed.chunks.length,
        tokensProcessed,
        processingTimeMs: Date.now() - startTime,
      };

    } catch (error) {
      console.error(`❌ Failed to process document ${document.name}:`, error);
      return {
        documentId: document.id,
        chunks: [],
        chunksCreated: 0,
        tokensProcessed: 0,
        processingTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private validateProcessedDocument(processed: ProcessedDocument, fileName: string): {
    isValid: boolean;
    error?: string;
  } {
    // Check if content is reasonable
    if (!processed.content || processed.content.length < 10) {
      return {
        isValid: false,
        error: 'Document content too short or empty after processing'
      };
    }

    // Check chunk count sanity
    if (processed.chunks.length === 0) {
      return {
        isValid: false,
        error: 'No chunks created from document'
      };
    }

    if (processed.chunks.length > 500) {
      return {
        isValid: false,
        error: `Excessive chunks created: ${processed.chunks.length} (suggests processing error)`
      };
    }

    // Check for reasonable chunk content
    const emptyChunks = processed.chunks.filter(chunk => !chunk.content || chunk.content.trim().length < 10);
    if (emptyChunks.length > processed.chunks.length * 0.5) {
      return {
        isValid: false,
        error: `Too many empty or very short chunks: ${emptyChunks.length}/${processed.chunks.length}`
      };
    }

    // Check for duplicate content (suggests processing loop)
    const uniqueContents = new Set(processed.chunks.map(chunk => chunk.content.substring(0, 100)));
    if (uniqueContents.size < processed.chunks.length * 0.5) {
      return {
        isValid: false,
        error: 'High duplication in chunks suggests processing error'
      };
    }

    return { isValid: true };
  }

  // Keep existing methods but add enhanced error handling and logging
  async getJobStatus(jobId: string): Promise<IndexingJob | null> {
    return this.jobs.get(jobId) || null;
  }

  async listJobs(): Promise<IndexingJob[]> {
    return Array.from(this.jobs.values()).sort((a, b) => 
      b.startTime.getTime() - a.startTime.getTime()
    );
  }

  // Enhanced search with better error handling
  async searchDocuments(query: string, options: {
    k?: number;
    filter?: Record<string, any>;
    includeMetadata?: boolean;
  } = {}): Promise<any[]> {
    const k = options.k || 5;

    try {
      // Detect query context
      const queryLanguage = documentClassifier.detectQueryLanguage(query);
      const qLower = query.toLowerCase();

      // Enhanced context detection
      const isStatutes = /(vedtekt|vedtektene|statute|statutes)/i.test(query);
      const isLocalLaws = /(lokal(e)?\s+lov(er)?|local\s+law(s)?)/i.test(query);
      const detectedCategory = isStatutes ? 'statutes' : (isLocalLaws ? 'local-laws' : undefined);

      // Campus detection
      const campusCandidates = ['oslo', 'bergen', 'trondheim', 'stavanger', 'drammen', 'kristiansand', 'ålesund', 'alesund', 'bodø', 'bodoe'];
      const detectedCampus = campusCandidates.find(c => qLower.includes(c));

      // Enhanced filters for quality
      const finalFilter: Record<string, any> = {
        ...(options.filter || {}),
        isLatest: true,
        isAuthoritative: true,
      };
      if (detectedCategory) {
        finalFilter.documentCategory = detectedCategory;
      }

      // Enhanced query augmentation
      const categoryTerm = detectedCategory === 'statutes'
        ? (queryLanguage === 'norwegian' ? 'vedtekter' : 'statutes')
        : detectedCategory === 'local-laws'
          ? (queryLanguage === 'norwegian' ? 'lokale lover' : 'local laws')
          : '';
      const campusTerm = detectedCampus ? detectedCampus : '';
      const augmentedQuery = [query, 'BISO', categoryTerm, campusTerm].filter(Boolean).join(' ').trim();

      // Pattern detection for specific references
      const patterns = {
        paragraph: /§\s*(\d+(?:\.\d+)*)/g,
        section: /(?:paragraf|paragraph|avsnitt|section)\s*(\d+(?:\.\d+)*)/gi,
        article: /(?:artikkel|article)\s*(\d+(?:\.\d+)*)/gi,
      };

      let hasSpecificPattern = false;
      let keywordResults: any[] = [];
      
      // Enhanced pattern matching
      for (const [patternType, regex] of Object.entries(patterns)) {
        const matches = Array.from(query.matchAll(regex));
        if (matches.length > 0) {
          hasSpecificPattern = true;
          console.log(`🎯 Detected ${patternType} pattern:`, matches.map(m => m[0]));
          
          for (const match of matches) {
            const keywordQuery = match[0];
            const numberOnly = match[1];
            
            const keywordSearchResults = await this.searchByKeyword(keywordQuery, numberOnly, k * 2, {
              category: detectedCategory,
              campus: detectedCampus,
              language: queryLanguage,
            });
            keywordResults.push(...keywordSearchResults);
          }
          break;
        }
      }

      // Semantic search
      const semanticResults = await this.vectorStore.search({
        query: augmentedQuery,
        k: hasSpecificPattern ? k * 2 : k,
        filter: finalFilter,
        includeMetadata: options.includeMetadata !== false,
      });

      let combinedResults;
      
      if (hasSpecificPattern && keywordResults.length > 0) {
        // Hybrid search combination
        const resultMap = new Map();
        
        // Add keyword results first (higher priority)
        keywordResults.forEach(result => {
          if (!resultMap.has(result.id)) {
            resultMap.set(result.id, { ...result, searchType: 'keyword', originalScore: result.score });
          }
        });
        
        // Add semantic results with score boosting for hybrid matches
        semanticResults.forEach(result => {
          const id = result.id;
          if (resultMap.has(id)) {
            const existing = resultMap.get(id);
            existing.score = Math.min(1.0, (existing.originalScore || 0) + result.score * 0.3);
            existing.searchType = 'hybrid';
          } else {
            resultMap.set(id, { ...result, searchType: 'semantic', originalScore: result.score });
          }
        });
        
        combinedResults = Array.from(resultMap.values())
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .slice(0, k);
          
        console.log(`🔍 Hybrid search: ${keywordResults.length} keyword + ${semanticResults.length} semantic = ${combinedResults.length} combined`);
      } else {
        combinedResults = semanticResults.slice(0, k);
      }

      // Enhanced reranking
      const rerankedResults = this.rerankResults(combinedResults, augmentedQuery);

      return rerankedResults.map(result => ({
        ...result,
        source: result.metadata.documentViewerUrl || result.metadata.webUrl,
        title: result.metadata.documentName,
        site: result.metadata.siteName,
        lastModified: result.metadata.lastModified,
        documentViewerUrl: result.metadata.documentViewerUrl,
        webUrl: result.metadata.webUrl,
        // Add debugging info
        searchType: result.searchType || 'semantic',
        processingTime: result.metadata.processingTimeMs,
      }));

    } catch (error) {
      console.error('❌ Search failed:', error);
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Keep existing search methods with enhanced error handling
  private async searchByKeyword(
    keywordQuery: string,
    numberOnly: string,
    limit: number,
    context?: { category?: string; campus?: string; language?: 'norwegian' | 'english' | 'mixed' }
  ): Promise<any[]> {
    try {
      const categoryTerm = context?.category === 'statutes'
        ? (context?.language === 'norwegian' ? 'vedtekter' : 'statutes')
        : context?.category === 'local-laws'
          ? (context?.language === 'norwegian' ? 'lokale lover' : 'local laws')
          : '';
      const campusTerm = context?.campus ? context.campus : '';
      const broadQueryString = [`paragraph ${numberOnly} section ${keywordQuery}`, 'BISO', categoryTerm, campusTerm]
        .filter(Boolean)
        .join(' ');

      const broadResults = this.vectorStore.searchBroad
        ? await this.vectorStore.searchBroad(broadQueryString, limit * 5)
        : await this.vectorStore.search({
            query: broadQueryString,
            k: limit * 3,
            includeMetadata: true,
          });

      // Enhanced filtering with validation
      const keywordMatches = broadResults.filter(result => {
        const text = result.content.toLowerCase();
        const metadata = result.metadata || {};
        
        // Metadata validation
        if (metadata.isLatest === false || metadata.isAuthoritative === false) {
          return false;
        }
        if (context?.category && metadata.documentCategory && metadata.documentCategory !== context.category) {
          return false;
        }

        // Enhanced text matching
        const searchTerms = [
          keywordQuery.toLowerCase(),
          `§${numberOnly}`,
          `§ ${numberOnly}`,
          `paragraf ${numberOnly}`,
          `paragraph ${numberOnly}`,
          `section ${numberOnly}`,
          `avsnitt ${numberOnly}`,
        ];
        
        const textMatch = searchTerms.some(term => text.includes(term));
        const metadataMatch = metadata.sectionNumber && 
          metadata.sectionNumber.toLowerCase().includes(numberOnly);
        
        return textMatch || metadataMatch;
      });

      // Enhanced sorting with quality metrics
      const sortedMatches = keywordMatches.sort((a, b) => {
        const aMetadata = a.metadata || {};
        const bMetadata = b.metadata || {};
        
        // Prioritize structured chunks
        const aStructured = aMetadata.isStructured ? 2 : 0;
        const bStructured = bMetadata.isStructured ? 2 : 0;
        if (aStructured !== bStructured) return bStructured - aStructured;
        
        // Prioritize exact matches
        const aExact = aMetadata.sectionNumber === numberOnly ? 1 : 0;
        const bExact = bMetadata.sectionNumber === numberOnly ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;
        
        // Fall back to similarity score
        return (b.score || 0) - (a.score || 0);
      });

      console.log(`🔍 Keyword search "${keywordQuery}": ${keywordMatches.length}/${broadResults.length} matches`);

      // Enhanced scoring
      return sortedMatches.map(result => {
        const metadata = result.metadata || {};
        let scoreBoost = 0.3; // Base keyword boost
        
        if (metadata.isStructured) scoreBoost += 0.2;
        if (metadata.sectionNumber === numberOnly) scoreBoost += 0.3;
        
        return {
          ...result,
          score: Math.min(1.0, (result.score || 0) + scoreBoost),
        };
      }).slice(0, limit);
      
    } catch (error) {
      console.error('❌ Keyword search failed:', error);
      return [];
    }
  }

  private rerankResults(results: any[], query: string): any[] {
    // Enhanced reranking with quality metrics
    const queryLanguage = documentClassifier.detectQueryLanguage(query);
    
    return results.sort((a, b) => {
      const aMetadata = a.metadata || {};
      const bMetadata = b.metadata || {};

      // Enhanced scoring factors
      const getQualityScore = (metadata: any, content: string) => {
        let score = 0;
        
        // Structure bonus
        if (metadata.isStructured) score += 0.2;
        
        // Language matching
        const docLang = metadata.documentLanguage || 'unknown';
        if (docLang === 'norwegian') {
          score += queryLanguage === 'norwegian' ? 0.3 : 0.25;
        } else if (docLang === 'english' && queryLanguage === 'english') {
          score += 0.2;
        }
        
        // Authority scoring
        if (metadata.isAuthoritative) score += 0.2;
        if (metadata.isLatest) score += 0.15;
        if (metadata.isTranslation) score -= 0.1;
        
        // Content length preference
        const length = content.length;
        if (length >= 500 && length <= 1500) score += 0.1;
        else if (length < 100) score -= 0.1;
        
        // Processing quality indicators
        if (metadata.tokenCount && metadata.tokenCount > 50) score += 0.05;
        
        return score;
      };

      const aQualityScore = getQualityScore(aMetadata, a.content || '');
      const bQualityScore = getQualityScore(bMetadata, b.content || '');

      const aFinalScore = (a.score || 0) + aQualityScore;
      const bFinalScore = (b.score || 0) + bQualityScore;

      // Update scores for transparency
      a.score = aFinalScore;
      b.score = bFinalScore;

      return bFinalScore - aFinalScore;
    });
  }

  async getDocumentStats(): Promise<{ 
    totalDocuments: number; 
    totalChunks: number;
    modelStats?: any;
  }> {
    const stats = await this.vectorStore.getCollectionStats();
    return {
      totalDocuments: stats.count,
      totalChunks: stats.count,
      modelStats: 'modelStats' in stats ? stats.modelStats : undefined,
    };
  }

  async clearIndex(): Promise<void> {
    await this.vectorStore.clearCollection();
    this.jobs.clear();
    console.log('🧹 Index cleared successfully');
  }

  async reindexDocument(documentId: string, siteId: string, driveId: string): Promise<void> {
    try {
      const documents = await this.sharePointService.listDocuments(siteId, '/', false);
      const document = documents.find(doc => doc.id === documentId);
      
      if (!document) {
        throw new Error('Document not found');
      }

      document.driveId = driveId;

      // Remove existing chunks
      const existingChunks = await this.vectorStore.search({
        query: '',
        filter: { documentId },
        k: 1000,
      });

      if (existingChunks.length > 0) {
        const chunkIds = existingChunks.map(chunk => chunk.id);
        await this.vectorStore.deleteDocuments(chunkIds);
      }

      // Reprocess document
      const jobId = `reindex_${Date.now()}`;
      const result = await this.processDocumentWithValidation(document, jobId, { siteId });

      if (result.error) {
        throw new Error(result.error);
      }

      console.log(`🔄 Document ${documentId} reindexed: ${result.chunksCreated} chunks`);

    } catch (error) {
      console.error(`❌ Failed to reindex document ${documentId}:`, error);
      throw error;
    }
  }
}

// Factory function remains the same
export async function createIndexingService(): Promise<IndexingService> {
  const { getSharePointConfig } = await import('@/lib/sharepoint');
  const { getVectorStore } = await import('./vector-store-factory');
  
  const config = getSharePointConfig();
  const sharePointService = new SharePointService(config);
  const vectorStore = await getVectorStore();
  
  return new IndexingService(sharePointService, vectorStore);
}
