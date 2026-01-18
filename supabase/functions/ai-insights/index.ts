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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Collecting data for insights...");

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

    // Collect recent conversations (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

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

    // Calculate some metrics
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

    // Build context for AI
    const dataContext = `
## Dados do Funil de Conversão
${JSON.stringify(funnelData.funnel, null, 2)}

## Estatísticas de Conversas (últimos 7 dias)
- Total de mensagens: ${recentMessages?.length || 0}
- Mensagens de usuários: ${userMessages.length}
- Distribuição por workflow: ${JSON.stringify(workflowCounts)}

## Exemplos de Mensagens de Usuários (amostra)
${userMessages.slice(0, 20).map(m => `- "${m.content?.substring(0, 100)}..."`).join("\n")}

## Preferências de Programa
${JSON.stringify(programCounts)}

## Total de usuários com preferências: ${preferencesData?.length || 0}
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
      // Try to extract JSON from the response
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

    return new Response(JSON.stringify({
      ...insights,
      generatedAt: new Date().toISOString(),
      dataContext: {
        totalMessages: recentMessages?.length || 0,
        userMessages: userMessages.length,
        funnelStages: funnelData.funnel?.length || 0,
      },
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
