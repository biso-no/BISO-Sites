"use client";

import type { Departments } from "@repo/api/types/appwrite";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@repo/ui/components/ui/card";
import { Edit, Eye, MapPin, MessageSquare, Users, Users2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

// Client-side only component for HTML content
function _HTMLContent({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  if (!html) {
    return null;
  }
  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

type DepartmentCardProps = {
  department: Departments & {
    campusName?: string;
    displayTitle?: string;
    userCount?: number;
    boardMemberCount?: number;
    socialsCount?: number;
  };
  onEdit?: (department: any) => void;
};

export function DepartmentCard({ department, onEdit }: DepartmentCardProps) {
  const [_isDetailsOpen, _setIsDetailsOpen] = useState(false);
  const router = useRouter();

  // Get English translation as default for display
  const enTranslation = department.translations?.find((t) => t.locale === "en");
  const displayName =
    department.displayTitle || enTranslation?.title || department.Name;
  const shortDescription = enTranslation?.short_description || "";

  const placeholderLogo =
    "https://via.placeholder.com/80?text=" +
    encodeURIComponent(displayName.substring(0, 2));

  const logoUrl = department.logo || placeholderLogo;

  return (
    <Card className="group hover:-translate-y-2 relative overflow-hidden border-border/50 bg-card/60 backdrop-blur-sm transition-all duration-500 hover:border-primary/30 hover:shadow-2xl">
      {/* Gradient overlay on hover */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-linear-to-br from-primary/0 via-accent/0 to-primary/0 transition-all duration-500 group-hover:from-primary/10 group-hover:via-accent/5 group-hover:to-primary/10" />

      <CardHeader className="relative h-40 overflow-hidden p-0">
        <div className="absolute inset-0 z-10 bg-linear-to-t from-black/90 via-black/60 to-transparent transition-all duration-500 group-hover:from-black/95" />

        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-linear-to-br from-primary via-primary/80 to-accent transition-all duration-500 group-hover:scale-110">
          <div className="absolute inset-0 bg-grid-white/[0.05] bg-size-[20px_20px]" />
        </div>

        <div className="absolute top-3 right-3 z-20 flex gap-2">
          {!department.active && (
            <Badge
              className="animate-pulse shadow-lg backdrop-blur-sm"
              variant="destructive"
            >
              Inactive
            </Badge>
          )}
          {department.type && (
            <Badge
              className="border-white/20 bg-black/40 text-white shadow-lg backdrop-blur-md transition-all duration-300 hover:bg-black/60"
              variant="outline"
            >
              {department.type}
            </Badge>
          )}
        </div>

        <div className="relative h-full w-full">
          {/* Department logo as an overlay */}
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border-2 border-white/30 bg-white/10 shadow-xl backdrop-blur-md transition-all duration-500 group-hover:scale-110 group-hover:border-white/50">
              {department.logo ? (
                <Image
                  alt={department.Name}
                  className="h-full w-full object-cover"
                  height={56}
                  src={logoUrl}
                  width={56}
                />
              ) : (
                <span className="font-bold text-white text-xl">
                  {displayName.substring(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1">
              <h3 className="line-clamp-2 font-bold text-white text-xl drop-shadow-lg transition-colors duration-300 group-hover:text-white/90">
                {displayName}
              </h3>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative z-10 p-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-muted-foreground text-sm transition-colors duration-300 group-hover:text-foreground">
            <div className="rounded-md bg-blue-500/10 p-1.5 transition-colors duration-300 group-hover:bg-blue-500/20">
              <MapPin className="text-blue-600" size={14} />
            </div>
            <span className="font-medium">
              {department.campusName || "No campus assigned"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <div className="rounded-md bg-green-500/10 p-1.5 transition-colors duration-300 group-hover:bg-green-500/20">
                <Users className="text-green-600" size={14} />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-foreground">
                  {department.userCount || 0}
                </span>
                <span className="text-muted-foreground text-xs">members</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <div className="rounded-md bg-purple-500/10 p-1.5 transition-colors duration-300 group-hover:bg-purple-500/20">
                <Users2 className="text-purple-600" size={14} />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-foreground">
                  {department.boardMemberCount || 0}
                </span>
                <span className="text-muted-foreground text-xs">board</span>
              </div>
            </div>
          </div>

          {department.socialsCount && department.socialsCount > 0 && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <div className="rounded-md bg-amber-500/10 p-1.5 transition-colors duration-300 group-hover:bg-amber-500/20">
                <MessageSquare className="text-amber-600" size={14} />
              </div>
              <span className="font-medium">
                {department.socialsCount} social links
              </span>
            </div>
          )}

          {shortDescription && (
            <p className="mt-1 line-clamp-2 text-muted-foreground text-sm leading-relaxed">
              {shortDescription}
            </p>
          )}
        </div>
      </CardContent>

      <CardFooter className="relative z-10 flex gap-2 p-5 pt-0">
        <Button
          className="group/btn flex-1 border-border/50 bg-card/60 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:bg-primary/5"
          onClick={() => router.push(`/admin/units/${department.$id}`)}
          size="sm"
          variant="outline"
        >
          <Eye
            className="mr-2 transition-transform duration-300 group-hover/btn:scale-110"
            size={14}
          />
          View Details
        </Button>
        {onEdit && (
          <Button
            className="group/btn transition-all duration-300 hover:bg-primary/10"
            onClick={() => onEdit(department)}
            size="sm"
            variant="ghost"
          >
            <Edit
              className="mr-2 transition-transform duration-300 group-hover/btn:rotate-12"
              size={14}
            />
            Edit
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
