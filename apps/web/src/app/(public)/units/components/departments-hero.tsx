import { ImageWithFallback } from "@repo/ui/components/image";
import { Building2 } from "lucide-react";

interface DepartmentsHeroProps {
  stats: {
    totalDepartments: number;
    totalMembers: number;
    totalCampuses: number;
  };
}

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
        src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWFtJTIwd29ya2luZ3xlbnwxfHx8fDE3NjIxNjUxNDV8MA&ixlib=rb-4.1.0&q=80&w=1080"
        alt="BISO Enheter"
        fill
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/70 to-[#001731]/90" />

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-16 h-16 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-white text-5xl font-bold mb-0">Våre enheter</h1>
          </div>
          <p className="text-white/90 max-w-2xl mx-auto mb-8 text-lg">
            Utforsk studentdrevne enheter innen alt fra festivaler og finans til politikk og
            velferd. Finn enheten som matcher dine ambisjoner!
          </p>

          {/* Stats */}
          <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {statsData.map((stat) => (
              <div
                key={stat.label}
                className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20"
              >
                <div className="text-3xl font-bold text-white mb-2">{stat.value}</div>
                <p className="text-white/80 text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
