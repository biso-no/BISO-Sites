// AlumniList.tsx
import { MapPin, Briefcase, GraduationCap } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar"
import { Button } from "@repo/ui/components/ui/button"
import { Badge } from "@repo/ui/components/ui/badge"
import { Card, CardContent } from "@repo/ui/components/ui/card"
import Link from "next/link"
import { UserProfile } from "@/lib/types/alumni"

interface AlumniListProps {
  alumni: UserProfile[];
}

export function AlumniList({ alumni }: AlumniListProps) {
  // Generate initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };
  
  if (alumni.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-xl font-medium mb-2">No alumni found</h3>
        <p className="text-muted-foreground">Try adjusting your search or filters</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {alumni.map((profile) => (
        <Card key={profile.$id}>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile.avatarUrl || ""} alt={profile.name} />
                <AvatarFallback>{getInitials(profile.name)}</AvatarFallback>
              </Avatar>
              
              <div className="flex-1 space-y-1">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="font-medium">{profile.name}</h3>
                    <p className="text-sm text-muted-foreground">{profile.title || "Alumni"}</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/alumni/${profile.$id}`}>
                        View Profile
                      </Link>
                    </Button>
                    <Button size="sm">Connect</Button>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-4 text-sm mt-2">
                  {profile.company && (
                    <div className="flex items-center gap-1">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <span>{profile.company}</span>
                    </div>
                  )}
                  {profile.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{profile.location}</span>
                    </div>
                  )}
                  {profile.graduationYear && (
                    <div className="flex items-center gap-1">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                      <span>Class of {profile.graduationYear}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-1 mt-2">
                  {profile.skills && profile.skills.map((skill, i) => (
                    <Badge key={i} variant="secondary" className="text-xs font-normal">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}