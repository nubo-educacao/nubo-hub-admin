import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getAdminFunnelChart,
  getAdminPassportPhases,
  getAdminFurthestPassportPhases,
  getPartnerFunnel,
  getPartnerApplicationBuckets,
  getStudentApplicationsOverTime
} from "@/services/passportDashboardService";
import { Loader2 } from "lucide-react";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function PassportDashboard() {
  const { data: funnelData, isLoading: isLoadingFunnel } = useQuery({
    queryKey: ["adminFunnelChart"],
    queryFn: getAdminFunnelChart,
  });

  const { data: phasesData, isLoading: isLoadingPhases } = useQuery({
    queryKey: ["adminPassportPhases"],
    queryFn: getAdminPassportPhases,
  });

  const { data: furthestPhasesData, isLoading: isLoadingFurthest } = useQuery({
    queryKey: ["adminFurthestPassportPhases"],
    queryFn: getAdminFurthestPassportPhases,
  });

  const { data: partnerFunnelData, isLoading: isLoadingPartnerFunnel } = useQuery({
    queryKey: ["partnerFunnel"],
    queryFn: getPartnerFunnel,
  });

  const { data: bucketsData, isLoading: isLoadingBuckets } = useQuery({
    queryKey: ["partnerApplicationBuckets"],
    queryFn: () => getPartnerApplicationBuckets(), // Fetching all for now
  });

  const { data: overTimeData, isLoading: isLoadingOverTime } = useQuery({
    queryKey: ["studentApplicationsOverTime"],
    queryFn: getStudentApplicationsOverTime,
  });

  // Process buckets data to group by completing bucket regardless of partner for a global view
  const globalBuckets = React.useMemo(() => {
    if (!bucketsData) return [];
    const grouped = bucketsData.reduce((acc, curr) => {
      acc[curr.completion_bucket] = (acc[curr.completion_bucket] || 0) + curr.applications_count;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.keys(grouped).sort().map(bucket => ({
      name: bucket,
      count: grouped[bucket]
    }));
  }, [bucketsData]);

  if (isLoadingFunnel || isLoadingPhases || isLoadingFurthest || isLoadingPartnerFunnel || isLoadingBuckets || isLoadingOverTime) {
    return (
      <div className="flex justify-center items-center h-full min-h-[500px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard do Passaporte</h1>
        <p className="text-muted-foreground mt-2">
          Visão consolidada do fluxo do passaporte de elegibilidade, do cadastro até a submissão das candidaturas.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funil Principal */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Funil de Conversão (Global)</CardTitle>
            <CardDescription>Usuários ativos e candidaturas desde o lançamento do Passaporte (09/03).</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={funnelData}
                layout="vertical"
                margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="step_name" type="category" width={150} />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar dataKey="user_count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Usuários" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Candidaturas ao Longo do Tempo */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Candidaturas ao Longo do Tempo</CardTitle>
            <CardDescription>Volume de novas candidaturas criadas diariamente.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={overTimeData}
                margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#8b5cf6" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: "#8b5cf6" }} 
                  activeDot={{ r: 6 }} 
                  name="Novas Candidaturas" 
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Fase Atual do Passaporte */}
        <Card>
          <CardHeader>
            <CardTitle>Fase Atual do Passaporte</CardTitle>
            <CardDescription>Onde os usuários estão parados neste momento.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={phasesData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="total_users"
                  nameKey="passport_phase"
                  label={({ passport_phase, percent }) => `${passport_phase}: ${(percent * 100).toFixed(0)}%`}
                >
                  {phasesData?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Fase Mais Avançada */}
        <Card>
          <CardHeader>
            <CardTitle>Fase Mais Avançada Alcançada</CardTitle>
            <CardDescription>O mais longe que o usuário já chegou (Métrica de Sucesso).</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={furthestPhasesData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#82ca9d"
                  dataKey="total_users"
                  nameKey="furthest_passport_phase"
                  label={({ furthest_passport_phase, percent }) => `${furthest_passport_phase}: ${(percent * 100).toFixed(0)}%`}
                >
                  {furthestPhasesData?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Desempenho dos Formulários dos Parceiros */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Progresso de Preenchimento dos Formulários</CardTitle>
            <CardDescription>Candidaturas distribuídas por porcentagem de conclusão.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={globalBuckets}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Candidaturas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tabela de Conversão de Parceiros */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Funil por Parceiro Institucional</CardTitle>
            <CardDescription>Conversão de cliques no Explorar até Candidatura Submetida.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parceiro</TableHead>
                  <TableHead className="text-right">Cliques</TableHead>
                  <TableHead className="text-right">Iniciadas</TableHead>
                  <TableHead className="text-right">Concluídas</TableHead>
                  <TableHead className="text-right">Tx Conversão (Iniciada ➔ Concluída)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partnerFunnelData?.map((row) => (
                  <TableRow key={row.partner_id}>
                    <TableCell className="font-medium">{row.partner_name || 'Desconhecido'}</TableCell>
                    <TableCell className="text-right">{row.total_unique_clicks}</TableCell>
                    <TableCell className="text-right">{row.total_applications_started}</TableCell>
                    <TableCell className="text-right">{row.total_applications_submitted}</TableCell>
                    <TableCell className="text-right">
                      {row.total_applications_started > 0 
                        ? `${((row.total_applications_submitted / row.total_applications_started) * 100).toFixed(1)}%` 
                        : '0%'}
                    </TableCell>
                  </TableRow>
                ))}
                {(!partnerFunnelData || partnerFunnelData.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                      Nenhum dado encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
