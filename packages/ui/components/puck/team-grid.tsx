"use client";

import { Linkedin, Mail } from "lucide-react";
import Link from "next/link";
import { cn } from "../../lib/utils";
import { ImageWithFallback } from "../image";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

export type TeamMember = {
  name: string;
  role: string;
  image: string;
  bio?: string;
  email?: string;
  linkedin?: string;
};

export type TeamGridProps = {
  members: TeamMember[];
  columns?: 2 | 3 | 4;
  variant?: "card" | "minimal" | "circle";
};

export function TeamGrid({
  members = [],
  columns = 3,
  variant = "card",
}: TeamGridProps) {
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
                className="group flex flex-col items-center border-primary/10 p-6 text-center transition-all duration-300 hover:shadow-lg"
                key={index}
              >
                <div className="relative mb-4 h-32 w-32 overflow-hidden rounded-full border-4 border-gray-50 shadow-inner transition-transform duration-300 group-hover:scale-105">
                  <ImageWithFallback
                    alt={member.name}
                    className="object-cover"
                    fill
                    src={member.image}
                  />
                </div>
                <h3 className="mb-1 font-bold text-foreground text-xl">
                  {member.name}
                </h3>
                <p className="mb-3 font-medium text-primary/80 text-sm uppercase tracking-wide">
                  {member.role}
                </p>
                {member.bio && (
                  <p className="mb-4 line-clamp-3 text-muted-foreground text-sm">
                    {member.bio}
                  </p>
                )}
                <div className="mt-auto flex gap-2">
                  {member.email && (
                    <Button
                      asChild
                      className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary"
                      size="icon"
                      variant="ghost"
                    >
                      <Link href={`mailto:${member.email}`}>
                        <Mail className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                  {member.linkedin && (
                    <Button
                      asChild
                      className="h-8 w-8 rounded-full hover:bg-[#0077b5]/10 hover:text-[#0077b5]"
                      size="icon"
                      variant="ghost"
                    >
                      <Link
                        href={member.linkedin}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <Linkedin className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              </Card>
            );
          }

          // Minimal variant
          return (
            <div
              className="group flex flex-col items-center text-center"
              key={index}
            >
              <div className="relative mb-4 h-40 w-40 overflow-hidden rounded-2xl shadow-md transition-all duration-300 group-hover:shadow-xl">
                <ImageWithFallback
                  alt={member.name}
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                  fill
                  src={member.image}
                />
              </div>
              <h3 className="font-bold text-lg">{member.name}</h3>
              <p className="text-muted-foreground text-sm">{member.role}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
