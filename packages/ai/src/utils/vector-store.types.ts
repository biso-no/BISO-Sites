export interface VectorDocument {
  content: string;
  embedding?: number[];
  id: string;
  metadata: Record<string, any>;
}

export interface SearchResult {
  content: string;
  distance: number;
  id: string;
  metadata: Record<string, any>;
  score: number;
}

export interface SearchOptions {
  filter?: Record<string, any>;
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
    metadata: Record<string, any>
  ): Promise<void>;
}
