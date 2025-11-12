"use client"

import Link from "next/link"
import { CalendarDays, Building2, Briefcase, MapPin, CreditCard } from "lucide-react"
import { Card, CardContent, CardFooter } from "@repo/ui/components/ui/card"
import { Button } from "@repo/ui/components/ui/button"
import { Badge } from "@repo/ui/components/ui/badge"
import { cn } from '@repo/ui/lib/utils'
import { format } from "date-fns"

// Mock data for job listings
const jobs = [
  {
    id: "job-001",
    title: "Senior Product Manager",
    company: "TechVision AS",
    logo: "/placeholder-logo.svg",
    location: "Oslo, Norway",
    salary: "800,000 - 1,000,000 NOK",
    type: "Full-time",
    category: "Product",
    postedAt: new Date(new Date().setDate(new Date().getDate() - 2)),
  },
  {
    id: "job-002",
    title: "Data Scientist",
    company: "AnalyticsPro",
    logo: "/placeholder-logo.svg",
    location: "Trondheim (Hybrid)",
    salary: "650,000 - 850,000 NOK",
    type: "Full-time",
    category: "Data Science",
    postedAt: new Date(new Date().setDate(new Date().getDate() - 5)),
  },
  {
    id: "job-003",
    title: "UX/UI Designer",
    company: "CreativeNordic",
    logo: "/placeholder-logo.svg",
    location: "Remote (Norway)",
    salary: "550,000 - 700,000 NOK",
    type: "Contract",
    category: "Design",
    postedAt: new Date(new Date().setDate(new Date().getDate() - 7)),
  },
]

export function JobsList() {
  return (
    <div className="flex flex-col gap-4">
      {jobs.map((job) => (
        <Card key={job.id} className="bg-background/50 backdrop-blur-sm border-primary/10 hover:border-primary/20 transition-colors overflow-hidden">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-lg">{job.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{job.company}</span>
                  </div>
                </div>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "ml-2 whitespace-nowrap",
                    job.category === "Product" && "border-blue-500/50 text-blue-500",
                    job.category === "Data Science" && "border-purple-500/50 text-purple-500",
                    job.category === "Design" && "border-green-500/50 text-green-500"
                  )}
                >
                  {job.category}
                </Badge>
              </div>
              
              <div className="flex flex-col sm:flex-row flex-wrap sm:items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  <span>{job.location}</span>
                </div>
                
                <div className="flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4" />
                  <span>{job.type}</span>
                </div>
                
                <div className="flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4" />
                  <span>{job.salary}</span>
                </div>
                
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  <span>Posted {format(job.postedAt, "MMM d, yyyy")}</span>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="px-4 py-3 border-t bg-muted/20">
            <div className="w-full flex justify-end">
              <Button asChild size="sm" variant="outline">
                <Link href={`/alumni/jobs/${job.id}`}>
                  View details
                </Link>
              </Button>
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
} 