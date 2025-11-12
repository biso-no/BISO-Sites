import { IVectorStore, VectorDocument, SearchOptions, SearchResult } from './vector-store.types';
import { Pinecone, RecordMetadata, QueryResponse, ScoredPineconeRecord } from '@pinecone-database/pinecone';
import { embed, embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { v5 as uuidv5 } from 'uuid';
import { encode } from 'gpt-tokenizer';

// Embedding model configurations
const EMBEDDING_MODELS = {
  'text-embedding-3-small': {
    vectorSize: 1536,
    maxTokens: 8191,
    costPer1kTokens: 0.00002,
    description: 'Fast and cost-effective for most use cases'
  },
  'text-embedding-3-large': {
    vectorSize: 3072,
    maxTokens: 8191,
    costPer1kTokens: 0.00013,
    description: 'Higher quality embeddings for complex documents'
  }
} as const;

type EmbeddingModelName = keyof typeof EMBEDDING_MODELS;

const CONFIG = {
  EMBEDDING: {
    DEFAULT_MODEL: 'text-embedding-3-large' as EmbeddingModelName,
    MAX_TOKENS_PER_REQUEST: 7000,
    MAX_TOKENS_PER_INPUT: 2000,
    MAX_ITEMS_PER_BATCH: 100, // Pinecone supports up to 100 vectors per batch
  },
  SEARCH: {
    DEFAULT_LIMIT: 5,
    MAX_BROAD_SEARCH_LIMIT: 1000,
    MIN_SCORE_THRESHOLD: 0.1,
  },
  RETRY: {
    MAX_ATTEMPTS: 3,
    INITIAL_DELAY: 1000,
    BACKOFF_MULTIPLIER: 2,
  }
} as const;

const SHAREPOINT_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

interface BatchItem {
  doc: VectorDocument;
  text: string;
  originalIndex: number;
  tokenCount: number;
}

interface ProcessingBatch {
  indices: number[];
  texts: string[];
  tokenSum: number;
}

interface PineconeVector {
  id: string;
  values: number[];
  metadata: RecordMetadata;
}

interface ModelStats {
  model: string;
  vectorSize: number;
  estimatedCostPer1kTokens: number;
  totalTokensProcessed: number;
  estimatedCost: number;
}

export class PineconeVectorStore implements IVectorStore {
  private client: Pinecone;
  private indexName: string;
  private namespace: string;
  private embeddingModel: any;
  private modelConfig: typeof EMBEDDING_MODELS[EmbeddingModelName];
  private isInitialized = false;
  private stats: ModelStats;
  private index: any;

  constructor(
    indexName?: string,
    namespace: string = 'default',
    modelName: EmbeddingModelName = CONFIG.EMBEDDING.DEFAULT_MODEL
  ) {
    // Get index name from environment or use default
    this.indexName = indexName || process.env.PINECONE_INDEX_NAME || 'sharepoint-documents';
    this.namespace = namespace;
    this.modelConfig = EMBEDDING_MODELS[modelName];
    this.embeddingModel = openai.textEmbeddingModel(modelName);
    
    this.stats = {
      model: modelName,
      vectorSize: this.modelConfig.vectorSize,
      estimatedCostPer1kTokens: this.modelConfig.costPer1kTokens,
      totalTokensProcessed: 0,
      estimatedCost: 0,
    };
    
    // Initialize Pinecone client with API key
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      throw new Error('PINECONE_API_KEY is required');
    }
    
    this.client = new Pinecone({
      apiKey,
    });

    console.log(`🚀 PineconeVectorStore: ${modelName} (${this.modelConfig.vectorSize}D) - Index: ${this.indexName}`);
  }

  private countTokens(text: string): number {
    return encode(text).length;
  }

  private updateStats(tokenCount: number): void {
    this.stats.totalTokensProcessed += tokenCount;
    this.stats.estimatedCost = (this.stats.totalTokensProcessed / 1000) * this.stats.estimatedCostPer1kTokens;
  }

  private async withRetry<T>(operation: () => Promise<T>, context: string): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= CONFIG.RETRY.MAX_ATTEMPTS; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        console.error(`${context} - Attempt ${attempt} failed:`, error.message);
        
        if (attempt === CONFIG.RETRY.MAX_ATTEMPTS) break;
        
        const delay = CONFIG.RETRY.INITIAL_DELAY * Math.pow(CONFIG.RETRY.BACKOFF_MULTIPLIER, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    await this.withRetry(async () => {
      // List existing indexes
      const existingIndexes = await this.client.listIndexes();
      const indexExists = existingIndexes.indexes?.some(idx => idx.name === this.indexName);
      
      if (!indexExists) {
        console.log(`Creating Pinecone index: ${this.indexName}`);
        
        // Create the index with serverless spec (recommended for Vercel)
        await this.client.createIndex({
          name: this.indexName,
          dimension: this.modelConfig.vectorSize,
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: process.env.PINECONE_REGION || 'us-east-1',
            }
          }
        });
        
        // Wait for index to be ready
        console.log('Waiting for index to be ready...');
        let retries = 0;
        while (retries < 60) { // Wait up to 60 seconds
          const description = await this.client.describeIndex(this.indexName);
          if (description.status?.ready) {
            console.log(`✅ Index ${this.indexName} is ready`);
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
          retries++;
        }
      }
      
      // Get index reference
      this.index = this.client.index(this.indexName);
      
      console.log(`✅ Connected to Pinecone index: ${this.indexName}`);
    }, 'Initializing Pinecone index');
    
    this.isInitialized = true;
  }

  async addDocuments(documents: VectorDocument[]): Promise<void> {
    if (!documents.length) return;
    await this.initialize();

    // Prepare documents
    const items = documents
      .map((doc, originalIndex) => {
        const text = String(doc.content || '').trim();
        if (!text) return null;
        
        const truncated = text.length > CONFIG.EMBEDDING.MAX_TOKENS_PER_INPUT * 4 
          ? text.slice(0, CONFIG.EMBEDDING.MAX_TOKENS_PER_INPUT * 4)
          : text;
        
        return {
          doc,
          text: truncated,
          originalIndex,
          tokenCount: this.countTokens(truncated)
        };
      })
      .filter((item): item is BatchItem => item !== null);

    if (!items.length) return;

    // Create batches for embedding
    const batches: ProcessingBatch[] = [];
    let current: ProcessingBatch = { indices: [], texts: [], tokenSum: 0 };

    for (const [idx, item] of Array.from(items.entries())) {
      if (current.indices.length >= CONFIG.EMBEDDING.MAX_ITEMS_PER_BATCH ||
          current.tokenSum + item.tokenCount > CONFIG.EMBEDDING.MAX_TOKENS_PER_REQUEST) {
        if (current.indices.length > 0) {
          batches.push(current);
          current = { indices: [], texts: [], tokenSum: 0 };
        }
      }
      
      current.indices.push(idx);
      current.texts.push(item.text);
      current.tokenSum += item.tokenCount;
    }
    
    if (current.indices.length > 0) {
      batches.push(current);
    }

    // Generate embeddings
    const allEmbeddings: number[][] = new Array(items.length);
    
    for (const batch of batches) {
      const { embeddings } = await this.withRetry(
        () => embedMany({ model: this.embeddingModel, values: batch.texts }),
        'Generating embeddings'
      );
      
      embeddings.forEach((emb, i) => {
        allEmbeddings[batch.indices[i]] = emb as number[];
      });
      
      this.updateStats(batch.tokenSum);
    }

    // Create Pinecone vectors
    const vectors: PineconeVector[] = items.map((item, idx) => ({
      id: uuidv5(item.doc.id, SHAREPOINT_NAMESPACE),
      values: allEmbeddings[idx],
      metadata: {
        ...item.doc.metadata,
        text: item.text,
        originalId: item.doc.id,
        tokenCount: item.tokenCount,
        processingTime: new Date().toISOString(),
      },
    }));

    // Upsert vectors in batches (Pinecone recommends batches of 100)
    const BATCH_SIZE = 100;
    for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
      const batch = vectors.slice(i, i + BATCH_SIZE);
      await this.withRetry(
        () => this.index.namespace(this.namespace).upsert(batch),
        `Upserting batch ${i / BATCH_SIZE + 1}`
      );
    }

    console.log(`✅ Indexed ${vectors.length} documents to Pinecone`);
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    await this.initialize();
    const { query, k = CONFIG.SEARCH.DEFAULT_LIMIT, filter, includeMetadata = true } = options;
    
    // For metadata-only search (no query)
    if (!query && filter) {
      // Pinecone doesn't support metadata-only queries without a vector
      // We need to provide a zero vector or random vector for this case
      const zeroVector = new Array(this.modelConfig.vectorSize).fill(0);
      
      const results = await this.withRetry(
        () => this.index.namespace(this.namespace).query({
          vector: zeroVector,
          topK: k,
          includeMetadata,
          filter,
        }),
        'Performing metadata-only search'
      ) as QueryResponse;
      
      return results.matches?.map((match) => ({
        id: String(match.metadata?.originalId || match.id),
        content: String(match.metadata?.text || ''),
        metadata: includeMetadata ? (match.metadata || {}) : {},
        score: match.score || 0,
        distance: 1 - (match.score || 0),
      })) || [];
    }

    if (!query) throw new Error('Query required for semantic search');

    const queryTokens = this.countTokens(query);
    this.updateStats(queryTokens);

    const { embedding: vector } = await this.withRetry(
      () => embed({ model: this.embeddingModel, value: query }),
      'Generating query embedding'
    );

    const queryRequest: any = {
      vector,
      topK: k,
      includeMetadata,
    };

    if (filter) {
      queryRequest.filter = filter;
    }

    const results = await this.withRetry(
      () => this.index.namespace(this.namespace).query(queryRequest),
      'Performing search'
    ) as QueryResponse;

    return results.matches?.map((match) => ({
      id: String(match.metadata?.originalId || match.id),
      content: String(match.metadata?.text || ''),
      metadata: includeMetadata ? (match.metadata || {}) : {},
      score: match.score || 0,
      distance: 1 - (match.score || 0),
    })) || [];
  }

  async searchBroad(query: string, limit: number): Promise<SearchResult[]> {
    const cappedLimit = Math.min(limit, CONFIG.SEARCH.MAX_BROAD_SEARCH_LIMIT);
    const queryTokens = this.countTokens(query);
    this.updateStats(queryTokens);
    
    const { embedding: vector } = await this.withRetry(
      () => embed({ model: this.embeddingModel, value: query }),
      'Generating query embedding'
    );

    const results = await this.withRetry(
      () => this.index.namespace(this.namespace).query({
        vector,
        topK: cappedLimit,
        includeMetadata: true,
      }),
      'Performing broad search'
    ) as QueryResponse;

    return results.matches?.map((match) => ({
      id: String(match.metadata?.originalId || match.id),
      content: String(match.metadata?.text || ''),
      metadata: match.metadata || {},
      score: match.score || 0,
      distance: 1 - (match.score || 0),
    })).filter((result) => result.score >= CONFIG.SEARCH.MIN_SCORE_THRESHOLD) || [];
  }

  async deleteDocuments(ids: string[]): Promise<void> {
    if (!ids.length) return;
    await this.initialize();
    
    const convertedIds = ids.map(id => uuidv5(id, SHAREPOINT_NAMESPACE));
    
    await this.withRetry(
      () => this.index.namespace(this.namespace).deleteMany(convertedIds),
      'Deleting documents'
    );
    
    console.log(`🗑️ Deleted ${ids.length} documents from Pinecone`);
  }

  async updateDocument(id: string, content: string, metadata: Record<string, any>): Promise<void> {
    await this.initialize();
    
    const pointId = uuidv5(id, SHAREPOINT_NAMESPACE);
    const tokenCount = this.countTokens(content);
    this.updateStats(tokenCount);
    
    const { embedding } = await this.withRetry(
      () => embed({ model: this.embeddingModel, value: content }),
      'Generating embedding for update'
    );

    await this.withRetry(
      () => this.index.namespace(this.namespace).upsert([{
        id: pointId,
        values: embedding as number[],
        metadata: { 
          ...metadata, 
          text: content, 
          originalId: id, 
          tokenCount,
          processingTime: new Date().toISOString(),
        }
      }]),
      'Updating document'
    );
    
    console.log(`📝 Updated document ${id} in Pinecone`);
  }

  async getCollectionStats(): Promise<{ count: number; modelStats?: ModelStats }> {
    await this.initialize();
    
    const stats = await this.withRetry(
      () => this.index.describeIndexStats(),
      'Getting collection stats'
    ) as any;

    const namespaceStats = stats.namespaces?.[this.namespace];
    const count = namespaceStats?.recordCount || 0;

    return { 
      count,
      modelStats: { ...this.stats },
    };
  }

  async clearCollection(): Promise<void> {
    await this.initialize();
    
    // Delete all vectors in the namespace
    await this.withRetry(
      () => this.index.namespace(this.namespace).deleteAll(),
      'Clearing collection'
    );
    
    this.stats.totalTokensProcessed = 0;
    this.stats.estimatedCost = 0;
    
    console.log(`🧹 Cleared namespace: ${this.namespace} in index: ${this.indexName}`);
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const [indexInfo, stats] = await Promise.all([
        this.client.describeIndex(this.indexName),
        this.getCollectionStats(),
      ]);

      return {
        healthy: true,
        details: {
          indexName: this.indexName,
          namespace: this.namespace,
          dimension: indexInfo.dimension,
          metric: indexInfo.metric,
          status: indexInfo.status,
          documentCount: stats.count,
          modelStats: stats.modelStats,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        healthy: false,
        details: { error: String(error) },
      };
    }
  }
}