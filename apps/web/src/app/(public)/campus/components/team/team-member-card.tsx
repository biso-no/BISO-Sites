import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Mail, Phone } from "lucide-react";

/**
 * A person shown on the campus leadership grid.
 *
 * Deliberately narrower than the Microsoft Graph payload the board API
 * returns: only the fields this card actually renders are carried this far, so
 * no unrendered directory data reaches the DOM.
 */
export interface TeamMember {
  email?: string;
  imageUrl?: string | null;
  name: string;
  phone?: string;
  role?: string;
}

interface TeamMemberCardProps {
  member: TeamMember;
}

// Top-level so it is not recompiled per render.
const NON_DIALLABLE = /[^\d+]/g;

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function TeamMemberCard({ member }: TeamMemberCardProps) {
  const telHref = member.phone
    ? `tel:${member.phone.replace(NON_DIALLABLE, "")}`
    : null;

  return (
    <Card className="group flex h-full flex-col border-0 p-6 text-center shadow-lg transition-all hover:shadow-xl">
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
      {member.role ? <p className="mb-4 text-brand">{member.role}</p> : null}

      {/* Contact affordances are the point of this card — students need to see
          who to reach and be able to reach them in one click. Each link is
          rendered only when the directory actually has the value, so there are
          no dead buttons. */}
      {member.email || telHref ? (
        <div className="mt-auto flex flex-col items-stretch gap-2 pt-2">
          {member.email ? (
            <Button
              asChild
              className="h-auto whitespace-normal border-brand-border py-2 text-brand hover:bg-brand-muted"
              size="sm"
              variant="outline"
            >
              <a href={`mailto:${member.email}`}>
                <Mail className="h-4 w-4 shrink-0" />
                <span className="break-all">{member.email}</span>
              </a>
            </Button>
          ) : null}
          {telHref ? (
            <Button
              asChild
              className="h-auto whitespace-normal border-brand-border py-2 text-brand hover:bg-brand-muted"
              size="sm"
              variant="outline"
            >
              <a href={telHref}>
                <Phone className="h-4 w-4 shrink-0" />
                <span>{member.phone}</span>
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
