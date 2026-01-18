import { Users, MessageSquare, Heart, TrendingUp, Clock, MapPin } from "lucide-react";
import { DashboardHeader } from "@/components/analytics/DashboardHeader";
import { StatCard } from "@/components/analytics/StatCard";
import { ActivityChart } from "@/components/analytics/ActivityChart";
import { TopCoursesChart } from "@/components/analytics/TopCoursesChart";
import { FlowFunnelChart } from "@/components/analytics/FlowFunnelChart";
import { UserPreferencesChart } from "@/components/analytics/UserPreferencesChart";
import { TopUsersChart } from "@/components/analytics/TopUsersChart";
import { LocationChart } from "@/components/analytics/LocationChart";
import { ChatExamplesPanel } from "@/components/analytics/ChatExamplesPanel";
import { useDashboardStats } from "@/hooks/useAnalyticsData";
import { Skeleton } from "@/components/ui/skeleton";

const Index = () => {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <main className="container py-6 space-y-6">
        {/* Stats Overview */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {statsLoading ? (
            <>
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </>
          ) : (
            <>
              <StatCard
                title="Usuários Ativos (7d)"
                value={stats?.activeUsers.toLocaleString() || "0"}
                change={stats?.activeUsersChange}
                icon={Users}
                variant="default"
              />
              <StatCard
                title="Total de Mensagens"
                value={stats?.totalMessages.toLocaleString() || "0"}
                change={stats?.messagesChange}
                icon={MessageSquare}
                variant="default"
              />
              <StatCard
                title="Favoritos Salvos"
                value={stats?.totalFavorites?.toLocaleString() || "0"}
                change={stats?.favoritesChange}
                icon={Heart}
                variant="success"
              />
            </>
          )}
        </section>

        {/* Charts Row 1 */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ActivityChart />
          <TopCoursesChart />
        </section>

        {/* Charts Row 2 - Rankings */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <TopUsersChart />
          <FlowFunnelChart />
        </section>

        {/* Charts Row 3 */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <LocationChart />
          <UserPreferencesChart />
        </section>

        {/* Chat Examples */}
        <section className="grid grid-cols-1 gap-6">
          <ChatExamplesPanel />
        </section>

        {/* Quick Insights */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="stat-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-success/10 p-2">
                <TrendingUp className="h-4 w-4 text-success" />
              </div>
              <h4 className="font-semibold">Dados em Tempo Real</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Os dados são atualizados automaticamente a cada <span className="font-semibold text-foreground">5 minutos</span>.
              Métricas baseadas nos últimos 7 dias.
            </p>
          </div>

          <div className="stat-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-warning/10 p-2">
                <Clock className="h-4 w-4 text-warning" />
              </div>
              <h4 className="font-semibold">Período de Análise</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Comparações são feitas entre a <span className="font-semibold text-foreground">semana atual</span> e a 
              semana anterior para identificar tendências.
            </p>
          </div>

          <div className="stat-card sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <h4 className="font-semibold">Conectado ao Supabase</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Dashboard conectado ao banco <span className="font-semibold text-foreground">nubo-hub-prod</span> com 
              dados reais da plataforma Cloudinha.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 mt-8">
        <div className="container py-6">
          <p className="text-center text-sm text-muted-foreground">
            Cloudinha Analytics · Nubo Educação © 2026
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
