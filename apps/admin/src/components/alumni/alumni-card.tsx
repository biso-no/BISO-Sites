import { MapPin, Briefcase, GraduationCap } from "lucide-react"
import { Card, CardContent, CardFooter } from "@repo/ui/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar"
import { Button } from "@repo/ui/components/ui/button"
import { Badge } from "@repo/ui/components/ui/badge"
import { UserProfile } from "@/lib/types/alumni"
import Link from "next/link"

interface AlumniCardProps {
  profile: UserProfile;
}

export function AlumniCard({ profile }: AlumniCardProps) {
  // Generate initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card className="overflow-hidden">
      <div className="h-24 bg-linear-to-r from-primary/20 to-secondary/20" />
      <CardContent className="p-6 pt-0 -mt-12">
        <div className="flex flex-col items-center text-center">
          <Avatar className="h-24 w-24 border-4 border-background">
            <AvatarImage src={profile.avatarUrl || ""} alt={profile.name} />
            <AvatarFallback>{getInitials(profile.name)}</AvatarFallback>
          </Avatar>
          <h3 className="text-lg font-semibold mt-4">{profile.name}</h3>
          <p className="text-sm text-muted-foreground">{profile.title || "Alumni"}</p>
          
          <div className="w-full space-y-2 mt-4">
            {profile.company && (
              <div className="flex items-center gap-2 text-sm">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span>{profile.company}</span>
              </div>
            )}
            {profile.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{profile.location}</span>
              </div>
            )}
            {profile.graduationYear && (
              <div className="flex items-center gap-2 text-sm">
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
                <span>Class of {profile.graduationYear}</span>
              </div>
            )}
          </div>
          
          <div className="flex flex-wrap gap-1 mt-4 justify-center">
            {profile.skills && profile.skills.slice(0, 3).map((skill, i) => (
              <Badge key={i} variant="secondary" className="text-xs font-normal">
                {skill}
              </Badge>
            ))}
            {profile.skills && profile.skills.length > 3 && (
              <Badge variant="outline" className="text-xs font-normal">
                +{profile.skills.length - 3} more
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between p-4 pt-0">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/alumni/${profile.$id}`}>View Profile</Link>
        </Button>
        <Button size="sm">Connect</Button>
      </CardFooter>
    </Card>
  )
}