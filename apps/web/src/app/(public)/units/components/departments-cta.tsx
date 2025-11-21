import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Award, ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";

export function DepartmentsCTA() {
  return (
    <Card className="p-12 text-center border-0 shadow-xl bg-linear-to-br from-primary/10 to-primary-foreground/10">
      <Award className="w-16 h-16 text-primary mx-auto mb-6" />
      <h2 className="text-3xl font-bold text-foreground mb-4">Vil du gjøre en forskjell?</h2>
      <p className="text-muted-foreground mb-8 max-w-2xl mx-auto text-lg">
        Bli med i en av våre enheter og bidra til å skape fantastiske opplevelser for studenter.
        Enten du brenner for arrangementer, markedsføring, sport eller sosial påvirkning, så er det
        en plass for deg!
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Button
          asChild
          className="bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white"
          size="lg"
        >
          <Link href="/jobs">
            Se ledige verv
            <ExternalLink className="w-4 h-4 ml-2" />
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="border-primary/20 text-primary hover:bg-primary/10"
          size="lg"
        >
          <Link href="/contact">
            Kontakt oss
            <ChevronRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
