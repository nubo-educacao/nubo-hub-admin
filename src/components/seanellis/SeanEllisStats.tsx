
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeanEllisStats } from "@/services/seanEllisService";
import { Loader2 } from "lucide-react";
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
    Legend
} from "recharts";

interface SeanEllisStatsProps {
    stats: SeanEllisStats | undefined;
    isLoading: boolean;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export function SeanEllisStatsDisplay({ stats, isLoading }: SeanEllisStatsProps) {
    if (isLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3].map((i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Loading...</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Loader2 className="h-4 w-4 animate-spin" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    if (!stats) return null;

    const pieData = Object.entries(stats.disappointment_distribution || {}).map(([name, value]) => ({
        name: name || "Não respondeu",
        value
    }));

    return (
        <div className="grid gap-4 md:grid-cols-3">
            {/* Graph Section - Takes 2/3 (col-span-2) */}
            <Card className="col-span-2">
                <CardContent className="h-[300px] pt-6">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend layout="vertical" align="right" verticalAlign="middle" />
                        </PieChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Stats Section - Takes 1/3 (col-span-1) */}
            <div className="space-y-4 col-span-1">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total de Respondentes
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total_respondents}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Usuários Identificados
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total_identified_users}</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.total_respondents > 0 ? ((stats.total_identified_users / stats.total_respondents) * 100).toFixed(1) : 0}% do total
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
