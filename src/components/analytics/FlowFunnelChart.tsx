import { cn } from "@/lib/utils";
import { useFunnelData } from "@/hooks/useAnalyticsData";
import { Skeleton } from "@/components/ui/skeleton";
import { GitBranch } from "lucide-react";

export function FlowFunnelChart() {
  const { data: funnelData, isLoading, error } = useFunnelData();

  if (isLoading) {
    return (
      <div className="chart-container">
        <div className="mb-6 flex flex-col gap-1">
          <h3 className="text-lg font-semibold font-display">Funil de Conversão</h3>
          <p className="text-sm text-muted-foreground">Drop-off nos principais fluxos</p>
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !funnelData || funnelData.length === 0) {
    return (
      <div className="chart-container">
        <div className="mb-6 flex flex-col gap-1">
          <h3 className="text-lg font-semibold font-display">Funil de Conversão</h3>
          <p className="text-sm text-muted-foreground">Drop-off nos principais fluxos</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <GitBranch className="h-12 w-12 mb-4 opacity-50" />
          <p>Nenhum dado de funil disponível</p>
        </div>
      </div>
    );
  }

  const maxValue = funnelData[0]?.value || 1;

  // Find biggest drop-off
  let biggestDropIndex = -1;
  let biggestDrop = 0;
  funnelData.forEach((step, index) => {
    if (index > 0 && funnelData[index - 1].value > 0) {
      const drop = Math.round(
        ((funnelData[index - 1].value - step.value) / funnelData[index - 1].value) * 100
      );
      if (drop > biggestDrop) {
        biggestDrop = drop;
        biggestDropIndex = index;
      }
    }
  });

  return (
    <div className="chart-container">
      <div className="mb-6 flex flex-col gap-1">
        <h3 className="text-lg font-semibold font-display">Funil de Conversão</h3>
        <p className="text-sm text-muted-foreground">
          Drop-off nos principais fluxos
        </p>
      </div>

      <div className="space-y-4">
        {funnelData.map((step, index) => {
          const percentage = maxValue > 0 ? (step.value / maxValue) * 100 : 0;
          const dropOff = index > 0 && funnelData[index - 1].value > 0
            ? Math.round(((funnelData[index - 1].value - step.value) / funnelData[index - 1].value) * 100)
            : 0;

          return (
            <div
              key={step.label}
              className="opacity-0 animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{step.label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{step.value.toLocaleString()}</span>
                  {dropOff > 0 && (
                    <span className="text-xs text-destructive font-medium">
                      -{dropOff}%
                    </span>
                  )}
                </div>
              </div>
              <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", step.color)}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {biggestDropIndex > 0 && (
        <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Insight:</span> A maior queda 
            ({biggestDrop}%) está entre "{funnelData[biggestDropIndex - 1]?.label}" e "
            {funnelData[biggestDropIndex]?.label}".
          </p>
        </div>
      )}
    </div>
  );
}
