"use client"

import { useState } from "react"
import { MapPin } from "lucide-react"
import { alumniProfiles } from "./alumni-data"
import { AlumniCard } from "./alumni-card"
import { cn } from '@repo/ui/lib/utils'

export function AlumniMap() {
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  
  // Group alumni by location
  const locationGroups = alumniProfiles.reduce((groups, profile) => {
    const location = profile.location.split(',')[0].trim() // Extract city name
    if (!groups[location]) {
      groups[location] = []
    }
    groups[location].push(profile)
    return groups
  }, {} as Record<string, typeof alumniProfiles>)
  
  // Create location markers with coordinates (mock coordinates for illustration)
  const locationMarkers = {
    'Oslo': { x: 50, y: 30, count: locationGroups['Oslo']?.length || 0 },
    'Bergen': { x: 20, y: 40, count: locationGroups['Bergen']?.length || 0 },
    'Trondheim': { x: 60, y: 20, count: locationGroups['Trondheim']?.length || 0 },
    'Stavanger': { x: 25, y: 50, count: locationGroups['Stavanger']?.length || 0 },
  }
  
  return (
    <div className="space-y-6">
      <div className="relative w-full h-[500px] bg-muted/20 rounded-lg overflow-hidden border border-border flex items-center justify-center">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-muted-foreground text-sm">
            Interactive map view (visualization placeholder)
          </div>
        </div>
        
        {/* Mock map of Norway */}
        <div className="relative w-full h-full">
          <div className="absolute top-0 left-0 right-0 bottom-0 m-auto w-[60%] h-[80%] border-2 border-primary/20 rounded-[30%_70%_70%_30%/30%_30%_70%_70%] bg-primary/5"></div>
          
          {/* Location markers */}
          {Object.entries(locationMarkers).map(([location, { x, y, count }]) => (
            <button
              key={location}
              className={cn(
                "absolute transform -translate-x-1/2 -translate-y-1/2 group",
                selectedLocation === location ? "z-10" : "z-0"
              )}
              style={{ left: `${x}%`, top: `${y}%` }}
              onClick={() => setSelectedLocation(location === selectedLocation ? null : location)}
            >
              <div className={cn(
                "flex items-center justify-center w-10 h-10 rounded-full bg-background border-2 border-primary shadow-lg transform transition-all duration-300",
                selectedLocation === location ? "scale-125 border-primary" : "hover:scale-110 border-primary/50",
              )}>
                <MapPin className={cn(
                  "h-5 w-5 transition-colors",
                  selectedLocation === location ? "text-primary" : "text-primary/70"
                )} />
              </div>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 px-2 py-1 rounded-md bg-background border border-border shadow-md text-sm font-medium whitespace-nowrap">
                {location} <span className="text-xs text-muted-foreground">({count})</span>
              </div>
              
              {selectedLocation === location && (
                <div className="absolute top-[calc(100%+40px)] left-1/2 transform -translate-x-1/2 w-80 bg-background border border-border rounded-lg shadow-xl z-50 p-4">
                  <div className="font-medium mb-2">Alumni in {location}</div>
                  <div className="max-h-[300px] overflow-y-auto space-y-2">
                    {locationGroups[location].map((profile) => (
                      <AlumniCard 
                        key={profile.id} 
                        profile={profile} 
                        variant="compact"
                      />
                    ))}
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
      
      {selectedLocation ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {locationGroups[selectedLocation].map((profile) => (
            <AlumniCard key={profile.id} profile={profile} />
          ))}
        </div>
      ) : (
        <div className="p-8 text-center">
          <h3 className="text-lg font-medium">Select a location on the map</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Click on a marker to see alumni from that location
          </p>
        </div>
      )}
    </div>
  )
} 