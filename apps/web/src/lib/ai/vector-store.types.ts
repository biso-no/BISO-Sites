export type VectorDocument = {
  id: string;
  content: string;
  metadata: Record<string, any>;
  embedding?: number[];
};

export type SearchResult = {
  id: string;
  content: string;
  metadata: Record<string, any>;
  score: number;
  distance: number;
};

export type SearchOptions = {
  query: string;
  k?: number;
  filter?: Record<string, any>;
  includeMetadata?: boolean;
};

export type IVectorStore = {
  initialize(): Promise<void>;
  addDocuments(documents: VectorDocument[]): Promise<void>;
  search(options: SearchOptions): Promise<SearchResult[]>;
  searchBroad?(query: string, limit: number): Promise<SearchResult[]>; // Optional method for broad search
  deleteDocuments(ids: string[]): Promise<void>;
  updateDocument(
    id: string,
    content: string,
    metadata: Record<string, any>
  ): Promise<void>;
  getCollectionStats(): Promise<{ count: number }>;
  clearCollection(): Promise<void>;
};
