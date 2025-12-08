import type { ContentTranslations } from "@repo/api/types/appwrite";
import { Card } from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";
import { CheckCircle2 } from "lucide-react";
import { parseEventMetadata } from "@/lib/types/event";

type EventContentProps = {
 event: ContentTranslations;
};

export function EventContent({ event }: EventContentProps) {
 const eventData = event.event_ref;
 const metadata = parseEventMetadata(eventData?.metadata);
 const highlights = metadata.highlights || [];
 const agenda = metadata.agenda || [];

 return (
 <div className="space-y-8">
 {/* Overview */}
 <Card className="border-0 p-8 shadow-lg">
 <h2 className="mb-4 font-bold text-2xl text-foreground">
 About This Event
 </h2>
 <p className="whitespace-pre-line text-muted-foreground leading-relaxed">
 {event.description}
 </p>
 </Card>

 {/* Highlights */}
 {highlights.length > 0 && (
 <Card className="border-0 p-8 shadow-lg">
 <h2 className="mb-6 font-bold text-2xl text-foreground">
 What to Expect
 </h2>
 <ul className="space-y-4">
 {highlights.map((highlight: string, index: number) => (
 <li className="flex items-start gap-3" key={index}>
 <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-brand" />
 <span className="text-muted-foreground">{highlight}</span>
 </li>
 ))}
 </ul>
 </Card>
 )}

 {/* Agenda */}
 {agenda.length > 0 && (
 <Card className="border-0 p-8 shadow-lg">
 <h2 className="mb-6 font-bold text-2xl text-foreground">
 Event Schedule
 </h2>
 <div className="space-y-6">
 {agenda.map(
 (item: { time: string; activity: string }, index: number) => (
 <div key={index}>
 <div className="flex gap-4">
 <div className="w-20 shrink-0 font-semibold text-brand">
 {item.time}
 </div>
 <div className="flex-1">
 <p className="text-muted-foreground">{item.activity}</p>
 </div>
 </div>
 {index < agenda.length - 1 && <Separator className="my-4" />}
 </div>
 )
 )}
 </div>
 </Card>
 )}
 </div>
 );
}
