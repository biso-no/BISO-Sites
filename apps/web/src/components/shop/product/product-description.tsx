import { Card } from "@repo/ui/components/ui/card";

export function ProductDescription({ description }: { description: string }) {
  return (
    <Card className="border-0 p-8 shadow-lg">
      <h2 className="mb-4 font-bold text-2xl text-foreground">
        Product Description
      </h2>
      <p className="whitespace-pre-line text-muted-foreground leading-relaxed">
        {description}
      </p>
    </Card>
  );
}
