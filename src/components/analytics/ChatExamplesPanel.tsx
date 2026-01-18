import { useState, useEffect, useRef } from "react";
import { MessageSquare, ChevronLeft, ChevronRight, User, Cloud, Loader2, MapPin, GraduationCap, Calendar, Hash, Filter, GitBranch, Target, Search, ChevronUp, CalendarDays, Phone, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

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
  phone: string | null;
  city: string | null;
  location_preference: string | null;
  age: number | null;
  education: string | null;
  active_workflow: string | null;
  first_contact: string | null;
  total_messages: number;
  workflow: string | null;
  funnel_stage: string | null;
  has_more_messages: boolean;
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

const datePresets = [
  { value: 'today', label: 'Hoje', getRange: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { value: 'yesterday', label: 'Ontem', getRange: () => ({ from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) }) },
  { value: 'last7days', label: 'Últimos 7 dias', getRange: () => ({ from: startOfDay(subDays(new Date(), 7)), to: endOfDay(new Date()) }) },
  { value: 'last30days', label: 'Últimos 30 dias', getRange: () => ({ from: startOfDay(subDays(new Date(), 30)), to: endOfDay(new Date()) }) },
  { value: 'custom', label: 'Personalizado', getRange: () => null },
];

export function ChatExamplesPanel({ fullPage = false }: ChatExamplesPanelProps) {
  const [conversations, setConversations] = useState<UserConversation[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [funnelFilter, setFunnelFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Date filter states
  const [datePreset, setDatePreset] = useState('last30days');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(subDays(new Date(), 30));
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching conversations with date filter:', { dateFrom, dateTo });
      
      const requestBody: { 
        limit: number; 
        date_from?: string; 
        date_to?: string 
      } = { 
        limit: fullPage ? 30 : 10 
      };
      
      if (dateFrom) {
        requestBody.date_from = startOfDay(dateFrom).toISOString();
      }
      if (dateTo) {
        requestBody.date_to = endOfDay(dateTo).toISOString();
      }
      
      const { data, error: fetchError } = await supabase.functions.invoke('analytics-chats', {
        body: requestBody
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
  
  // Handle date preset change
  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const presetConfig = datePresets.find(p => p.value === preset);
    if (presetConfig && preset !== 'custom') {
      const range = presetConfig.getRange();
      if (range) {
        setDateFrom(range.from);
        setDateTo(range.to);
      }
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [dateFrom, dateTo]);

  // Filter conversations by funnel stage and search query
  const filteredConversations = conversations.filter(c => {
    const matchesFunnel = funnelFilter === 'all' || c.funnel_stage === funnelFilter;
    const matchesSearch = searchQuery === '' || 
      c.user_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFunnel && matchesSearch;
  });

  // Reset index when filter or search changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [funnelFilter, searchQuery]);

  const currentConversation = filteredConversations[currentIndex];

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : filteredConversations.length - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < filteredConversations.length - 1 ? prev + 1 : 0));
  };

  const loadMoreMessages = async () => {
    if (!currentConversation || loadingMore) return;
    
    const currentMessagesCount = currentConversation.messages.length;
    
    try {
      setLoadingMore(true);
      
      // Save scroll height before loading
      const container = chatContainerRef.current;
      const scrollHeightBefore = container?.scrollHeight || 0;
      
      const { data, error: fetchError } = await supabase.functions.invoke('analytics-chats', {
        body: { 
          user_id: currentConversation.user_id, 
          offset: currentMessagesCount,
          messages_limit: 20
        }
      });

      if (fetchError) {
        console.error('Error loading more messages:', fetchError);
        return;
      }

      if (data && data.messages && Array.isArray(data.messages)) {
        // Update the conversation with new messages prepended
        setConversations(prev => prev.map(conv => {
          if (conv.user_id === currentConversation.user_id) {
            return {
              ...conv,
              messages: [...data.messages, ...conv.messages],
              has_more_messages: data.has_more
            };
          }
          return conv;
        }));

        // After state update, maintain scroll position
        setTimeout(() => {
          if (container) {
            const scrollHeightAfter = container.scrollHeight;
            container.scrollTop = scrollHeightAfter - scrollHeightBefore;
          }
        }, 0);
      }
    } catch (e) {
      console.error('Error loading more messages:', e);
    } finally {
      setLoadingMore(false);
    }
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
        {/* Search */}
        <div className="mb-3 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Date Filter */}
        <div className="mb-3 flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Período</span>
          </div>
          <Select value={datePreset} onValueChange={handleDatePresetChange}>
            <SelectTrigger className="w-full mb-2">
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              {datePresets.map((preset) => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {datePreset === 'custom' && (
            <div className="space-y-2">
              <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-left font-normal"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {dateFrom && dateTo ? (
                      <span className="truncate">
                        {format(dateFrom, "dd/MM", { locale: ptBR })} - {format(dateTo, "dd/MM", { locale: ptBR })}
                      </span>
                    ) : (
                      <span>Selecionar datas</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="range"
                    selected={{ from: dateFrom, to: dateTo }}
                    onSelect={(range) => {
                      setDateFrom(range?.from);
                      setDateTo(range?.to);
                      if (range?.from && range?.to) {
                        setIsDatePopoverOpen(false);
                      }
                    }}
                    numberOfMonths={1}
                    locale={ptBR}
                    disabled={(date) => date > new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
          
          {dateFrom && dateTo && datePreset !== 'custom' && (
            <p className="text-xs text-muted-foreground mt-1">
              {format(dateFrom, "dd/MM/yyyy", { locale: ptBR })} - {format(dateTo, "dd/MM/yyyy", { locale: ptBR })}
            </p>
          )}
        </div>

        {/* Funnel Filter */}
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

              {/* Phone Number with Copy Button */}
              {currentConversation?.phone && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-success/10 border border-success/20 mb-3">
                  <Phone className="h-4 w-4 text-success flex-shrink-0" />
                  <span className="text-sm font-mono flex-1 truncate">{currentConversation.phone}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(currentConversation.phone!);
                      setCopiedPhone(currentConversation.phone);
                      setTimeout(() => setCopiedPhone(null), 2000);
                    }}
                  >
                    {copiedPhone === currentConversation.phone ? (
                      <Check className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </Button>
                </div>
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
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto rounded-lg border border-border bg-card/50 p-4"
          >
            <div className="space-y-4">
              {/* Load More Button */}
              {currentConversation?.has_more_messages && (
                <div className="flex flex-col items-center gap-2 pb-4 border-b border-border/50">
                  <span className="text-xs text-muted-foreground">
                    Mostrando {currentConversation.messages.length} de {currentConversation.total_messages} mensagens
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMoreMessages}
                    disabled={loadingMore}
                    className="gap-2"
                  >
                    {loadingMore ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronUp className="h-4 w-4" />
                    )}
                    {loadingMore ? 'Carregando...' : 'Carregar conversa anterior'}
                  </Button>
                </div>
              )}

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
