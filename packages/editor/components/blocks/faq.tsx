import { cn } from "@repo/ui/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import type { FAQBlockProps } from "../../types";

export function FAQ({ id, faqs, heading, description }: FAQBlockProps) {
  return (
    <div id={id} className="max-w-3xl mx-auto">
      {(heading || description) && (
        <div className="text-center mb-12">
          {heading && (
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{heading}</h2>
          )}
          {description && <p className="text-lg text-gray-600">{description}</p>}
        </div>
      )}

      <Accordion type="single" collapsible className="w-full">
        {faqs.map((faq, index) => (
          <AccordionItem key={faq.id} value={faq.id}>
            <AccordionTrigger className="text-left hover:no-underline">
              <span className="font-semibold text-gray-900">{faq.question}</span>
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

