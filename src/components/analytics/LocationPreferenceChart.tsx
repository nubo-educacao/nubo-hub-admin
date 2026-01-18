import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin } from "lucide-react";

const defaultColors = [
  "hsl(199, 89%, 48%)",
  "hsl(217, 91%, 60%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 87%, 65%)",
];

interface LocationPreferenceData {
  name: string;
  value: number;
  count: number;
}

async function fetchLocationPreferences(): Promise<LocationPreferenceData[]> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('location_preference')
    .not('location_preference', 'is', null);
  // Filtro de strings vazias é feito no JavaScript abaixo

  if (error) throw error;

  // Count occurrences of each preference (normalize names)
  const counts: Record<string, number> = {};
  let total = 0;

  data?.forEach((row) => {
    // Normalize: trim whitespace and capitalize first letter
    let pref = (row.location_preference || '').trim();
    if (!pref) return;
    
    // Normalize common variations
    pref = pref.charAt(0).toUpperCase() + pref.slice(1);
    
    counts[pref] = (counts[pref] || 0) + 1;
    total++;
  });

  // Convert to array with percentages, limit to top 8
  return Object.entries(counts)
    .map(([name, count]) => ({
      name,
      value: total > 0 ? Math.round((count / total) * 100) : 0,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export function LocationPreferenceChart() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["location-preferences"],
    queryFn: fetchLocationPreferences,
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="chart-container">
        <div className="mb-6 flex flex-col gap-1">
          <h3 className="text-lg font-semibold font-display">Preferência de Localização</h3>
          <p className="text-sm text-muted-foreground">
            Onde os jovens buscam oportunidades
          </p>
        </div>
        <Skeleton className="h-[250px] w-full" />
      </div>
    );
  }

  if (error || !data || data.length === 0) {
    return (
      <div className="chart-container">
        <div className="mb-6 flex flex-col gap-1">
          <h3 className="text-lg font-semibold font-display">Preferência de Localização</h3>
          <p className="text-sm text-muted-foreground">
            Onde os jovens buscam oportunidades
          </p>
        </div>
        <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground">
          <MapPin className="h-12 w-12 mb-4 opacity-50" />
          <p>Nenhuma preferência registrada</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <div className="mb-6 flex flex-col gap-1">
        <h3 className="text-lg font-semibold font-display">Preferência de Localização</h3>
        <p className="text-sm text-muted-foreground">
          Onde os jovens buscam oportunidades
        </p>
      </div>

      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={4}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={defaultColors[index % defaultColors.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.75rem",
                boxShadow: "var(--shadow-lg)",
              }}
              formatter={(value: number, name: string, props: { payload: { count: number } }) => [
                `${value}% (${props.payload.count} usuários)`,
                "Preferência"
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {data.map((item, index) => (
          <div key={item.name} className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: defaultColors[index % defaultColors.length] }}
            />
            <span className="text-sm text-muted-foreground truncate">{item.name}</span>
            <span className="text-sm font-semibold ml-auto">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
