import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const data = [
  { name: "SISU", value: 45, color: "hsl(199, 89%, 48%)" },
  { name: "ProUni", value: 35, color: "hsl(142, 71%, 45%)" },
  { name: "FIES", value: 15, color: "hsl(38, 92%, 50%)" },
  { name: "Vestibular", value: 5, color: "hsl(280, 87%, 65%)" },
];

export function UserPreferencesChart() {
  return (
    <div className="chart-container">
      <div className="mb-6 flex flex-col gap-1">
        <h3 className="text-lg font-semibold font-display">Preferências de Acesso</h3>
        <p className="text-sm text-muted-foreground">
          Distribuição por tipo de ingresso
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
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.75rem",
                boxShadow: "var(--shadow-lg)",
              }}
              formatter={(value: number) => [`${value}%`, "Percentual"]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-sm text-muted-foreground">{item.name}</span>
            <span className="text-sm font-semibold ml-auto">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
