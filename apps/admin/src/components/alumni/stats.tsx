"use client"

import { UsersRound, GraduationCap, Calendar, Briefcase } from "lucide-react"
import { Card, CardContent } from "@repo/ui/components/ui/card"
import { cn } from '@repo/ui/lib/utils'
import { useEffect, useState } from "react"
// Using the proper client-side Appwrite client
import { clientDatabase } from "@repo/api/client"
import { Query, Models } from "@repo/api/client"

// Define the stat record interface
interface StatRecord extends Models.Row {
  type: 'alumni' | 'events' | 'mentorships' | 'jobs';
  count: number;
  date: string;
  period: 'daily' | 'monthly';
  monthYear?: string;
}

// Define a client-side getStats function
async function getStatsClient(
  type: 'alumni' | 'events' | 'mentorships' | 'jobs', 
  period: 'daily' | 'monthly' = 'daily',
  limit: number = 60
): Promise<StatRecord[]> {
  try {
    const DATABASE_ID = 'alumni';
    
    const stats = await clientDatabase.listDocuments<StatRecord>(
      DATABASE_ID,
      'alumniStats',
      [
        Query.equal('type', type),
        Query.equal('period', period),
        Query.orderDesc('date'),
        Query.limit(limit)
      ]
    );
    
    return stats.rows.map(doc => ({
      ...doc,
      count: typeof doc.count === 'number' ? doc.count : parseInt(doc.count) || 0
    }));
  } catch (error) {
    console.error(`Error fetching ${type} ${period} stats:`, error);
    return [];
  }
}

interface StatItem {
  name: string;
  value: string | number;
  description: string;
  icon: React.ElementType;
  change: string;
  positive: boolean;
}

const defaultStats: StatItem[] = [
  {
    name: "Active alumni",
    value: "0",
    description: "Registered users",
    icon: UsersRound,
    change: "Loading...",
    positive: true,
  },
  {
    name: "Alumni events",
    value: "0",
    description: "This year",
    icon: Calendar,
    change: "Loading...",
    positive: true,
  },
  {
    name: "Mentorship connections",
    value: "0",
    description: "Active mentorships",
    icon: GraduationCap,
    change: "Loading...",
    positive: true,
  },
  {
    name: "Job opportunities",
    value: "0",
    description: "Active postings",
    icon: Briefcase,
    change: "Loading...",
    positive: true,
  },
]

export function AlumniStats() {
  const [stats, setStats] = useState<StatItem[]>(defaultStats);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetchStats() {
      try {
        // Get current date
        const now = new Date();
        
        // Format numbers with commas for thousands
        const formatNumber = (num: number): string => {
          return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        };
        
        // Format percentage change
        const formatPercentChange = (change: number): string => {
          const formatted = Math.abs(change).toFixed(1);
          return change >= 0 
            ? `+${formatted}% from last month`
            : `-${formatted}% from last month`;
        };

        // Add a slight delay to make sure any authentication is completed
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Fetch the most recent stats for each type
        const [alumniStats, eventsStats, mentorshipsStats, jobsStats] = await Promise.all([
          getStatsClient('alumni', 'daily', 60),
          getStatsClient('events', 'daily', 60),
          getStatsClient('mentorships', 'daily', 60),
          getStatsClient('jobs', 'daily', 60)
        ]);
        
        // Check if we have any stats
        if (alumniStats.length === 0 && eventsStats.length === 0 && 
            mentorshipsStats.length === 0 && jobsStats.length === 0) {
          setLoading(false);
          return;
        }
        
        // Get latest stat for each type
        const latestAlumni = alumniStats[0] || { count: 0 };
        const latestEvents = eventsStats[0] || { count: 0 };
        const latestMentorships = mentorshipsStats[0] || { count: 0 };
        const latestJobs = jobsStats[0] || { count: 0 };
        
        // Get stats from 30 days ago for comparison
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        // Find previous month stats for comparison
        const previousAlumni = alumniStats.find(stat => 
          new Date(stat.date || stat.$createdAt) <= thirtyDaysAgo
        ) || { count: latestAlumni.count * 0.9 };
        
        const previousMentorships = mentorshipsStats.find(stat => 
          new Date(stat.date || stat.$createdAt) <= thirtyDaysAgo
        ) || { count: latestMentorships.count * 0.9 };
        
        // Calculate percent changes
        const alumniChange = previousAlumni.count > 0 
          ? ((latestAlumni.count - previousAlumni.count) / previousAlumni.count) * 100 
          : 0;
          
        const mentorshipsChange = previousMentorships.count > 0 
          ? ((latestMentorships.count - previousMentorships.count) / previousMentorships.count) * 100 
          : 0;
        
        // Count new events and jobs in last 30 days
        const newEventsCount = latestEvents.count - (
          eventsStats.find(stat => new Date(stat.date || stat.$createdAt) <= thirtyDaysAgo)?.count || 0
        );
        
        const newJobsThisMonth = latestJobs.count - (
          jobsStats.find(stat => new Date(stat.date || stat.$createdAt) <= thirtyDaysAgo)?.count || 0
        );
        
        // Update stats with real data
        setStats([
          {
            name: "Active alumni",
            value: formatNumber(latestAlumni.count),
            description: "Registered users",
            icon: UsersRound,
            change: formatPercentChange(alumniChange),
            positive: alumniChange >= 0,
          },
          {
            name: "Alumni events",
            value: latestEvents.count,
            description: "This year",
            icon: Calendar,
            change: `${newEventsCount} new this month`,
            positive: newEventsCount > 0,
          },
          {
            name: "Mentorship connections",
            value: latestMentorships.count,
            description: "Active mentorships",
            icon: GraduationCap,
            change: formatPercentChange(mentorshipsChange),
            positive: mentorshipsChange >= 0,
          },
          {
            name: "Job opportunities",
            value: latestJobs.count,
            description: "Active postings",
            icon: Briefcase,
            change: `${newJobsThisMonth} new this month`,
            positive: newJobsThisMonth > 0,
          },
        ]);
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchStats();
  }, []);
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 pb-8">
      {stats.map((stat, index) => (
        <Card 
          key={stat.name} 
          className={cn(
            "relative overflow-hidden glass-dark border-0 transition-all duration-300 group hover:shadow-card-hover",
            index === 0 && "from-primary-100 to-primary-80",
            index === 1 && "from-blue-default to-blue-accent",
            index === 2 && "from-secondary-100 to-secondary-80",
            index === 3 && "from-gold-strong to-gold-default",
          )}
        >
          <div className="absolute inset-0 bg-linear-to-br opacity-20 group-hover:opacity-30 transition-opacity duration-300"
            style={{
              background: index === 0 ? 'linear-gradient(135deg, #001731 0%, #002753 100%)' :
                        index === 1 ? 'linear-gradient(135deg, #01417B 0%, #1A77E9 100%)' :
                        index === 2 ? 'linear-gradient(135deg, #3DA9E0 0%, #65bce6 100%)' :
                        'linear-gradient(135deg, #BD9E16 0%, #F7D64A 100%)'
            }}
          />
          
          {/* Decorative elements */}
          <div className="absolute -right-6 -top-6 w-16 h-16 rounded-full bg-opacity-20 blur-xl"
            style={{
              backgroundColor: index === 0 ? '#001731' :
                              index === 1 ? '#1A77E9' :
                              index === 2 ? '#3DA9E0' :
                              '#F7D64A'
            }}
          />
          <div className="absolute right-10 bottom-10 w-32 h-32 rounded-full bg-opacity-10 blur-3xl"
            style={{
              backgroundColor: index === 0 ? '#001731' :
                              index === 1 ? '#1A77E9' :
                              index === 2 ? '#3DA9E0' :
                              '#F7D64A'
            }}
          />
          
          <CardContent className="p-6 z-10 relative">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-300 mb-1">
                  {stat.name}
                </p>
                <div className="flex items-baseline gap-2">
                  <p className={cn(
                    "text-4xl font-bold tracking-tight transition-all duration-300 group-hover:translate-y-[-2px]",
                    index === 0 ? "text-white" :
                    index === 1 ? "text-blue-accent" :
                    index === 2 ? "text-secondary-100" :
                    "gradient-text-gold"
                  )}>
                    {loading ? "-" : stat.value}
                  </p>
                  <span className="text-xs text-gray-400 font-medium">
                    {stat.description}
                  </span>
                </div>
                <p className={cn(
                  "mt-3 text-xs font-medium flex items-center gap-1",
                  stat.positive ? "text-green-400" : "text-red-400"
                )}>
                  <span className="inline-block">
                    {stat.positive ? "↑" : "↓"}
                  </span>
                  {loading ? "Loading..." : stat.change}
                </p>
              </div>
              <div className={cn(
                "p-3 rounded-lg transition-all duration-300 group-hover:scale-110",
                index === 0 ? "bg-primary-80/30" :
                index === 1 ? "bg-blue-accent/30" :
                index === 2 ? "bg-secondary-80/30" :
                "bg-gold-default/30"
              )}>
                <stat.icon className={cn(
                  "h-6 w-6",
                  index === 0 ? "text-white" :
                  index === 1 ? "text-blue-accent" :
                  index === 2 ? "text-secondary-100" :
                  "text-gold-default"
                )} />
              </div>
            </div>
            
            {/* Progress bar with animation */}
            <div className="mt-4 bg-gray-800/50 h-1.5 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-1000 ease-out animate-pulse",
                  index === 0 ? "bg-white" :
                  index === 1 ? "bg-blue-accent" :
                  index === 2 ? "bg-secondary-100" :
                  "bg-gold-default"
                )}
                style={{ width: loading ? `${(index + 1) * 25}%` : "100%" }}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
} 