import { useState, useEffect } from "react";
import { MessageSquare, ChevronLeft, ChevronRight, User, Cloud, Loader2, MapPin, GraduationCap, Calendar, Hash, Filter, GitBranch, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ChatMessage {
  id: string;
  content: string;
  sender: string;
  workflow: string | null;
  created_at: string;
}

interface UserConversation {
  user_id: string;
  user_name: string;
  city: string | null;
  location_preference: string | null;
  age: number | null;
  education: string | null;
  active_workflow: string | null;
  first_contact: string | null;
  total_messages: number;
  workflow: string | null;
  funnel_stage: string | null;
  messages: ChatMessage[];
}

const workflowLabels: Record<string, string> = {
  'match_workflow': 'Match',
  'sisu_workflow': 'SISU',
  'prouni_workflow': 'ProUni',
  'fies_workflow': 'FIES',
  'onboarding_workflow': 'Onboarding',
};

const educationLabels: Record<string, string> = {
  'ensino_medio': 'Ensino Médio',
  'ensino_medio_completo': 'Ensino Médio Completo',
  'cursando_superior': 'Cursando Superior',
  'superior_completo': 'Superior Completo',
};

const funnelStages = [
  { value: 'all', label: 'Todas as etapas' },
  { value: 'Cadastrados', label: 'Cadastrados' },
  { value: 'Onboarding Completo', label: 'Onboarding Completo' },
  { value: 'Preferências Definidas', label: 'Preferências Definidas' },
  { value: 'Match Iniciado', label: 'Match Iniciado' },
  { value: 'Salvaram Favoritos', label: 'Salvaram Favoritos' },
  { value: 'Fluxo Específico', label: 'Fluxo Específico' },
];

const funnelStageColors: Record<string, string> = {
  'Cadastrados': 'bg-chart-1/10 text-chart-1 border-chart-1/30',
  'Onboarding Completo': 'bg-chart-2/10 text-chart-2 border-chart-2/30',
  'Preferências Definidas': 'bg-chart-3/10 text-chart-3 border-chart-3/30',
  'Match Iniciado': 'bg-chart-4/10 text-chart-4 border-chart-4/30',
  'Salvaram Favoritos': 'bg-chart-5/10 text-chart-5 border-chart-5/30',
  'Fluxo Específico': 'bg-success/10 text-success border-success/30',
};

interface ChatExamplesPanelProps {
  fullPage?: boolean;
}

export function ChatExamplesPanel({ fullPage = false }: ChatExamplesPanelProps) {
  const [conversations, setConversations] = useState<UserConversation[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [funnelFilter, setFunnelFilter] = useState('all');

  const fetchConversations = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching conversations...');
      
      const { data, error: fetchError } = await supabase.functions.invoke('analytics-chats', {
        body: { limit: fullPage ? 30 : 10 }
      });

      if (fetchError) {
        console.error('Error from analytics-chats:', fetchError);
        throw fetchError;
      }
      
      if (data && Array.isArray(data)) {
        console.log('Loaded', data.length, 'conversations');
        setConversations(data);
      } else {
        console.warn('Unexpected data format from analytics-chats:', data);
        setConversations([]);
      }
    } catch (e) {
      console.error('Error fetching conversations:', e);
      setError('Erro ao carregar conversas. Clique para tentar novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  // Filter conversations by funnel stage
  const filteredConversations = funnelFilter === 'all' 
    ? conversations 
    : conversations.filter(c => c.funnel_stage === funnelFilter);

  // Reset index when filter changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [funnelFilter]);

  const currentConversation = filteredConversations[currentIndex];

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : filteredConversations.length - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < filteredConversations.length - 1 ? prev + 1 : 0));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
        <p className="mb-4">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchConversations}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
        <p>Nenhuma conversa encontrada</p>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4">
      {/* Left Sidebar - User List & Info (compact) */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r border-border pr-4">
        {/* Filter */}
        <div className="mb-3 flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtrar por etapa</span>
          </div>
          <Select value={funnelFilter} onValueChange={setFunnelFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filtrar por etapa" />
            </SelectTrigger>
            <SelectContent>
              {funnelStages.map((stage) => (
                <SelectItem key={stage.value} value={stage.value}>
                  {stage.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToPrevious}
            disabled={filteredConversations.length <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} de {filteredConversations.length}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={goToNext}
            disabled={filteredConversations.length <= 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
            <Filter className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm text-center">Nenhuma conversa nesta etapa</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setFunnelFilter('all')}>
              Limpar filtro
            </Button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Current User Card */}
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              {/* User Header */}
              <div className="flex items-center gap-2 mb-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold truncate">{currentConversation?.user_name}</h4>
                  {currentConversation?.age && (
                    <span className="text-xs text-muted-foreground">{currentConversation.age} anos</span>
                  )}
                </div>
              </div>

              {/* Funnel Stage Badge */}
              {currentConversation?.funnel_stage && (
                <Badge 
                  variant="outline" 
                  className={cn(
                    "w-full justify-center mb-3 text-xs",
                    funnelStageColors[currentConversation.funnel_stage] || "bg-muted"
                  )}
                >
                  <GitBranch className="h-3 w-3 mr-1" />
                  {currentConversation.funnel_stage}
                </Badge>
              )}

              {/* User Details */}
              <div className="space-y-2 text-xs">
                {/* Location: Where user IS from */}
                {currentConversation?.city && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="text-foreground/70">Mora em:</span>
                      <p className="truncate font-medium text-foreground">{currentConversation.city}</p>
                    </div>
                  </div>
                )}

                {/* Location: Where user WANTS to study */}
                {currentConversation?.location_preference && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Target className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-chart-2" />
                    <div className="min-w-0">
                      <span className="text-foreground/70">Quer estudar em:</span>
                      <p className="truncate font-medium text-chart-2">{currentConversation.location_preference}</p>
                    </div>
                  </div>
                )}

                {currentConversation?.education && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <GraduationCap className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span className="truncate">
                      {educationLabels[currentConversation.education] || currentConversation.education}
                    </span>
                  </div>
                )}

                {currentConversation?.first_contact && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">
                      {formatDistanceToNow(new Date(currentConversation.first_contact), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Hash className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{currentConversation?.total_messages || 0} mensagens</span>
                </div>
              </div>

              {/* Workflow Badges */}
              <div className="flex flex-wrap gap-1 mt-3">
                {currentConversation?.workflow && (
                  <Badge variant="secondary" className="text-xs">
                    {workflowLabels[currentConversation.workflow] || currentConversation.workflow}
                  </Badge>
                )}
                {currentConversation?.active_workflow && currentConversation.active_workflow !== currentConversation.workflow && (
                  <Badge variant="outline" className="text-xs">
                    {workflowLabels[currentConversation.active_workflow] || currentConversation.active_workflow}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Chat Area - Takes remaining space */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border flex-shrink-0">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Cloud className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Conversa com Cloudinha</h3>
            <p className="text-xs text-muted-foreground">
              {currentConversation?.user_name}
              {currentConversation?.city && ` • ${currentConversation.city}`}
              {currentConversation?.location_preference && currentConversation.location_preference !== currentConversation.city && (
                <span className="text-chart-2"> → {currentConversation.location_preference}</span>
              )}
            </p>
          </div>
        </div>

        {/* Chat Messages - Full remaining height */}
        {filteredConversations.length > 0 && (
          <div className="flex-1 overflow-y-auto rounded-lg border border-border bg-card/50 p-4">
            <div className="space-y-4">
              {currentConversation?.messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.sender === 'user' ? "justify-start" : "justify-end"
                  )}
                >
                  {message.sender === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-4 py-3",
                      message.sender === 'user'
                        ? "bg-muted text-foreground rounded-tl-sm"
                        : "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-tr-sm"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {message.content}
                    </p>
                    <p className={cn(
                      "text-[10px] mt-2",
                      message.sender === 'user' ? "text-muted-foreground" : "text-primary-foreground/60"
                    )}>
                      {message.created_at && new Date(message.created_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  {message.sender !== 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                      <Cloud className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
