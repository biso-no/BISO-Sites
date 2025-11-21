import { ImageWithFallback } from "@repo/ui/components/image";
import { Building2 } from "lucide-react";

type DepartmentsHeroProps = {
  stats: {
    totalDepartments: number;
    totalMembers: number;
    totalCampuses: number;
  };
};

export function DepartmentsHero({ stats }: DepartmentsHeroProps) {
  const statsData = [
    {
      label: "Aktive enheter",
      value: stats.totalDepartments || "--",
    },
    {
      label: "Aktive medlemmer",
      value: stats.totalMembers ? `${stats.totalMembers}+` : "--",
    },
    {
      label: "Campuser",
      value: stats.totalCampuses || "--",
    },
  ];

  return (
    <div className="relative h-[50vh] overflow-hidden">
      <ImageWithFallback
        alt="BISO Enheter"
        className="h-full w-full object-cover"
        fill
        src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWFtJTIwd29ya2luZ3xlbnwxfHx8fDE3NjIxNjUxNDV8MA&ixlib=rb-4.1.0&q=80&w=1080"
      />
      <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/70 to-[#001731]/90" />

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <div className="mb-6 flex items-center justify-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <h1 className="mb-0 font-bold text-5xl text-white">Våre enheter</h1>
          </div>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-white/90">
            Utforsk studentdrevne enheter innen alt fra festivaler og finans til
            politikk og velferd. Finn enheten som matcher dine ambisjoner!
          </p>

          {/* Stats */}
          <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-3">
            {statsData.map((stat) => (
              <div
                className="rounded-lg border border-white/20 bg-white/10 p-6 backdrop-blur-sm"
                key={stat.label}
              >
                <div className="mb-2 font-bold text-3xl text-white">
                  {stat.value}
                </div>
                <p className="text-sm text-white/80">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
