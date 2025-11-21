"use client";

import { Linkedin, Mail } from "lucide-react";
import Link from "next/link";
import React from "react";
import { cn } from "../../lib/utils";
import { ImageWithFallback } from "../image";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

export interface TeamMember {
  name: string;
  role: string;
  image: string;
  bio?: string;
  email?: string;
  linkedin?: string;
}

export interface TeamGridProps {
  members: TeamMember[];
  columns?: 2 | 3 | 4;
  variant?: "card" | "minimal" | "circle";
}

export function TeamGrid({ members = [], columns = 3, variant = "card" }: TeamGridProps) {
  const gridCols = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className="w-full py-8">
      <div className={cn("grid gap-8", gridCols[columns])}>
        {members.map((member, index) => {
          if (variant === "card") {
            return (
              <Card
                key={index}
                className="p-6 flex flex-col items-center text-center hover:shadow-lg transition-all duration-300 group border-primary/10"
              >
                <div className="relative w-32 h-32 mb-4 rounded-full overflow-hidden border-4 border-gray-50 shadow-inner group-hover:scale-105 transition-transform duration-300">
                  <ImageWithFallback
                    src={member.image}
                    alt={member.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-1">{member.name}</h3>
                <p className="text-sm font-medium text-primary/80 mb-3 uppercase tracking-wide">
                  {member.role}
                </p>
                {member.bio && (
                  <p className="text-muted-foreground text-sm mb-4 line-clamp-3">{member.bio}</p>
                )}
                <div className="flex gap-2 mt-auto">
                  {member.email && (
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary"
                    >
                      <Link href={`mailto:${member.email}`}>
                        <Mail className="w-4 h-4" />
                      </Link>
                    </Button>
                  )}
                  {member.linkedin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      className="h-8 w-8 rounded-full hover:bg-[#0077b5]/10 hover:text-[#0077b5]"
                    >
                      <Link href={member.linkedin} target="_blank" rel="noopener noreferrer">
                        <Linkedin className="w-4 h-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              </Card>
            );
          }

          // Minimal variant
          return (
            <div key={index} className="flex flex-col items-center text-center group">
              <div className="relative w-40 h-40 mb-4 rounded-2xl overflow-hidden shadow-md group-hover:shadow-xl transition-all duration-300">
                <ImageWithFallback
                  src={member.image}
                  alt={member.name}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>
              <h3 className="text-lg font-bold">{member.name}</h3>
              <p className="text-muted-foreground text-sm">{member.role}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
