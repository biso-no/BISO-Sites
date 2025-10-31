import { useState, useEffect } from "react";
import { search, DEFAULT_SEARCH_INDICES } from "../search";
import type { SearchResult, SearchIndex } from "../search/types";

export type UseSearchOptions = {
  defaultQuery?: string;
  defaultIndices?: SearchIndex[];
  debounceTime?: number;
  limit?: number;
  minQueryLength?: number;
  autoSearch?: boolean;
};

export function useSearch(options: UseSearchOptions = {}) {
  const {
    defaultQuery = "",
    defaultIndices = DEFAULT_SEARCH_INDICES,
    debounceTime = 300,
    limit = 10,
    minQueryLength = 2,
    autoSearch = true,
  } = options;

  const [query, setQuery] = useState<string>(defaultQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [indices, setIndices] = useState<SearchIndex[]>(defaultIndices);

  // Auto search effect with debounce
  useEffect(() => {
    if (!autoSearch) return;
    
    let isMounted = true;
    const searchTimeout = setTimeout(async () => {
      if (query.length >= minQueryLength) {
        setIsSearching(true);
        try {
          const searchResults = await search({
            query,
            indices,
            limit,
          });
          
          if (isMounted) {
            setResults(searchResults);
            setError(null);
          }
        } catch (err) {
          console.error("Search error:", err);
          if (isMounted) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setResults([]);
          }
        } finally {
          if (isMounted) {
            setIsSearching(false);
          }
        }
      } else if (query.length === 0) {
        setResults([]);
        setError(null);
      }
    }, debounceTime);

    return () => {
      isMounted = false;
      clearTimeout(searchTimeout);
    };
  }, [query, indices, limit, debounceTime, minQueryLength, autoSearch]);

  // Manual search function
  const executeSearch = async (manualQuery?: string, manualIndices?: SearchIndex[]) => {
    const searchQuery = manualQuery ?? query;
    const searchIndices = manualIndices ?? indices;
    
    if (searchQuery.length < minQueryLength) {
      return [];
    }

    setIsSearching(true);
    
    try {
      const searchResults = await search({
        query: searchQuery,
        indices: searchIndices,
        limit,
      });
      
      setResults(searchResults);
      setError(null);
      return searchResults;
    } catch (err) {
      console.error("Search error:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setResults([]);
      return [];
    } finally {
      setIsSearching(false);
    }
  };

  return {
    query,
    setQuery,
    results,
    isSearching,
    error,
    indices,
    setIndices,
    executeSearch,
  };
} 
