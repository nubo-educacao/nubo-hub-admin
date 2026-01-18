import { AlertCircle, AlertTriangle, Info, Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ErrorLog {
  id: string;
  type: "error" | "warning" | "info";
  message: string;
  endpoint?: string;
  timestamp: string;
  count?: number;
}

const mockErrors: ErrorLog[] = [
  {
    id: "1",
    type: "error",
    message: "Falha na função de matching de cursos",
    endpoint: "/functions/match-courses",
    timestamp: "2 min atrás",
    count: 3,
  },
  {
    id: "2",
    type: "warning",
    message: "Timeout na busca de instituições",
    endpoint: "/functions/search-institutions",
    timestamp: "15 min atrás",
    count: 7,
  },
  {
    id: "3",
    type: "error",
    message: "Input malformado no perfil do usuário",
    endpoint: "/api/user-profile",
    timestamp: "32 min atrás",
  },
  {
    id: "4",
    type: "info",
    message: "Fallback ativado na resposta do assistente",
    endpoint: "/functions/chat-response",
    timestamp: "1h atrás",
    count: 12,
  },
  {
    id: "5",
    type: "warning",
    message: "Rate limit próximo do limite",
    endpoint: "/api/recommendations",
    timestamp: "2h atrás",
  },
];

const typeConfig = {
  error: {
    icon: AlertCircle,
    bgClass: "bg-destructive/10",
    textClass: "text-destructive",
    badgeClass: "bg-destructive/10 text-destructive",
  },
  warning: {
    icon: AlertTriangle,
    bgClass: "bg-warning/10",
    textClass: "text-warning",
    badgeClass: "bg-warning/10 text-warning",
  },
  info: {
    icon: Info,
    bgClass: "bg-primary/10",
    textClass: "text-primary",
    badgeClass: "bg-primary/10 text-primary",
  },
};

export function ErrorLogPanel() {
  return (
    <div className="chart-container flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold font-display">Logs de Erros</h3>
          <p className="text-sm text-muted-foreground">
            Últimos incidentes registrados
          </p>
        </div>
        <button className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          Ver todos
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      
      <ScrollArea className="flex-1 -mx-2 px-2">
        <div className="space-y-3">
          {mockErrors.map((error, index) => {
            const config = typeConfig[error.type];
            const Icon = config.icon;
            
            return (
              <div
                key={error.id}
                className={cn(
                  "group cursor-pointer rounded-lg border p-4 transition-all hover:shadow-md",
                  "opacity-0 animate-fade-in"
                )}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("rounded-lg p-2", config.bgClass)}>
                    <Icon className={cn("h-4 w-4", config.textClass)} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">
                        {error.message}
                      </p>
                      {error.count && error.count > 1 && (
                        <span className={cn("error-badge", config.badgeClass)}>
                          ×{error.count}
                        </span>
                      )}
                    </div>
                    
                    {error.endpoint && (
                      <p className="mt-1 text-xs text-muted-foreground font-mono truncate">
                        {error.endpoint}
                      </p>
                    )}
                    
                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {error.timestamp}
                    </div>
                  </div>
                  
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
