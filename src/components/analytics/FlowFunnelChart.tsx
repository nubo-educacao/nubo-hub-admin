import { cn } from "@/lib/utils";
import { useFunnelData } from "@/hooks/useAnalyticsData";
import { Skeleton } from "@/components/ui/skeleton";
import { GitBranch, Info, Users, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const colors = [
  "bg-primary",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
  "bg-success",
];

// Fallback descriptions if not provided by API
const funnelDescriptions: Record<string, string> = {
  'Cadastrados': 'Total de usuários na tabela user_profiles',
  'Onboarding Completo': 'Usuários com onboarding_completed = true',
  'Preferências Definidas': 'Usuários que preencheram nota do ENEM em user_preferences',
  'Match Iniciado': 'Usuários únicos que iniciaram o workflow de match',
  'Salvaram Favoritos': 'Usuários únicos que salvaram ao menos 1 favorito',
  'Fluxo Específico': 'Usuários que entraram em SISU, ProUni ou FIES workflow',
};

interface UserDetails {
  id: string;
  full_name: string | null;
  city: string | null;
  created_at: string | null;
}

interface FunnelStepLocal {
  etapa: string;
  valor: number;
  description?: string;
  user_ids?: string[];
}

export function FlowFunnelChart() {
  const { data: funnelData, isLoading, error } = useFunnelData();
  const [selectedStep, setSelectedStep] = useState<FunnelStepLocal | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [funnelWithDetails, setFunnelWithDetails] = useState<FunnelStepLocal[]>([]);

  // Fetch funnel data with user_ids for drill-down
  useEffect(() => {
    const fetchFunnelWithDetails = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('analytics-funnel', {
          body: { details: true }
        });
        if (!error && data) {
          setFunnelWithDetails(data);
        }
      } catch (e) {
        console.error('Error fetching funnel details:', e);
      }
    };
    fetchFunnelWithDetails();
  }, []);

  // Fetch user details when a step is selected
  useEffect(() => {
    const fetchUserDetails = async () => {
      if (!selectedStep) return;
      
      // Find the step with user_ids
      const stepWithDetails = funnelWithDetails.find(s => s.etapa === selectedStep.etapa);
      const userIds = stepWithDetails?.user_ids || [];
      
      if (userIds.length === 0) {
        setUserDetails([]);
        return;
      }

      setLoadingUsers(true);
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, full_name, city, created_at')
          .in('id', userIds);
        
        if (!error && data) {
          setUserDetails(data);
        }
      } catch (e) {
        console.error('Error fetching user details:', e);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUserDetails();
  }, [selectedStep, funnelWithDetails]);

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

  const maxValue = funnelData[0]?.valor ?? 1;

  let biggestDropIndex = -1;
  let biggestDrop = 0;
  funnelData.forEach((step, index) => {
    const currentVal = step?.valor ?? 0;
    const prevVal = funnelData[index - 1]?.valor ?? 0;
    if (index > 0 && prevVal > 0) {
      const drop = Math.round(((prevVal - currentVal) / prevVal) * 100);
      if (drop > biggestDrop) {
        biggestDrop = drop;
        biggestDropIndex = index;
      }
    }
  });

  const handleStepClick = (step: FunnelStepLocal) => {
    setSelectedStep(step);
  };

  return (
    <TooltipProvider>
      <div className="chart-container">
        <div className="mb-6 flex flex-col gap-1">
          <h3 className="text-lg font-semibold font-display">Funil de Conversão</h3>
          <p className="text-sm text-muted-foreground">Clique em uma etapa para ver os usuários</p>
        </div>

        <div className="space-y-4">
          {funnelData.map((step, index) => {
            const stepValue = step.valor ?? 0;
            const prevValue = funnelData[index - 1]?.valor ?? 0;
            const percentage = maxValue > 0 ? (stepValue / maxValue) * 100 : 0;
            const dropOff = index > 0 && prevValue > 0
              ? Math.round(((prevValue - stepValue) / prevValue) * 100)
              : 0;

            const description = step.description || funnelDescriptions[step.etapa] || 'Etapa do funil';

            return (
              <div
                key={step.etapa || index}
                className="opacity-0 animate-fade-in cursor-pointer hover:bg-muted/30 rounded-lg p-2 -mx-2 transition-colors"
                style={{ animationDelay: `${index * 100}ms` }}
                onClick={() => handleStepClick(step)}
              >
                <div className="flex items-center justify-between mb-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm font-medium flex items-center gap-1.5 cursor-help">
                        {step.etapa || 'Etapa'}
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="text-sm">{description}</p>
                    </TooltipContent>
                  </Tooltip>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{stepValue.toLocaleString()}</span>
                    {dropOff > 0 && (
                      <span className="text-xs text-destructive font-medium">-{dropOff}%</span>
                    )}
                  </div>
                </div>
                <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", colors[index % colors.length])}
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
              ({biggestDrop}%) está entre "{funnelData[biggestDropIndex - 1]?.etapa}" e "
              {funnelData[biggestDropIndex]?.etapa}".
            </p>
          </div>
        )}

        {/* Drill-down Dialog */}
        <Dialog open={!!selectedStep} onOpenChange={(open) => !open && setSelectedStep(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {selectedStep?.etapa}
              </DialogTitle>
              <DialogDescription>
                {selectedStep?.description || funnelDescriptions[selectedStep?.etapa || '']}
              </DialogDescription>
            </DialogHeader>
            
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-3">
                <strong>{selectedStep?.valor}</strong> usuários nesta etapa
              </p>
              
              {loadingUsers ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : userDetails.length > 0 ? (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {userDetails.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div>
                          <p className="font-medium text-sm">
                            {user.full_name || 'Usuário Anônimo'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {user.city || 'Cidade não informada'}
                          </p>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {user.created_at
                            ? new Date(user.created_at).toLocaleDateString('pt-BR')
                            : '-'}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">Nenhum usuário encontrado</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
