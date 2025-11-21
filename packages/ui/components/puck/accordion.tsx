"use client";

import React from "react";
import {
  Accordion as AccordionRoot,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";

export interface AccordionItemProps {
  title: string;
  content: string;
}

export interface AccordionBlockProps {
  items: AccordionItemProps[];
  type?: "single" | "multiple";
}

export function AccordionBlock({
  items = [],
  type = "single",
}: AccordionBlockProps) {
  return (
    <div className="w-full max-w-3xl mx-auto">
      <AccordionRoot type={type === "single" ? "single" : "multiple"} collapsible>
        {items.map((item, index) => (
          <AccordionItem key={index} value={`item-${index}`}>
            <AccordionTrigger>{item.title}</AccordionTrigger>
            <AccordionContent>
              <div className="prose prose-sm max-w-none text-muted-foreground">
                {item.content}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </AccordionRoot>
    </div>
  );
}
