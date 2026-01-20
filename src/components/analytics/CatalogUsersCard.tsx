import { Book, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CatalogUsersCardProps {
  count: number;
  change?: number;
  activeWithMessages: number;
  totalActive: number;
}

export function CatalogUsersCard({ count, change, activeWithMessages, totalActive }: CatalogUsersCardProps) {
  return (
    <div className="stat-card relative overflow-hidden border-t-4 border-t-warning">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-1">
            <h3 className="text-sm font-medium text-muted-foreground truncate">
              Usuários Catálogo (7d)
            </h3>
            <TooltipProvider>
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <button className="text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent 
                  side="top" 
                  className="max-w-xs bg-popover text-popover-foreground border-border"
                >
                  <p className="text-xs">
                    Usuários que usaram o catálogo (salvaram favoritos ou atualizaram preferências) 
                    mas não enviaram mensagens nos últimos 7 dias. São usuários "silenciosos" mas ativos.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-3xl font-bold font-display">
            {count.toLocaleString()}
          </p>
          <div className="flex items-center gap-2 mt-2">
            {change !== undefined && (
              <span
                className={cn(
                  "text-xs font-medium",
                  change > 0
                    ? "text-success"
                    : change < 0
                    ? "text-destructive"
                    : "text-muted-foreground"
                )}
              >
                {change > 0 ? "+" : ""}
                {change}%
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              vs período anterior
            </span>
          </div>
        </div>
        <div className="rounded-xl bg-warning/10 p-3">
          <Book className="h-5 w-5 text-warning" />
        </div>
      </div>
      
      {/* Summary breakdown */}
      <div className="mt-4 pt-3 border-t border-border/50">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Total Ativos:</span>
          <span className="font-semibold text-foreground">{totalActive.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-xs mt-1">
          <span className="text-muted-foreground">Com mensagens:</span>
          <span className="font-medium text-primary">{activeWithMessages.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-xs mt-1">
          <span className="text-muted-foreground">Só catálogo:</span>
          <span className="font-medium text-warning">{count.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
