"use client"

import Link from "next/link"
import { CalendarDays, MapPin, Clock, Users, ExternalLink } from "lucide-react"
import { format } from "date-fns"
import { Card, CardContent, CardFooter } from "@repo/ui/components/ui/card"
import { Button } from "@repo/ui/components/ui/button"
import { Badge } from "@repo/ui/components/ui/badge"
import { cn } from '@repo/ui/lib/utils'

// Mock data for events
const events = [
  {
    id: "evt-001",
    title: "Annual Alumni Reunion",
    description: "Join us for our annual alumni reunion and networking event",
    category: "Networking",
    date: new Date(new Date().setDate(new Date().getDate() + 45)),
    time: "18:00 - 22:00",
    location: "Oslo Opera House",
    attendees: 124,
    online: false,
    registrationRequired: true,
  },
  {
    id: "evt-002",
    title: "Tech Industry Panel Discussion",
    description: "A panel discussion with industry leaders about the future of tech",
    category: "Education",
    date: new Date(new Date().setDate(new Date().getDate() + 12)),
    time: "19:00 - 21:00",
    location: "Online",
    attendees: 78,
    online: true,
    registrationRequired: true,
  },
  {
    id: "evt-003",
    title: "Career Development Workshop",
    description: "Learn about career advancement strategies from HR professionals",
    category: "Career",
    date: new Date(new Date().setDate(new Date().getDate() + 7)),
    time: "14:00 - 16:00",
    location: "Campus Main Building, Room 302",
    attendees: 45,
    online: false,
    registrationRequired: true,
  },
]

export function EventsList() {
  return (
    <div className="flex flex-col gap-4">
      {events.map((event) => (
        <Card key={event.id} className="bg-background/50 backdrop-blur-sm border-primary/10 hover:border-primary/20 transition-colors overflow-hidden">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-lg">{event.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                </div>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "ml-2 whitespace-nowrap",
                    event.category === "Networking" && "border-blue-500/50 text-blue-500",
                    event.category === "Education" && "border-purple-500/50 text-purple-500",
                    event.category === "Career" && "border-green-500/50 text-green-500"
                  )}
                >
                  {event.category}
                </Badge>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  <span>{format(event.date, "MMM d, yyyy")}</span>
                </div>
                <span className="hidden sm:inline-block">•</span>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>{event.time}</span>
                </div>
                <span className="hidden sm:inline-block">•</span>
                <div className="flex items-center gap-1.5">
                  {event.online ? (
                    <ExternalLink className="h-4 w-4" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                  <span className="truncate max-w-[150px]">{event.location}</span>
                </div>
                <span className="hidden sm:inline-block">•</span>
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  <span>{event.attendees} attending</span>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="px-4 py-3 border-t bg-muted/20">
            <div className="w-full flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                {event.registrationRequired ? "Registration required" : "Open to all alumni"}
              </p>
              <Button asChild size="sm" variant="outline">
                <Link href={`/alumni/events/${event.id}`}>
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