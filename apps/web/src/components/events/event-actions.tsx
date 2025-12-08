"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { ExternalLink, Share2, Ticket } from "lucide-react";

type EventActionsProps = {
 ticketUrl?: string | null;
 title: string;
 description: string;
};

export function EventActions({
 ticketUrl,
 title,
 description,
}: EventActionsProps) {
 const handleShare = async () => {
 if (navigator.share) {
 try {
 await navigator.share({
 title,
 text: description,
 url: window.location.href,
 });
 } catch (error) {
 console.error("Error sharing:", error);
 }
 } else {
 // Fallback: copy to clipboard
 navigator.clipboard.writeText(window.location.href);
 }
 };

 return (
 <Card className="border-0 bg-linear-to-br from-brand-gradient-to to-brand-gradient-from p-6 shadow-lg">
 <h3 className="mb-4 font-bold text-white text-xl">
 {ticketUrl ? "Get Your Ticket" : "Register Now"}
 </h3>
 <p className="mb-6 text-sm text-white/90">
 {ticketUrl
 ? "Click below to purchase your ticket on Tickster and secure your spot!"
 : "Spaces are limited! Register now to guarantee your attendance."}
 </p>
 {ticketUrl ? (
 <Button
 className="mb-3 w-full bg-background text-brand-dark hover:bg-background/90"
 onClick={() => window.open(ticketUrl, "_blank")}
 >
 <Ticket className="mr-2 h-4 w-4" />
 Buy on Tickster
 <ExternalLink className="ml-2 h-4 w-4" />
 </Button>
 ) : (
 <Button className="mb-3 w-full bg-background text-brand-dark hover:bg-background/90">
 <Ticket className="mr-2 h-4 w-4" />
 Register Now
 </Button>
 )}
 <Button
 className="w-full border-white text-white hover:bg-background/10"
 onClick={handleShare}
 variant="outline"
 >
 <Share2 className="mr-2 h-4 w-4" />
 Share Event
 </Button>
 </Card>
 );
}
