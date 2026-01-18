import { useState, useEffect } from "react";
import { MessageSquare, ChevronLeft, ChevronRight, User, Cloud, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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
  workflow: string | null;
  messages: ChatMessage[];
}

const workflowLabels: Record<string, string> = {
  'match_workflow': 'Match',
  'sisu_workflow': 'SISU',
  'prouni_workflow': 'ProUni',
  'fies_workflow': 'FIES',
  'onboarding_workflow': 'Onboarding',
};

export function ChatExamplesPanel() {
  const [conversations, setConversations] = useState<UserConversation[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching conversations...');
      
      const { data, error: fetchError } = await supabase.functions.invoke('analytics-chats', {
        body: { limit: 10 }
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

  const currentConversation = conversations[currentIndex];

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : conversations.length - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < conversations.length - 1 ? prev + 1 : 0));
  };

  if (loading) {
    return (
      <div className="chart-container col-span-2">
        <div className="mb-4 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold font-display">Conversas Recentes</h3>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chart-container col-span-2">
        <div className="mb-4 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold font-display">Conversas Recentes</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
          <p className="mb-4">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchConversations}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="chart-container col-span-2">
        <div className="mb-4 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold font-display">Conversas Recentes</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
          <p>Nenhuma conversa encontrada</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-container col-span-2">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold font-display">Conversas Recentes</h3>
        </div>
        <span className="text-sm text-muted-foreground">
          {currentIndex + 1} de {conversations.length}
        </span>
      </div>

      {/* Navigation and User Info */}
      <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-muted/50">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPrevious}
          disabled={conversations.length <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{currentConversation?.user_name}</span>
          </div>
          {currentConversation?.workflow && (
            <Badge variant="secondary">
              {workflowLabels[currentConversation.workflow] || currentConversation.workflow}
            </Badge>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={goToNext}
          disabled={conversations.length <= 1}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Chat Messages */}
      <ScrollArea className="h-[350px] pr-4">
        <div className="space-y-3">
          {currentConversation?.messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-2",
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
                  "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                  message.sender === 'user'
                    ? "bg-muted text-foreground"
                    : "bg-primary text-primary-foreground"
                )}
              >
                <p className="whitespace-pre-wrap break-words">
                  {message.content?.slice(0, 500)}
                  {message.content && message.content.length > 500 && '...'}
                </p>
                <p className={cn(
                  "text-xs mt-1 opacity-70",
                  message.sender === 'user' ? "text-muted-foreground" : "text-primary-foreground/70"
                )}>
                  {message.created_at && new Date(message.created_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>

              {message.sender !== 'user' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Cloud className="h-4 w-4 text-primary" />
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Insight */}
      <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">💡 Insight:</span> {' '}
          {currentConversation?.messages.length || 0} mensagens trocadas nesta conversa.
          {currentConversation?.workflow && (
            <> Fluxo principal: <strong>{workflowLabels[currentConversation.workflow] || currentConversation.workflow}</strong>.</>
          )}
        </p>
      </div>
    </div>
  );
}
