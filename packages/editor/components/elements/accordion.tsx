import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@repo/ui/components/ui/accordion";
import type { AccordionElementProps } from "../../types";

export function AccordionElement({
  id,
  items,
  type = "single",
}: AccordionElementProps) {
  if (items.length === 0) {
    return (
      <div id={id} className="text-center text-gray-500 p-6 border rounded-lg">
        Add accordion items in the settings
      </div>
    );
  }

  return (
    <Accordion id={id} type={type} collapsible={type === "single"}>
      {items.map((item) => (
        <AccordionItem key={item.id} value={item.id}>
          <AccordionTrigger>{item.title}</AccordionTrigger>
          <AccordionContent>
            <div className="prose max-w-none">{item.content}</div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

