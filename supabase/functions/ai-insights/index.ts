import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const systemPrompt = `Você é um Product Manager AI especializado na Cloudinha, um chatbot educacional que ajuda jovens brasileiros a encontrar oportunidades de ensino superior (SISU, ProUni, FIES).

Seu papel é analisar os dados fornecidos e gerar insights acionáveis categorizados em:

1. **🚨 Alertas** - Métricas que precisam de atenção urgente
2. **🔻 Gargalos do Funil** - Onde usuários estão abandonando
3. **💬 Padrões de Conversa** - Temas frequentes, perguntas comuns, dúvidas recorrentes
4. **💡 Oportunidades** - Sugestões de melhoria priorizadas por impacto

Para cada insight:
- Seja específico e use números quando disponíveis
- Sugira ações concretas
- Priorize por impacto no negócio

Responda SEMPRE em formato JSON válido com a seguinte estrutura:
{
  "insights": [
    {
      "category": "alert" | "bottleneck" | "pattern" | "opportunity",
      "title": "Título curto do insight",
      "description": "Descrição detalhada com dados",
      "action": "Ação recomendada",
      "priority": "high" | "medium" | "low"
    }
  ]
}`;

// Simple hash function for data comparison
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    let forceRefresh = false;
    try {
      const body = await req.json();
      forceRefresh = body.forceRefresh === true;
    } catch {
      // No body or invalid JSON, use defaults
    }

    console.log("AI Insights request - forceRefresh:", forceRefresh);

    // Collect current data metrics for hash calculation
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get message count
    const { count: messageCount } = await supabase
      .from("chat_messages")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo.toISOString());

    // Get user count
    const { count: userCount } = await supabase
      .from("user_profiles")
      .select("*", { count: "exact", head: true });

    // Get preferences count
    const { count: preferencesCount } = await supabase
      .from("user_preferences")
      .select("*", { count: "exact", head: true });

    // Calculate hash from current data state
    const dataHashInput = `msgs:${messageCount || 0}-users:${userCount || 0}-prefs:${preferencesCount || 0}-date:${new Date().toISOString().split('T')[0]}`;
    const currentDataHash = simpleHash(dataHashInput);

    console.log("Current data hash:", currentDataHash, "from:", dataHashInput);

    // Check for cached insights (within last 24 hours)
    if (!forceRefresh) {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const { data: cachedInsights, error: cacheError } = await supabase
        .from("ai_insights")
        .select("*")
        .gte("created_at", twentyFourHoursAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!cacheError && cachedInsights) {
        const dataChanged = cachedInsights.data_hash !== currentDataHash;
        console.log("Found cached insights, dataChanged:", dataChanged);

        return new Response(JSON.stringify({
          insights: cachedInsights.insights,
          generatedAt: cachedInsights.created_at,
          dataContext: cachedInsights.data_context,
          fromCache: true,
          dataChanged,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("No valid cache found, generating new insights...");
    }

    // Generate new insights
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Collect funnel data
    const funnelResponse = await fetch(`${supabaseUrl}/functions/v1/analytics-funnel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ includeDetails: false }),
    });
    const funnelData = await funnelResponse.json();

    // Collect recent conversations
    const { data: recentMessages, error: messagesError } = await supabase
      .from("chat_messages")
      .select("content, sender, workflow, created_at")
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(100);

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
    }

    // Collect user preferences stats
    const { data: preferencesData, error: prefsError } = await supabase
      .from("user_preferences")
      .select("program_preference, course_interest, state_preference");

    if (prefsError) {
      console.error("Error fetching preferences:", prefsError);
    }

    // Calculate metrics
    const userMessages = recentMessages?.filter(m => m.sender === "user") || [];
    const workflowCounts: Record<string, number> = {};
    recentMessages?.forEach(m => {
      if (m.workflow) {
        workflowCounts[m.workflow] = (workflowCounts[m.workflow] || 0) + 1;
      }
    });

    const programCounts: Record<string, number> = {};
    preferencesData?.forEach(p => {
      if (p.program_preference) {
        programCounts[p.program_preference] = (programCounts[p.program_preference] || 0) + 1;
      }
    });

    // Extract keyword frequencies from user messages
    const keywordCounts: Record<string, number> = {};
    const commonKeywords = ["sisu", "prouni", "fies", "nota", "corte", "inscricao", "inscrição", "curso", "medicina", "direito", "engenharia", "como", "quando", "onde", "quanto"];
    
    userMessages.forEach((m: { content?: string }) => {
      if (m.content) {
        const words: string[] = m.content.toLowerCase().split(/\s+/);
        words.forEach((word: string) => {
          const cleanWord = word.replace(/[^a-záéíóúãõâêô]/g, '');
          if (cleanWord.length > 3 && commonKeywords.some(kw => cleanWord.includes(kw))) {
            keywordCounts[cleanWord] = (keywordCounts[cleanWord] || 0) + 1;
          }
        });
      }
    });

    // Sort keywords by frequency
    const topKeywords = Object.entries(keywordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => `${word}: ${count} menções`);

    // Build context for AI with comparative metrics
    const dataContext = `
## Dados do Funil de Conversão (últimos 7 dias)
${JSON.stringify(funnelData.funnel, null, 2)}

## Estatísticas de Conversas
- Total de mensagens (7 dias): ${recentMessages?.length || 0}
- Mensagens de usuários: ${userMessages.length}
- Total de usuários cadastrados: ${userCount || 0}
- Usuários com preferências: ${preferencesCount || 0}

## Distribuição por Workflow
${Object.entries(workflowCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([wf, count]) => `- ${wf}: ${count} mensagens (${Math.round((count / (recentMessages?.length || 1)) * 100)}%)`)
  .join("\n")}

## Palavras-chave Mais Frequentes
${topKeywords.length > 0 ? topKeywords.join("\n") : "Sem dados suficientes"}

## Exemplos de Mensagens de Usuários (amostra)
${userMessages.slice(0, 15).map(m => `- "${m.content?.substring(0, 80)}${(m.content?.length || 0) > 80 ? '...' : ''}"`).join("\n")}

## Preferências de Programa
${JSON.stringify(programCounts)}

## Métricas-Chave
- Taxa de conversão cadastro→preferências: ${userCount ? Math.round(((preferencesCount || 0) / userCount) * 100) : 0}%
- Média de mensagens por usuário: ${userCount ? ((recentMessages?.length || 0) / userCount).toFixed(1) : 0}
`;

    console.log("Sending data to AI for analysis...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analise os seguintes dados e gere insights acionáveis:\n\n${dataContext}` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    console.log("AI response received:", content?.substring(0, 200));

    // Parse the JSON response
    let insights;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        insights = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      insights = {
        insights: [
          {
            category: "alert",
            title: "Erro ao processar insights",
            description: "Não foi possível processar a resposta da AI. Tente novamente.",
            action: "Clique em 'Gerar novos insights'",
            priority: "high",
          },
        ],
      };
    }

    // Store data context for cache
    const storedDataContext = {
      totalMessages: recentMessages?.length || 0,
      userMessages: userMessages.length,
      funnelStages: funnelData.funnel?.length || 0,
      totalUsers: userCount || 0,
      usersWithPreferences: preferencesCount || 0,
    };

    // Save to database for caching
    const { error: insertError } = await supabase
      .from("ai_insights")
      .insert({
        insights: insights.insights,
        data_context: storedDataContext,
        data_hash: currentDataHash,
      });

    if (insertError) {
      console.error("Failed to cache insights:", insertError);
    } else {
      console.log("Insights cached successfully");
    }

    return new Response(JSON.stringify({
      insights: insights.insights,
      generatedAt: new Date().toISOString(),
      dataContext: storedDataContext,
      fromCache: false,
      dataChanged: false,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in ai-insights:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
