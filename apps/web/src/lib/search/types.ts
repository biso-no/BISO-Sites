export type SearchIndex =
  | "jobs"
  | "events"
  | "news"
  | "units";

export type SearchResult = {
  id: string;
  index: SearchIndex;
  name?: string;
  title?: string;
  type?: string;
  description?: string;
  date?: string;
  company?: string;
  department?: string;
  year?: string;
  location?: string;
  href?: string;
  [key: string]: unknown;
};

export type SearchOptions = {
  query: string;
  indices?: SearchIndex[];
  limit?: number;
  offset?: number;
};

export type SearchApiResponse = {
  results: SearchResult[];
  error?: string;
};
