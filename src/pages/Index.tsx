import { Users, MessageSquare, Heart, TrendingUp, AlertTriangle, Clock } from "lucide-react";
import { DashboardHeader } from "@/components/analytics/DashboardHeader";
import { StatCard } from "@/components/analytics/StatCard";
import { ActivityChart } from "@/components/analytics/ActivityChart";
import { TopCoursesChart } from "@/components/analytics/TopCoursesChart";
import { ErrorLogPanel } from "@/components/analytics/ErrorLogPanel";
import { FlowFunnelChart } from "@/components/analytics/FlowFunnelChart";
import { UserPreferencesChart } from "@/components/analytics/UserPreferencesChart";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <main className="container py-6 space-y-6">
        {/* Stats Overview */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Usuários Ativos"
            value="2,847"
            change={12.5}
            icon={Users}
            variant="default"
          />
          <StatCard
            title="Total de Mensagens"
            value="18.4k"
            change={8.2}
            icon={MessageSquare}
            variant="default"
          />
          <StatCard
            title="Favoritos Salvos"
            value="5,621"
            change={23.1}
            icon={Heart}
            variant="success"
          />
          <StatCard
            title="Erros Hoje"
            value="23"
            change={-15}
            changeLabel="menos que ontem"
            icon={AlertTriangle}
            variant="warning"
          />
        </section>

        {/* Charts Row 1 */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ActivityChart />
          <TopCoursesChart />
        </section>

        {/* Charts Row 2 */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <FlowFunnelChart />
          <UserPreferencesChart />
          <ErrorLogPanel />
        </section>

        {/* Quick Insights */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="stat-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-success/10 p-2">
                <TrendingUp className="h-4 w-4 text-success" />
              </div>
              <h4 className="font-semibold">Engajamento em Alta</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Usuários estão passando em média <span className="font-semibold text-foreground">12 min</span> por
              sessão, 20% mais que a semana passada.
            </p>
          </div>

          <div className="stat-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-warning/10 p-2">
                <Clock className="h-4 w-4 text-warning" />
              </div>
              <h4 className="font-semibold">Pico de Uso</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              O horário de maior atividade é entre <span className="font-semibold text-foreground">19h e 21h</span>,
              principalmente nos dias de semana.
            </p>
          </div>

          <div className="stat-card sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <MessageSquare className="h-4 w-4 text-primary" />
              </div>
              <h4 className="font-semibold">Top Pergunta</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">"Qual minha chance no SISU?"</span> foi a pergunta
              mais frequente, aparecendo 340 vezes.
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
