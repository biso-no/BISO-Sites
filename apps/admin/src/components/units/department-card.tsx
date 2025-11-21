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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/ui/dialog";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import {
  Calendar,
  Edit,
  Eye,
  MapPin,
  MessageSquare,
  Tag,
  Users,
  Users2,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

// Client-side only component for HTML content
function HTMLContent({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  if (!html) return null;
  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

interface DepartmentCardProps {
  department: Departments & {
    campusName?: string;
    displayTitle?: string;
    userCount?: number;
    boardMemberCount?: number;
    socialsCount?: number;
  };
  onEdit?: (department: any) => void;
}

export function DepartmentCard({ department, onEdit }: DepartmentCardProps) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
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
    <Card className="overflow-hidden transition-all duration-500 hover:shadow-2xl border-border/50 hover:border-primary/30 group relative bg-card/60 backdrop-blur-sm hover:-translate-y-2">
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 bg-linear-to-br from-primary/0 via-accent/0 to-primary/0 group-hover:from-primary/10 group-hover:via-accent/5 group-hover:to-primary/10 transition-all duration-500 pointer-events-none z-0" />

      <CardHeader className="p-0 overflow-hidden h-40 relative">
        <div
          className="absolute inset-0 bg-linear-to-t from-black/90 via-black/60 to-transparent z-10 
                    transition-all duration-500 group-hover:from-black/95"
        />

        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-linear-to-br from-primary via-primary/80 to-accent transition-all duration-500 group-hover:scale-110">
          <div className="absolute inset-0 bg-grid-white/[0.05] bg-size-[20px_20px]" />
        </div>

        <div className="absolute top-3 right-3 z-20 flex gap-2">
          {!department.active && (
            <Badge
              variant="destructive"
              className="shadow-lg backdrop-blur-sm animate-pulse"
            >
              Inactive
            </Badge>
          )}
          {department.type && (
            <Badge
              variant="outline"
              className="bg-black/40 backdrop-blur-md border-white/20 text-white shadow-lg hover:bg-black/60 transition-all duration-300"
            >
              {department.type}
            </Badge>
          )}
        </div>

        <div className="h-full w-full relative">
          {/* Department logo as an overlay */}
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-3">
            <div className="h-14 w-14 rounded-xl overflow-hidden bg-white/10 backdrop-blur-md flex items-center justify-center border-2 border-white/30 shadow-xl group-hover:scale-110 group-hover:border-white/50 transition-all duration-500">
              {department.logo ? (
                <Image
                  src={logoUrl}
                  alt={department.Name}
                  width={56}
                  height={56}
                  className="object-cover h-full w-full"
                />
              ) : (
                <span className="text-xl font-bold text-white">
                  {displayName.substring(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-white text-xl drop-shadow-lg line-clamp-2 group-hover:text-white/90 transition-colors duration-300">
                {displayName}
              </h3>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 relative z-10">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground group-hover:text-foreground transition-colors duration-300">
            <div className="p-1.5 rounded-md bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors duration-300">
              <MapPin size={14} className="text-blue-600" />
            </div>
            <span className="font-medium">
              {department.campusName || "No campus assigned"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <div className="p-1.5 rounded-md bg-green-500/10 group-hover:bg-green-500/20 transition-colors duration-300">
                <Users size={14} className="text-green-600" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-foreground">
                  {department.userCount || 0}
                </span>
                <span className="text-xs text-muted-foreground">members</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <div className="p-1.5 rounded-md bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors duration-300">
                <Users2 size={14} className="text-purple-600" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-foreground">
                  {department.boardMemberCount || 0}
                </span>
                <span className="text-xs text-muted-foreground">board</span>
              </div>
            </div>
          </div>

          {department.socialsCount && department.socialsCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="p-1.5 rounded-md bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors duration-300">
                <MessageSquare size={14} className="text-amber-600" />
              </div>
              <span className="font-medium">
                {department.socialsCount} social links
              </span>
            </div>
          )}

          {shortDescription && (
            <p className="mt-1 text-sm line-clamp-2 text-muted-foreground leading-relaxed">
              {shortDescription}
            </p>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-5 pt-0 flex gap-2 relative z-10">
        <Button
          onClick={() => router.push(`/admin/units/${department.$id}`)}
          variant="outline"
          size="sm"
          className="flex-1 bg-card/60 backdrop-blur-sm border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 group/btn"
        >
          <Eye
            size={14}
            className="mr-2 group-hover/btn:scale-110 transition-transform duration-300"
          />
          View Details
        </Button>
        {onEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(department)}
            className="hover:bg-primary/10 transition-all duration-300 group/btn"
          >
            <Edit
              size={14}
              className="mr-2 group-hover/btn:rotate-12 transition-transform duration-300"
            />
            Edit
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
