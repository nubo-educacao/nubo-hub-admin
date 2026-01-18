import { useTopUsers } from "@/hooks/useAnalyticsData";
import { User, MessageSquare, Heart, Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

export function TopUsersChart() {
  const { data: users, isLoading, error } = useTopUsers();

  if (isLoading) {
    return (
      <div className="chart-container">
        <div className="mb-6 flex flex-col gap-1">
          <h3 className="text-lg font-semibold font-display">Usuários Engajados</h3>
          <p className="text-sm text-muted-foreground">Todos os usuários ordenados por engajamento</p>
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !users || users.length === 0) {
    return (
      <div className="chart-container">
        <div className="mb-6 flex flex-col gap-1">
          <h3 className="text-lg font-semibold font-display">Usuários Engajados</h3>
          <p className="text-sm text-muted-foreground">Todos os usuários ordenados por engajamento</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <User className="h-12 w-12 mb-4 opacity-50" />
          <p>Nenhum dado de usuário disponível</p>
        </div>
      </div>
    );
  }

  const maxScore = users[0]?.score || 1;

  return (
    <div className="chart-container">
      <div className="mb-6 flex flex-col gap-1">
        <h3 className="text-lg font-semibold font-display">Usuários Engajados</h3>
        <p className="text-sm text-muted-foreground">
          {users.length} usuários ordenados por engajamento
        </p>
      </div>

      <ScrollArea className="h-[500px] pr-4">
        <div className="space-y-3">
          {users.map((user, index) => {
            const percentage = (user.score / maxScore) * 100;
            const isTop3 = index < 3;

            return (
              <div
                key={user.id}
                className={cn(
                  "relative rounded-lg border p-4 transition-all hover:shadow-md opacity-0 animate-fade-in",
                  isTop3 && "border-primary/30 bg-primary/5"
                )}
                style={{ animationDelay: `${Math.min(index * 50, 500)}ms` }}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                    index === 0 && "bg-amber-500 text-white",
                    index === 1 && "bg-slate-400 text-white",
                    index === 2 && "bg-amber-700 text-white",
                    index > 2 && "bg-muted text-muted-foreground"
                  )}>
                    {index === 0 ? <Trophy className="h-4 w-4" /> : index + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate block">{user.name}</span>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {user.messages} msgs
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {user.favorites} favs
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-lg font-bold text-primary">{user.score}</span>
                    <p className="text-xs text-muted-foreground">pontos</p>
                  </div>
                </div>

                <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-chart-2 transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
