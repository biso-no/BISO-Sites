import { cn } from "@repo/ui/lib/utils";
import { Card } from "@repo/ui/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import { Linkedin, Twitter, Mail } from "lucide-react";
import { getStorageFileUrl } from "@repo/api/storage";
import type { TeamGridBlockProps } from "../../types";

const columnsMap = {
  "1": "grid-cols-1",
  "2": "grid-cols-1 md:grid-cols-2",
  "3": "grid-cols-1 md:grid-cols-3",
  "4": "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
};

export function TeamGrid({ id, members, columns = "3" }: TeamGridBlockProps) {
  return (
    <div id={id} className={cn("grid gap-8", columnsMap[columns])}>
      {members.map((member) => {
        const photoUrl = member.photo?.type === "upload" && member.photo.fileId
          ? getStorageFileUrl("content", member.photo.fileId)
          : member.photo?.url;

        const initials = member.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase();

        return (
          <Card
            key={member.id}
            className="p-6 border-0 shadow-lg hover:shadow-xl transition-all duration-300 text-center"
          >
            <Avatar className="h-24 w-24 mx-auto mb-4">
              {photoUrl && <AvatarImage src={photoUrl} alt={member.name} />}
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>

            <h3 className="text-xl font-bold text-gray-900 mb-1">{member.name}</h3>
            <p className="text-[#3DA9E0] font-medium mb-3">{member.role}</p>

            {member.bio && <p className="text-gray-600 mb-4 text-sm">{member.bio}</p>}

            {(member.linkedin || member.twitter || member.email) && (
              <div className="flex gap-2 justify-center">
                {member.linkedin && (
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0"
                  >
                    <a
                      href={member.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${member.name} on LinkedIn`}
                    >
                      <Linkedin className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                {member.twitter && (
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0"
                  >
                    <a
                      href={member.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${member.name} on Twitter`}
                    >
                      <Twitter className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                {member.email && (
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0"
                  >
                    <a href={`mailto:${member.email}`} aria-label={`Email ${member.name}`}>
                      <Mail className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

