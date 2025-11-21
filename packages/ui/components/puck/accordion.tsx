"use client";

import {
  AccordionContent,
  AccordionItem,
  Accordion as AccordionRoot,
  AccordionTrigger,
} from "../ui/accordion";

export type AccordionItemProps = {
  title: string;
  content: string;
};

export type AccordionBlockProps = {
  items: AccordionItemProps[];
  type?: "single" | "multiple";
};

export function AccordionBlock({
  items = [],
  type = "single",
}: AccordionBlockProps) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <AccordionRoot
        collapsible
        type={type === "single" ? "single" : "multiple"}
      >
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
