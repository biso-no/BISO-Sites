"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { Departments } from '@repo/api/types/appwrite';
import { DepartmentCard } from './department-card';
import { Button } from '@repo/ui/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { getDepartmentsClient } from '@/lib/actions/departments';

interface DepartmentsInfiniteListProps {
  initialDepartments: (Departments & {
    campusName?: string;
    displayTitle?: string;
    userCount?: number;
    boardMemberCount?: number;
    socialsCount?: number;
  })[];
  hasMore: boolean;
  pageSize: number;
  filters: {
    active?: boolean;
    campus_id?: string;
    type?: string;
    search?: string;
  };
}

export function DepartmentsInfiniteList({
  initialDepartments,
  hasMore: initialHasMore,
  pageSize,
  filters
}: DepartmentsInfiniteListProps) {
  const router = useRouter();
  const [departments, setDepartments] = useState(initialDepartments);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [offset, setOffset] = useState(pageSize);
  const observerTarget = useRef<HTMLDivElement>(null);
  const filtersRef = useRef(filters);

  // Reset when filters change (using JSON.stringify for deep comparison)
  useEffect(() => {
    const filtersChanged = JSON.stringify(filtersRef.current) !== JSON.stringify(filters);
    
    if (filtersChanged) {
      filtersRef.current = filters;
      setDepartments(initialDepartments);
      setHasMore(initialHasMore);
      setOffset(pageSize);
    }
  }, [filters, initialDepartments, initialHasMore, pageSize]);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    try {
      const result = await getDepartmentsClient({
        ...filters,
        limit: pageSize,
        offset: offset
      });

      if (result.departments.length > 0) {
        setDepartments(prev => [...prev, ...result.departments]);
        setOffset(prev => prev + pageSize);
        setHasMore(result.departments.length === pageSize);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more departments:', error);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [filters, offset, pageSize, hasMore, isLoading]);

  // Prevent loadMore from being called during initial render
  const hasInitialized = useRef(false);
  useEffect(() => {
    hasInitialized.current = true;
  }, []);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    // Don't set up observer until after initial render
    if (!hasInitialized.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget && hasMore) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, isLoading, loadMore]);

  const handleEditDepartment = (department: any) => {
    router.push(`/admin/units/${department.$id}`);
  };

  if (departments.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
        <div className="text-muted-foreground text-lg">No departments found</div>
        <p className="text-sm text-muted-foreground max-w-md">
          {filters.search || filters.campus_id || filters.type || filters.active !== undefined
            ? "Try adjusting your filters to see more results."
            : "Get started by creating your first department."}
        </p>
        <Button 
          variant="outline" 
          onClick={() => router.push('/admin/units/new')}
          className="gap-2 mt-4"
        >
          <Plus className="h-4 w-4" />
          Create Department
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {departments.map((department) => (
          <DepartmentCard
            key={department.$id}
            department={department}
            onEdit={handleEditDepartment}
          />
        ))}
      </div>

      {/* Infinite scroll trigger */}
      <div ref={observerTarget} className="flex justify-center py-8">
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading more departments...</span>
          </div>
        )}
        {!hasMore && departments.length > 0 && (
          <p className="text-sm text-muted-foreground">
            All departments loaded ({departments.length} total)
          </p>
        )}
      </div>
    </div>
  );
}

