"use client"

import { AlumniCard } from "./alumni-card"
import { alumniProfiles } from "./alumni-data"
import { UserProfile } from "@/lib/types/alumni"

export function AlumniGrid({ alumni }: { alumni: UserProfile[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {alumni.map((profile) => (
        <AlumniCard key={profile.$id} profile={profile} />
      ))}
    </div>
  )
} 