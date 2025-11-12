import Link from "next/link";

import { listPartners, createPartner, deletePartner } from "@/app/actions/partners";
import { getCampuses } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminSummary } from "@/components/admin/admin-summary";

export default async function PartnersAdminPage() {
  const [partners, campuses] = await Promise.all([listPartners(), getCampuses()]);

  const totalPartners = partners.length;
  const nationalPartners = partners.filter((partner) => partner.level === "national").length;
  const campusPartners = partners.filter((partner) => partner.level === "campus").length;
  const campusesRepresented = new Set(partners.map((partner) => partner.campus_id).filter(Boolean)).size;

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
        title="Partneroversikt"
        description="Administrer avtaler og synlighet for samarbeidspartnere på tvers av campuser."
        metrics={summaryMetrics.map((metric) => ({
          label: metric.label,
          value: metric.value.toString(),
        }))}
        slot={
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary-70">
            BISO partnerprogram
          </div>
        }
      />

      <Card className="glass-panel border border-primary/10 shadow-[0_30px_55px_-40px_rgba(0,23,49,0.5)]">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-primary-100">Registrer partner</CardTitle>
          <CardDescription className="text-sm text-primary-60">
            Legg til nye samarbeidspartnere og tilknytt dem til riktig campus og nivå.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createPartner} className="grid gap-3 sm:grid-cols-2">
            <Input name="name" placeholder="Navn" required className="rounded-xl border-primary/20 bg-white/70 focus-visible:ring-primary-40" />
            <Input name="url" placeholder="Nettside (valgfritt)" className="rounded-xl border-primary/20 bg-white/70 focus-visible:ring-primary-40" />
            <Select name="level" defaultValue="national">
              <SelectTrigger className="rounded-xl border-primary/20 bg-white/70 text-sm">
                <SelectValue placeholder="Nivå" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="national">Nasjonal</SelectItem>
                <SelectItem value="campus">Campus</SelectItem>
              </SelectContent>
            </Select>
            <Select name="campus_id" defaultValue="none">
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
            <Input name="image_bucket" placeholder="Image bucket" defaultValue="partners" required className="rounded-xl border-primary/20 bg-white/70 focus-visible:ring-primary-40" />
            <Input name="image_file_id" placeholder="Image file id" required className="rounded-xl border-primary/20 bg-white/70 focus-visible:ring-primary-40" />
            <div className="sm:col-span-2">
              <Button type="submit" className="w-full rounded-xl bg-primary-40 text-sm font-semibold text-white shadow hover:bg-primary-30">
                Opprett partner
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="glass-panel overflow-hidden rounded-3xl border border-primary/10 bg-white/85 shadow-[0_25px_55px_-38px_rgba(0,23,49,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/10 px-6 py-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-primary-100">Alle partnere</h2>
            <p className="text-sm text-primary-60">Administrer {partners.length} avtaler på tvers av nivå og campus.</p>
          </div>
          <Button asChild variant="outline" className="rounded-full border-primary/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary-80 hover:bg-primary/5">
            <Link href="/admin/partners/new">Se offentlig visning</Link>
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-primary/5">
              <tr>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-primary-70">Navn</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-primary-70">Nivå</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-primary-70">Campus</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-primary-70">Media</th>
                <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-primary-70">Handlinger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/10">
              {partners.map((partner) => (
                <tr key={partner.$id} className="bg-white/70 transition hover:bg-primary/5">
                  <td className="px-4 py-3 font-medium text-primary-100">
                    <div className="flex flex-col">
                      <span>{partner.name}</span>
                      {partner.url && (
                        <span className="text-xs text-primary-50 truncate">{partner.url}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className="rounded-full border border-primary/20 bg-primary/5 px-3 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary-80">
                      {partner.level}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-primary-80">{(partner as any).campus?.name || "—"}</td>
                  <td className="px-4 py-3 text-primary-80">
                    {partner.image_bucket}/{partner.image_file_id}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button asChild variant="outline" size="sm" className="rounded-full border-primary/20 px-3 py-1 text-xs font-semibold text-primary-80 hover:bg-primary/5">
                        <Link href={`/admin/partners/${partner.$id}`}>Rediger</Link>
                      </Button>
                      <form action={deletePartner} className="inline-flex">
                        <input type="hidden" name="id" value={partner.$id} />
                        <Button variant="destructive" size="sm" className="rounded-full px-3 py-1 text-xs font-semibold">
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
