'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Filter, X } from 'lucide-react';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';

interface NewsFiltersProps {
  categories: string[];
  selectedCategory: string;
  searchQuery: string;
}

export function NewsFilters({ categories, selectedCategory, searchQuery }: NewsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const updateFilters = (category?: string, search?: string) => {
    const params = new URLSearchParams(searchParams);
    
    if (category !== undefined) {
      if (category === 'All') {
        params.delete('category');
      } else {
        params.set('category', category);
      }
    }
    
    if (search !== undefined) {
      if (search === '') {
        params.delete('search');
      } else {
        params.set('search', search);
      }
    }

    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false });
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters(undefined, localSearch);
  };

  const handleCategoryChange = (category: string) => {
    updateFilters(category, undefined);
  };

  const clearSearch = () => {
    setLocalSearch('');
    updateFilters(undefined, '');
  };

  return (
    <div className="sticky top-20 z-40 bg-white/95 backdrop-blur-lg shadow-lg border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search articles..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="pl-10 pr-10 w-full border-[#3DA9E0]/20 focus:border-[#3DA9E0]"
              disabled={isPending}
            />
            {localSearch && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                disabled={isPending}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>

          {/* Category Filter */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <Filter className="w-5 h-5 text-[#001731]" />
            {categories.map((category) => (
              <Button
                key={category}
                onClick={() => handleCategoryChange(category)}
                variant={selectedCategory === category ? 'default' : 'outline'}
                disabled={isPending}
                size="sm"
                className={
                  selectedCategory === category
                    ? 'bg-[#3DA9E0] text-white hover:bg-[#3DA9E0]/90 border-0'
                    : 'border-[#3DA9E0]/20 text-[#001731] hover:bg-[#3DA9E0]/10'
                }
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {isPending && (
          <div className="mt-4 text-center">
            <div className="inline-flex items-center gap-2 text-gray-600">
              <div className="w-4 h-4 border-2 border-[#3DA9E0] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading articles...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}