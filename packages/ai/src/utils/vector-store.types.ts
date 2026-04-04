export interface VectorDocument {
  content: string;
  embedding?: number[];
  id: string;
  metadata: Record<string, unknown>;
}

export interface SearchResult {
  content: string;
  distance: number;
  id: string;
  metadata: Record<string, unknown>;
  score: number;
}

export interface SearchOptions {
  filter?: Record<string, unknown>;
  includeMetadata?: boolean;
  k?: number;
  query: string;
}

export interface IVectorStore {
  addDocuments(documents: VectorDocument[]): Promise<void>;
  clearCollection(): Promise<void>;
  deleteDocuments(ids: string[]): Promise<void>;
  getCollectionStats(): Promise<{ count: number }>;
  initialize(): Promise<void>;
  search(options: SearchOptions): Promise<SearchResult[]>;
  searchBroad?(query: string, limit: number): Promise<SearchResult[]>; // Optional method for broad search
  updateDocument(
    id: string,
    content: string,
    metadata: Record<string, unknown>
  ): Promise<void>;
}
