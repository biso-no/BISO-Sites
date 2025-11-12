"use client";

import { useState, useEffect } from 'react';
import { Department } from '@/lib/admin/departments';
import { Card, CardContent } from '@repo/ui/components/ui/card';
import { Building2, Users, Check, AlertTriangle, ChevronsUpDown } from 'lucide-react';

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
  
  const statCards = [
    {
      title: "Total Units",
      value: departments.length,
      icon: <Building2 className="h-5 w-5 text-primary" />,
      color: "bg-primary/10",
    },
    {
      title: "Total Members",
      value: totalUsers,
      icon: <Users className="h-5 w-5 text-blue-500" />,
      color: "bg-blue-500/10",
    },
    {
      title: "Active Units",
      value: activeCount,
      icon: <Check className="h-5 w-5 text-green-500" />,
      color: "bg-green-500/10",
    },
    {
      title: "Inactive Units",
      value: inactiveCount,
      icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
      color: "bg-amber-500/10",
    },
  ];
  
  // Sort campuses by count (descending)
  const sortedCampuses = Object.entries(campusCounts)
    .sort(([, countA], [, countB]) => countB - countA);
  
  // Limit to top 3 by default
  const displayCampuses = showMoreCampuses 
    ? sortedCampuses 
    : sortedCampuses.slice(0, 3);
  
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <div
            key={stat.title}
            className="transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg"
          >
            <Card>
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{stat.title}</p>
                  <p className="text-3xl font-bold">
                    {loading ? (
                      <span className="animate-pulse">...</span>
                    ) : (
                      stat.value.toLocaleString()
                    )}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${stat.color}`}>{stat.icon}</div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
      
      {/* Campus Distribution */}
      {departments.length > 0 && (
        <div className="transition-all duration-300">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Campus Distribution</h3>
                {sortedCampuses.length > 3 && (
                  <button 
                    onClick={() => setShowMoreCampuses(!showMoreCampuses)}
                    className="text-sm text-primary flex items-center gap-1 hover:underline"
                  >
                    {showMoreCampuses ? "Show Less" : "Show All"}
                    <ChevronsUpDown className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              <div className="space-y-3">
                {displayCampuses.map(([campusName, count]) => {
                  const percentage = Math.round((count / departments.length) * 100);
                  return (
                    <div key={campusName} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{campusName}</span>
                        <span className="font-medium">{count} ({percentage}%)</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-1000 ease-out"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
} 