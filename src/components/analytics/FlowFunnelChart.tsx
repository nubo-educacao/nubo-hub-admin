import { cn } from "@/lib/utils";
import { useFunnelData } from "@/hooks/useAnalyticsData";
import { Skeleton } from "@/components/ui/skeleton";
import { GitBranch, Info, Users, Download, Phone, BookOpen } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

interface UserData {
  id: string;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  created_at: string | null;
  course_interest: string[] | null;
}

interface FunnelStepLocal {
  etapa: string;
  valor: number;
  description?: string;
  user_ids?: string[];
  users?: UserData[];
}

function formatPhone(phone: string | null): string {
  if (!phone) return 'Não informado';
  // Remove non-digits
  const digits = phone.replace(/\D/g, '');
  // Format Brazilian phone: +55 11 99999-9999
  if (digits.length === 13) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export function FlowFunnelChart() {
  const { data: funnelData, isLoading, error } = useFunnelData();
  const [selectedStep, setSelectedStep] = useState<FunnelStepLocal | null>(null);
  const [funnelWithDetails, setFunnelWithDetails] = useState<FunnelStepLocal[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Fetch funnel data with full user details for drill-down
  useEffect(() => {
    const fetchFunnelWithDetails = async () => {
      setLoadingDetails(true);
      try {
        console.log('Fetching funnel with details...');
        const { data, error } = await supabase.functions.invoke('analytics-funnel', {
          body: { details: true }
        });
        
        if (error) {
          console.error('Error from analytics-funnel:', error);
          toast.error('Erro ao carregar detalhes do funil');
          return;
        }
        
        if (data && Array.isArray(data)) {
          console.log('Funnel with details loaded:', data.length, 'steps');
          console.log('First step has', data[0]?.users?.length || 0, 'users');
          setFunnelWithDetails(data);
        } else {
          console.warn('Unexpected data format from analytics-funnel:', data);
        }
      } catch (e) {
        console.error('Exception fetching funnel details:', e);
        toast.error('Erro ao carregar detalhes do funil');
      } finally {
        setLoadingDetails(false);
      }
    };
    fetchFunnelWithDetails();
  }, []);

  // Get users for selected step from cached data
  const getSelectedStepUsers = (): UserData[] => {
    if (!selectedStep) return [];
    
    // Find the step in funnelWithDetails
    const stepWithDetails = funnelWithDetails.find(s => s.etapa === selectedStep.etapa);
    
    if (stepWithDetails) {
      console.log(`Found step "${selectedStep.etapa}" with ${stepWithDetails.users?.length || 0} users`);
      return stepWithDetails.users || [];
    }
    
    console.log(`Step "${selectedStep.etapa}" not found in funnelWithDetails. Available steps:`, 
      funnelWithDetails.map(s => s.etapa));
    return [];
  };

  const selectedUsers = getSelectedStepUsers();

  // Export all funnel data to CSV
  const exportToCSV = async () => {
    if (funnelWithDetails.length === 0) {
      toast.error('Aguarde os dados carregarem');
      return;
    }

    setExporting(true);
    try {
      // Build CSV rows - each user appears with their most advanced stage
      const userStages = new Map<string, { user: UserData; stage: string; stageIndex: number }>();
      
      funnelWithDetails.forEach((step, index) => {
        const users = step.users || [];
        users.forEach(user => {
          const existing = userStages.get(user.id);
          // Keep the most advanced stage (higher index = more advanced)
          if (!existing || index > existing.stageIndex) {
            userStages.set(user.id, { user, stage: step.etapa, stageIndex: index });
          }
        });
      });

      // Create CSV content
      const headers = ['nome', 'telefone', 'cidade', 'curso', 'etapa', 'data_cadastro'];
      const rows = Array.from(userStages.values()).map(({ user, stage }) => [
        user.full_name || 'Anônimo',
        user.phone || '',
        user.city || '',
        user.course_interest?.join('; ') || '',
        stage,
        user.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      // Download file
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `funil-conversao-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);

      toast.success(`Exportados ${userStages.size} usuários para CSV`);
    } catch (e) {
      console.error('Error exporting CSV:', e);
      toast.error('Erro ao exportar CSV');
    } finally {
      setExporting(false);
    }
  };

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
        <div className="mb-6 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold font-display">Funil de Conversão</h3>
            <p className="text-sm text-muted-foreground">Clique em uma etapa para ver os usuários</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            disabled={exporting || loadingDetails}
          >
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Exportando...' : 'Exportar CSV'}
          </Button>
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
              
              {loadingDetails ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : selectedUsers.length > 0 ? (
                <ScrollArea className="h-[350px]">
                  <div className="space-y-2 pr-4">
                    {selectedUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {user.full_name || 'Usuário Anônimo'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {user.city || 'Cidade não informada'}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground font-mono">
                              {formatPhone(user.phone)}
                            </span>
                          </div>
                          {user.course_interest && user.course_interest.length > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <BookOpen className="h-3 w-3 text-primary" />
                              <span className="text-xs text-primary truncate max-w-[200px]">
                                {user.course_interest.slice(0, 2).join(', ')}
                                {user.course_interest.length > 2 && ` +${user.course_interest.length - 2}`}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground text-right">
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
