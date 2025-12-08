import type { DepartmentBoard } from "@repo/api/types/appwrite";
import {
 Avatar,
 AvatarFallback,
 AvatarImage,
} from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Linkedin, Mail } from "lucide-react";

type TeamMemberCardProps = {
 member: DepartmentBoard;
};

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
 <Card className="group border-0 p-6 text-center shadow-lg transition-all hover:shadow-xl">
 <Avatar className="mx-auto mb-4 h-32 w-32 ring-4 ring-brand-border transition-all group-hover:ring-brand">
 <AvatarImage
 alt={member.name || ""}
 src={member.imageUrl || undefined}
 />
 <AvatarFallback className="bg-linear-to-br from-brand-gradient-from to-brand-gradient-to text-2xl text-white">
 {member.name ? getInitials(member.name) : "??"}
 </AvatarFallback>
 </Avatar>
 <h3 className="mb-1 text-foreground">{member.name}</h3>
 <p className="mb-4 text-brand">{member.role}</p>
 <div className="flex justify-center gap-3">
 <Button
 className="border-brand-border text-brand hover:bg-brand-muted"
 size="sm"
 variant="outline"
 >
 <Mail className="h-4 w-4" />
 </Button>
 <Button
 className="border-brand-border text-brand hover:bg-brand-muted"
 size="sm"
 variant="outline"
 >
 <Linkedin className="h-4 w-4" />
 </Button>
 </div>
 </Card>
 );
}
