"use client";

import { useState, useEffect } from 'react';
import { Department } from '@/lib/admin/departments';
import { Building2, Users, Check, AlertTriangle, ChevronsUpDown, TrendingUp } from 'lucide-react';
import { MetricCard } from '@/components/shared/metric-card';
import { GlassCard } from '@/components/shared/glass-card';
import { Button } from '@repo/ui/components/ui/button';

interface DepartmentStatsProps {
  departments: Department[];
  loading?: boolean;
}

export function DepartmentStats({ departments, loading = false }: DepartmentStatsProps) {
  const [activeCount, setActiveCount] = useState(0);
  const [inactiveCount, setInactiveCount] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [campusCounts, setCampusCounts] = useState<Record<string, number>>({});
  const [showMoreCampuses, setShowMoreCampuses] = useState(false);
  
  useEffect(() => {
    if (!departments.length) return;
    
    // Calculate stats
    const active = departments.filter(d => d.active).length;
    setActiveCount(active);
    setInactiveCount(departments.length - active);
    
    const users = departments.reduce((sum, dept) => sum + (dept.userCount || 0), 0);
    setTotalUsers(users);
    
    // Count departments per campus
    const campusStats: Record<string, number> = {};
    departments.forEach(dept => {
      const campusName = dept.campusName || 'Unassigned';
      campusStats[campusName] = (campusStats[campusName] || 0) + 1;
    });
    setCampusCounts(campusStats);
  }, [departments]);
  
  // Sort campuses by count (descending)
  const sortedCampuses = Object.entries(campusCounts)
    .sort(([, countA], [, countB]) => countB - countA);
  
  // Limit to top 3 by default
  const displayCampuses = showMoreCampuses 
    ? sortedCampuses 
    : sortedCampuses.slice(0, 3);
  
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-8">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Units"
          value={departments.length}
          icon={Building2}
          iconColor="text-primary"
          iconBgColor="bg-primary/10"
        />
        
        <MetricCard
          title="Total Members"
          value={totalUsers}
          icon={Users}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-500/10"
        />
        
        <MetricCard
          title="Active Units"
          value={activeCount}
          icon={Check}
          iconColor="text-green-600"
          iconBgColor="bg-green-500/10"
        />
        
        <MetricCard
          title="Inactive Units"
          value={inactiveCount}
          icon={AlertTriangle}
          iconColor="text-amber-600"
          iconBgColor="bg-amber-500/10"
        />
      </div>
      
      {/* Campus Distribution */}
      {departments.length > 0 && sortedCampuses.length > 0 && (
        <GlassCard
          title="Campus Distribution"
          description="Department distribution across all campuses"
          variant="premium"
          className="animate-in fade-in-50 slide-in-from-bottom-4 duration-500"
        >
          <div className="space-y-4">
            {displayCampuses.map(([campusName, count], index) => {
                  const percentage = Math.round((count / departments.length) * 100);
                  return (
                <div 
                  key={campusName} 
                  className="space-y-2 animate-in fade-in-50 slide-in-from-left-4"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-foreground">{campusName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{count} units</span>
                      <span className="font-semibold text-primary">{percentage}%</span>
                    </div>
                      </div>
                  <div className="relative h-3 w-full bg-muted/50 rounded-full overflow-hidden">
                    {/* Animated gradient bar */}
                        <div 
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-1000 ease-out shadow-sm"
                      style={{ 
                        width: `${percentage}%`,
                        transitionDelay: `${index * 100}ms`
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                    </div>
                      </div>
                    </div>
                  );
                })}
            
            {sortedCampuses.length > 3 && (
              <div className="pt-2 flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMoreCampuses(!showMoreCampuses)}
                  className="text-primary hover:text-primary/80 gap-2"
                >
                  {showMoreCampuses ? "Show Less" : `Show All ${sortedCampuses.length} Campuses`}
                  <ChevronsUpDown className="h-4 w-4" />
                </Button>
              </div>
            )}
        </div>
        </GlassCard>
      )}
    </div>
  );
} 