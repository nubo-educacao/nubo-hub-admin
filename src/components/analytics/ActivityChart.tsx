import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { name: "Seg", mensagens: 240, usuarios: 45 },
  { name: "Ter", mensagens: 380, usuarios: 62 },
  { name: "Qua", mensagens: 520, usuarios: 78 },
  { name: "Qui", mensagens: 450, usuarios: 71 },
  { name: "Sex", mensagens: 680, usuarios: 95 },
  { name: "Sáb", mensagens: 320, usuarios: 48 },
  { name: "Dom", mensagens: 180, usuarios: 32 },
];

export function ActivityChart() {
  return (
    <div className="chart-container">
      <div className="mb-6 flex flex-col gap-1">
        <h3 className="text-lg font-semibold font-display">Atividade Semanal</h3>
        <p className="text-sm text-muted-foreground">
          Mensagens e usuários ativos por dia
        </p>
      </div>
      
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorMensagens" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorUsuarios" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              className="text-muted-foreground"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.75rem",
                boxShadow: "var(--shadow-lg)",
              }}
              labelStyle={{ fontWeight: 600 }}
            />
            <Area
              type="monotone"
              dataKey="mensagens"
              stroke="hsl(199, 89%, 48%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorMensagens)"
              name="Mensagens"
            />
            <Area
              type="monotone"
              dataKey="usuarios"
              stroke="hsl(217, 91%, 60%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorUsuarios)"
              name="Usuários"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-4 flex items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-primary" />
          <span className="text-sm text-muted-foreground">Mensagens</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-chart-2" />
          <span className="text-sm text-muted-foreground">Usuários</span>
        </div>
      </div>
    </div>
  );
}
