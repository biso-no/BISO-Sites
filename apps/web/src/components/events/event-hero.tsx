import type { ContentTranslations } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { format } from "date-fns";
import { ArrowLeft, Calendar, Clock, MapPin, Users } from "lucide-react";
import Link from "next/link";
import {
 type EventCategory,
 getEventCategory,
 parseEventMetadata,
} from "@/lib/types/event";

type EventHeroProps = {
 event: ContentTranslations;
};

const categoryColors: Record<EventCategory, string> = {
 Social: "bg-purple-100 text-purple-700 border-purple-200",
 Career: "bg-blue-100 text-blue-700 border-blue-200",
 Academic: "bg-green-100 text-green-700 border-green-200",
 Sports: "bg-orange-100 text-orange-700 border-orange-200",
 Culture: "bg-pink-100 text-pink-700 border-pink-200",
};

export function EventHero({ event }: EventHeroProps) {
 const eventData = event.event_ref;
 const metadata = parseEventMetadata(eventData?.metadata);
 const category = getEventCategory(metadata);

 // Format dates
 const startDate = eventData?.start_date
 ? format(new Date(eventData.start_date), "MMMM d, yyyy")
 : "TBA";

 const startTime = eventData?.start_date
 ? format(new Date(eventData.start_date), "HH:mm")
 : "";

 const endTime = eventData?.end_date
 ? format(new Date(eventData.end_date), "HH:mm")
 : "";

 const timeRange =
 startTime && endTime ? `${startTime} - ${endTime}` : startTime || "TBA";

 const attendees = metadata.attendees || 0;
 const imageUrl =
 eventData?.image ||
 "https://images.unsplash.com/photo-1758270705657-f28eec1a5694";

 return (
 <div className="relative h-[50vh] overflow-hidden">
 <ImageWithFallback
 alt={event.title}
 className="object-cover"
 fill
 priority
 src={imageUrl}
 />
 <div className="absolute inset-0 bg-linear-to-br from-brand-overlay-from via-brand-overlay-via to-brand-overlay-to" />

 <div className="absolute inset-0">
 <div className="mx-auto flex h-full max-w-5xl items-center px-4">
 <Link
 className="absolute top-8 left-8 flex items-center gap-2 text-white transition-colors hover:text-brand"
 href="/events"
 >
 <ArrowLeft className="h-5 w-5" />
 Back to Events
 </Link>

 <div className="fade-in slide-in-from-bottom-4 mt-12 animate-in duration-700">
 <Badge className={`mb-4 ${categoryColors[category]}`}>
 {category}
 </Badge>
 <h1 className="mb-4 font-bold text-4xl text-white md:text-5xl">
 {event.title}
 </h1>

 <div className="mt-6 flex flex-wrap items-center gap-4">
 <div className="flex items-center gap-2 text-white/90">
 <Calendar className="h-5 w-5 text-brand" />
 <span>{startDate}</span>
 </div>
 <div className="flex items-center gap-2 text-white/90">
 <Clock className="h-5 w-5 text-brand" />
 <span>{timeRange}</span>
 </div>
 <div className="flex items-center gap-2 text-white/90">
 <MapPin className="h-5 w-5 text-brand" />
 <span>{eventData?.location || "Location TBA"}</span>
 </div>
 {attendees > 0 && (
 <div className="flex items-center gap-2 text-white/90">
 <Users className="h-5 w-5 text-brand" />
 <span>{attendees} attending</span>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}
