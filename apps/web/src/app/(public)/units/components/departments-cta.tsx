import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Award, ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";

export function DepartmentsCTA() {
  return (
    <Card className="border-0 bg-linear-to-br from-primary/10 to-primary-foreground/10 p-12 text-center shadow-xl">
      <Award className="mx-auto mb-6 h-16 w-16 text-primary" />
      <h2 className="mb-4 font-bold text-3xl text-foreground">
        Vil du gjøre en forskjell?
      </h2>
      <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
        Bli med i en av våre enheter og bidra til å skape fantastiske
        opplevelser for studenter. Enten du brenner for arrangementer,
        markedsføring, sport eller sosial påvirkning, så er det en plass for
        deg!
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Button
          asChild
          className="bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white hover:from-[#3DA9E0]/90 hover:to-[#001731]/90"
          size="lg"
        >
          <Link href="/jobs">
            Se ledige verv
            <ExternalLink className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button
          asChild
          className="border-primary/20 text-primary hover:bg-primary/10"
          size="lg"
          variant="outline"
        >
          <Link href="/contact">
            Kontakt oss
            <ChevronRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
