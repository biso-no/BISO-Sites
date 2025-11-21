import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import Link from "next/link";
import { getCampuses } from "@/app/actions/admin";
import {
  createPartner,
  deletePartner,
  listPartners,
} from "@/app/actions/partners";
import { AdminSummary } from "@/components/admin/admin-summary";

export default async function PartnersAdminPage() {
  const [partners, campuses] = await Promise.all([
    listPartners(),
    getCampuses(),
  ]);

  const totalPartners = partners.length;
  const nationalPartners = partners.filter(
    (partner) => partner.level === "national"
  ).length;
  const campusPartners = partners.filter(
    (partner) => partner.level === "campus"
  ).length;
  const campusesRepresented = new Set(
    partners.map((partner) => partner.campus_id).filter(Boolean)
  ).size;

  const summaryMetrics = [
    { label: "Totalt", value: totalPartners },
    { label: "Nasjonale", value: nationalPartners },
    { label: "Campus", value: campusPartners },
    { label: "Campuser", value: campusesRepresented },
  ];

  return (
    <div className="space-y-8">
      <AdminSummary
        badge="Partnere"
        description="Administrer avtaler og synlighet for samarbeidspartnere på tvers av campuser."
        metrics={summaryMetrics.map((metric) => ({
          label: metric.label,
          value: metric.value.toString(),
        }))}
        slot={
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 font-semibold text-primary-70 text-xs uppercase tracking-[0.16em]">
            BISO partnerprogram
          </div>
        }
        title="Partneroversikt"
      />

      <Card className="glass-panel border border-primary/10 shadow-[0_30px_55px_-40px_rgba(0,23,49,0.5)]">
        <CardHeader className="pb-4">
          <CardTitle className="font-semibold text-lg text-primary-100">
            Registrer partner
          </CardTitle>
          <CardDescription className="text-primary-60 text-sm">
            Legg til nye samarbeidspartnere og tilknytt dem til riktig campus og
            nivå.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createPartner} className="grid gap-3 sm:grid-cols-2">
            <Input
              className="rounded-xl border-primary/20 bg-white/70 focus-visible:ring-primary-40"
              name="name"
              placeholder="Navn"
              required
            />
            <Input
              className="rounded-xl border-primary/20 bg-white/70 focus-visible:ring-primary-40"
              name="url"
              placeholder="Nettside (valgfritt)"
            />
            <Select defaultValue="national" name="level">
              <SelectTrigger className="rounded-xl border-primary/20 bg-white/70 text-sm">
                <SelectValue placeholder="Nivå" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="national">Nasjonal</SelectItem>
                <SelectItem value="campus">Campus</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="none" name="campus_id">
              <SelectTrigger className="rounded-xl border-primary/20 bg-white/70 text-sm">
                <SelectValue placeholder="Campus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ingen</SelectItem>
                {campuses.map((campus) => (
                  <SelectItem key={campus.$id} value={campus.$id}>
                    {campus.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="rounded-xl border-primary/20 bg-white/70 focus-visible:ring-primary-40"
              defaultValue="partners"
              name="image_bucket"
              placeholder="Image bucket"
              required
            />
            <Input
              className="rounded-xl border-primary/20 bg-white/70 focus-visible:ring-primary-40"
              name="image_file_id"
              placeholder="Image file id"
              required
            />
            <div className="sm:col-span-2">
              <Button
                className="w-full rounded-xl bg-primary-40 font-semibold text-sm text-white shadow hover:bg-primary-30"
                type="submit"
              >
                Opprett partner
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="glass-panel overflow-hidden rounded-3xl border border-primary/10 bg-white/85 shadow-[0_25px_55px_-38px_rgba(0,23,49,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-primary/10 border-b px-6 py-4">
          <div className="space-y-1">
            <h2 className="font-semibold text-lg text-primary-100">
              Alle partnere
            </h2>
            <p className="text-primary-60 text-sm">
              Administrer {partners.length} avtaler på tvers av nivå og campus.
            </p>
          </div>
          <Button
            asChild
            className="rounded-full border-primary/20 px-3 py-1 font-semibold text-primary-80 text-xs uppercase tracking-[0.14em] hover:bg-primary/5"
            variant="outline"
          >
            <Link href="/admin/partners/new">Se offentlig visning</Link>
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-primary/5">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-primary-70 uppercase tracking-wide">
                  Navn
                </th>
                <th className="px-4 py-3 text-left font-semibold text-primary-70 uppercase tracking-wide">
                  Nivå
                </th>
                <th className="px-4 py-3 text-left font-semibold text-primary-70 uppercase tracking-wide">
                  Campus
                </th>
                <th className="px-4 py-3 text-left font-semibold text-primary-70 uppercase tracking-wide">
                  Media
                </th>
                <th className="px-4 py-3 text-right font-semibold text-primary-70 uppercase tracking-wide">
                  Handlinger
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/10">
              {partners.map((partner) => (
                <tr
                  className="bg-white/70 transition hover:bg-primary/5"
                  key={partner.$id}
                >
                  <td className="px-4 py-3 font-medium text-primary-100">
                    <div className="flex flex-col">
                      <span>{partner.name}</span>
                      {partner.url && (
                        <span className="truncate text-primary-50 text-xs">
                          {partner.url}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className="rounded-full border border-primary/20 bg-primary/5 px-3 py-0.5 font-semibold text-primary-80 text-xs uppercase tracking-wide">
                      {partner.level}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-primary-80">
                    {(partner as any).campus?.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-primary-80">
                    {partner.image_bucket}/{partner.image_file_id}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        asChild
                        className="rounded-full border-primary/20 px-3 py-1 font-semibold text-primary-80 text-xs hover:bg-primary/5"
                        size="sm"
                        variant="outline"
                      >
                        <Link href={`/admin/partners/${partner.$id}`}>
                          Rediger
                        </Link>
                      </Button>
                      <form action={deletePartner} className="inline-flex">
                        <input name="id" type="hidden" value={partner.$id} />
                        <Button
                          className="rounded-full px-3 py-1 font-semibold text-xs"
                          size="sm"
                          variant="destructive"
                        >
                          Slett
                        </Button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
