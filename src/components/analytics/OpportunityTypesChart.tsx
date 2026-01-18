import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from "recharts";
import { Sparkles, TrendingUp, GraduationCap, Award } from "lucide-react";
import { useOpportunityTypes } from "@/hooks/useAnalyticsData";

const COLORS = {
  sisu: "hsl(var(--chart-1))",
  prouni: "hsl(var(--chart-5))",
  ambos: "hsl(var(--chart-3))",
  default: "hsl(var(--muted-foreground))",
};

export function OpportunityTypesChart() {
  const { data, isLoading, error } = useOpportunityTypes();

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Award className="h-5 w-5 text-primary" />
            Tipos de Oportunidades
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
          <Award className="h-12 w-12 mb-4 opacity-50" />
          <p className="text-sm">Erro ao carregar dados</p>
        </CardContent>
      </Card>
    );
  }

  const getBarColor = (name: string) => {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('sisu')) return COLORS.sisu;
    if (nameLower.includes('prouni')) return COLORS.prouni;
    if (nameLower.includes('ambos')) return COLORS.ambos;
    return COLORS.default;
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Tipos de Oportunidades
          </div>
          <Badge variant="outline" className="text-xs font-normal">
            Preferências dos Usuários
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Destaque: Vagas Ociosas */}
        <div className="rounded-lg bg-success/10 border border-success/20 p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-success/20 p-2">
                <Sparkles className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-success font-medium uppercase tracking-wide">
                  Vagas Ociosas SISU 2025
                </p>
                <p className="text-2xl font-bold text-success">
                  {data.vagasOciosas.total.toLocaleString()}
                </p>
              </div>
            </div>
            <Badge className="bg-success/20 text-success border-success/30 hover:bg-success/30">
              Disponíveis agora
            </Badge>
          </div>
          
          {/* Mini breakdown */}
          <div className="mt-3 pt-3 border-t border-success/20">
            <p className="text-xs text-muted-foreground mb-2">Top modalidades com vagas:</p>
            <div className="flex flex-wrap gap-1.5">
              {data.vagasOciosas.byModality.slice(0, 4).map((item) => (
                <Badge 
                  key={item.name} 
                  variant="secondary" 
                  className="text-xs font-normal"
                >
                  {item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name}: {item.count.toLocaleString()}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Preferências dos Usuários */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Programa de Interesse</p>
          </div>
          
          {data.programPreferences.length > 0 ? (
            <ResponsiveContainer width="100%" height={120}>
              <BarChart
                data={data.programPreferences}
                layout="vertical"
                margin={{ top: 0, right: 30, left: 60, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  width={55}
                />
                <Tooltip
                  formatter={(value: number, name: string, props: { payload: { percentage: number } }) => [
                    `${value} usuários (${props.payload.percentage}%)`,
                    'Preferência'
                  ]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  {data.programPreferences.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getBarColor(entry.name)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[120px] text-muted-foreground text-sm">
              Nenhuma preferência registrada
            </div>
          )}
        </div>

        {/* Total de Oportunidades */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.sisu }} />
              <span className="text-xs text-muted-foreground">SISU</span>
            </div>
            <p className="text-lg font-semibold">
              {data.totalOpportunities.sisu.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">vagas totais</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.prouni }} />
              <span className="text-xs text-muted-foreground">ProUni</span>
            </div>
            <p className="text-lg font-semibold">
              {data.totalOpportunities.prouni.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">bolsas totais</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
