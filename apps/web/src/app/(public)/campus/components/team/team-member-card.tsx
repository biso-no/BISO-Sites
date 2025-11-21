import { Mail, Linkedin } from "lucide-react";
import { Card } from "@repo/ui/components/ui/card";
import { Button } from "@repo/ui/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import type { DepartmentBoard } from "@repo/api/types/appwrite";

interface TeamMemberCardProps {
  member: DepartmentBoard;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function TeamMemberCard({ member }: TeamMemberCardProps) {
  return (
    <Card className="p-6 border-0 shadow-lg hover:shadow-xl transition-all text-center group">
      <Avatar className="w-32 h-32 mx-auto mb-4 ring-4 ring-[#3DA9E0]/20 group-hover:ring-[#3DA9E0] transition-all">
        <AvatarImage src={member.imageUrl || undefined} alt={member.name || ""} />
        <AvatarFallback className="bg-linear-to-br from-[#3DA9E0] to-[#001731] text-white text-2xl">
          {member.name ? getInitials(member.name) : "??"}
        </AvatarFallback>
      </Avatar>
      <h3 className="text-gray-900 mb-1">{member.name}</h3>
      <p className="text-[#3DA9E0] mb-4">{member.role}</p>
      <div className="flex justify-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="border-[#3DA9E0]/20 text-[#3DA9E0] hover:bg-[#3DA9E0]/10"
        >
          <Mail className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-[#3DA9E0]/20 text-[#3DA9E0] hover:bg-[#3DA9E0]/10"
        >
          <Linkedin className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}

