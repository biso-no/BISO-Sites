import { cn } from "@repo/ui/lib/utils";
import { Card } from "@repo/ui/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Quote, Star } from "lucide-react";
import { getStorageFileUrl } from "@repo/api/storage";
import type { TestimonialBlockProps, SectionBackground } from "../../types";

const backgroundMap: Record<SectionBackground, string> = {
  default: "bg-white text-slate-900",
  muted: "bg-slate-100 text-slate-900",
  primary: "bg-primary text-primary-foreground",
};

export function Testimonial({
  id,
  quote,
  author,
  role,
  avatar,
  rating,
  background = "default",
}: TestimonialBlockProps) {
  const avatarUrl = avatar?.type === "upload" && avatar.fileId
    ? getStorageFileUrl("content", avatar.fileId)
    : avatar?.url;

  const initials = author
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <Card
      id={id}
      className={cn(
        "relative p-12 border-0 shadow-xl max-w-4xl mx-auto",
        backgroundMap[background]
      )}
    >
      <Quote className="w-16 h-16 text-primary/20 mb-6" />

      <blockquote className="text-xl md:text-2xl font-medium mb-8 leading-relaxed">
        &ldquo;{quote}&rdquo;
      </blockquote>

      {rating && (
        <div className="flex gap-1 mb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={cn(
                "w-5 h-5",
                i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
              )}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-4">
        <Avatar className="h-12 w-12">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={author} />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div>
          <div className="font-semibold">{author}</div>
          {role && <div className="text-sm text-muted-foreground">{role}</div>}
        </div>
      </div>
    </Card>
  );
}

