import { useState, useEffect } from "react"
import Link from "next/link"
import { Search, Command, X } from "lucide-react"
import { Button } from "@repo/ui/components/ui/button"
import { Input } from "@repo/ui/components/ui/input"
import { cn } from '@repo/ui/lib/utils'
import { useSearch } from "@/lib/hooks/useSearch"
import { SearchIndex, SearchResult } from "@/lib/search"

interface SearchPanelProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  defaultIndices?: SearchIndex[]
  limit?: number
  showIndexFilter?: boolean
}

export function SearchPanel({
  isOpen,
  onOpenChange,
  defaultIndices = ["jobs", "events", "news"],
  limit = 10,
  showIndexFilter = false
}: SearchPanelProps) {
  const { 
    query, 
    setQuery, 
    results, 
    isSearching, 
    indices, 
    setIndices 
  } = useSearch({
    defaultIndices,
    limit
  })

  // Handle keyboard shortcut for escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        e.preventDefault()
        onOpenChange(false)
      }
    }
    
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onOpenChange])

  // Clear search when closed
  useEffect(() => {
    if (!isOpen) {
      setQuery("")
    }
  }, [isOpen, setQuery])

  // Prevent body scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  return (
    <div className={`fixed inset-0 z-100 ${isOpen ? 'block' : 'hidden'}`}>
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={() => onOpenChange(false)}
      />
      
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl px-4">
        <div className="glass-dark rounded-lg border border-secondary-100/20 overflow-hidden shadow-2xl">
          {/* Search input */}
          <div className="flex items-center border-b border-secondary-100/20 px-3">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-accent/10">
              <Search className="h-3.5 w-3.5 text-secondary-100" />
            </div>
            <Input
              className="flex-1 border-0 rounded-none h-14 bg-transparent shadow-none focus-visible:ring-0 text-base text-white placeholder:text-gray-400 pl-3"
              placeholder="Search for jobs, events, or news..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {query.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setQuery("")}
                className="h-8 w-8 text-gray-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <kbd className="pointer-events-none h-5 select-none items-center gap-1 rounded border border-secondary-100/30 bg-primary-80/50 px-1.5 font-mono text-xs font-medium opacity-100 flex text-gray-400">
              ESC
            </kbd>
          </div>
          
          {/* Index filters */}
          {showIndexFilter && (
            <div className="flex gap-1 p-2 border-b border-secondary-100/20 overflow-x-auto">
              {(["all", "jobs", "events", "news"] as const).map(index => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 px-2 text-xs rounded-full",
                    index === "all"
                      ? indices.length === defaultIndices.length
                        ? "bg-blue-accent/20 text-blue-accent"
                        : "text-gray-400"
                      : indices.includes(index as SearchIndex)
                        ? "bg-blue-accent/20 text-blue-accent"
                        : "text-gray-400"
                  )}
                  onClick={() => {
                    if (index === "all") {
                      setIndices(defaultIndices)
                    } else {
                      const indexName = index as SearchIndex
                      if (indices.includes(indexName)) {
                        // Remove if it's there
                        setIndices(indices.filter(i => i !== indexName))
                      } else {
                        // Add if it's not
                        setIndices([...indices, indexName])
                      }
                    }
                  }}
                >
                  {index === "all"
                    ? "All"
                    : index === "jobs"
                      ? "Jobs"
                      : index === "events"
                        ? "Events"
                        : index === "news"
                          ? "News"
                          : index}
                </Button>
              ))}
            </div>
          )}
          
          {/* Results area */}
          <div className="py-2 max-h-[60vh] overflow-y-auto">
            {query.length === 0 ? (
              <div className="py-8 text-center text-gray-400">
                <Command className="h-12 w-12 mx-auto mb-2 text-secondary-100/40" />
                <p className="text-sm">Search the alumni network, events, jobs and resources</p>
                <p className="text-xs mt-1">Try searching for a name, event, job, or resource</p>
              </div>
            ) : isSearching ? (
              <div className="py-8 text-center text-gray-400">
                <div className="w-8 h-8 border-t-2 border-blue-accent/60 rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-sm">Searching...</p>
              </div>
            ) : (
              <div className="space-y-1">
                {results.length > 0 ? results.map((result, i) => (
                  <SearchResultItem 
                    key={i} 
                    result={result} 
                    onClick={() => onOpenChange(false)} 
                  />
                )) : (
                  <div className="py-8 text-center text-gray-400">
                    <p className="text-sm">No results found for &quot;{query}&quot;</p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="border-t border-secondary-100/20 p-2">
            <div className="flex justify-between text-xs text-gray-400 px-2">
              <div className="flex gap-3">
                <div className="flex items-center gap-1">
                  <kbd className="inline-flex h-5 select-none items-center gap-1 rounded border border-secondary-100/30 bg-primary-80/50 px-1.5 font-mono text-[10px] font-medium text-gray-400">↑↓</kbd>
                  <span>Navigate</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="inline-flex h-5 select-none items-center gap-1 rounded border border-secondary-100/30 bg-primary-80/50 px-1.5 font-mono text-[10px] font-medium text-gray-400">↵</kbd>
                  <span>Select</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-400">by</span>
                <span className="font-semibold gradient-text text-xs">BISO</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface SearchResultItemProps {
  result: SearchResult
  onClick: () => void
}

function SearchResultItem({ result, onClick }: SearchResultItemProps) {
  // Ensure correct URL for user profiles
  const getHref = () => {
    return result.href || '#';
  };

  // Get appropriate display texts based on result type
  const getDisplayName = () => {
    switch(result.index) {
      case "events":
        return result.name || result.title || "Event";
      case "jobs":
        return result.title || result.company || "Job Opportunity";
      case "news":
        return result.title || result.name || "News";
      default:
        return result.name || result.title || "Unnamed";
    }
  };

  // Get appropriate details text
  const getDetailsText = () => {
    switch(result.index) {
      case "jobs":
        return [
          result.company,
          result.location,
          result.department
        ].filter(Boolean).join(" • ");
      case "events":
        return [
          result.date ? formatDate(result.date) : null,
          result.location
        ].filter(Boolean).join(" • ");
      case "news":
        return [
          result.department || null,
          result.date ? formatDate(result.date) : null
        ].filter(Boolean).join(" • ");
      default:
        return result.description || "";
    }
  };

  // Simple date formatter helper
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (e) {
      return dateString;
    }
  };

  return (
    <Button
      variant="ghost"
      asChild
      className="w-full justify-start px-4 py-2 h-auto text-left"
      onClick={onClick}
    >
      <Link href={getHref()} className="flex items-start gap-4">
        <div className={cn(
          "rounded-full h-8 w-8 flex items-center justify-center",
          result.index === "events" && "bg-gold-default/20",
          result.index === "jobs" && "bg-secondary-100/20",
          result.index === "news" && "bg-blue-strong/20",
        )}>
          <span className={cn(
            "text-xs",
            result.index === "events" && "text-gold-default",
            result.index === "jobs" && "text-secondary-100",
            result.index === "news" && "text-blue-strong",
          )}>
            {result.index[0].toUpperCase()}
          </span>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white">{getDisplayName()}</p>
            <span className="text-xs text-gray-400">
              {result.index === "jobs" ? "Job" :
                result.index === "events" ? "Event" :
                result.index === "news" ? "News" :
                (result.index as string).charAt(0).toUpperCase() + (result.index as string).slice(1)}
            </span>
          </div>
          <p className="text-xs text-gray-400">
            {getDetailsText()}
          </p>
        </div>
      </Link>
    </Button>
  )
} 
