import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const systemPrompt = `Você é um Product Manager AI especializado na Cloudinha, um chatbot educacional que ajuda jovens brasileiros a encontrar oportunidades de ensino superior (SISU, ProUni, FIES).

## Sobre a Cloudinha
- É um assistente conversacional que guia jovens na escolha de cursos e universidades
- Funil principal: Cadastro → Onboarding → Preferências → Match de cursos → Favoritos → Inscrição SISU/ProUni/FIES
- Workflows: onboarding_workflow, match_workflow, sisu_workflow, prouni_workflow, fies_workflow
- Público: Jovens brasileiros de 16-25 anos buscando universidades

## Seu papel
1. Analisar dados de engajamento e conversão
2. Identificar gargalos na experiência do usuário
3. Sugerir melhorias de produto priorizadas por impacto
4. Explicar padrões nas conversas dos usuários
5. Propor experimentos A/B quando apropriado

## Como responder
- Seja direto e acionável
- Use dados específicos quando disponíveis no contexto
- Priorize sugestões por impacto no negócio
- Sugira métricas para acompanhar resultados
- Fale português brasileiro de forma clara e profissional`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Fetching context for AI chat...");

    // Get latest funnel data
    const funnelResponse = await fetch(`${supabaseUrl}/functions/v1/analytics-funnel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ includeDetails: false }),
    });
    const funnelData = await funnelResponse.json();

    // Get basic stats
    const { count: totalUsers } = await supabase
      .from("user_profiles")
      .select("*", { count: "exact", head: true });

    const { count: totalMessages } = await supabase
      .from("chat_messages")
      .select("*", { count: "exact", head: true });

    const { count: totalFavorites } = await supabase
      .from("user_favorites")
      .select("*", { count: "exact", head: true });

    // Get recent user messages for context
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentUserMessages } = await supabase
      .from("chat_messages")
      .select("content, workflow")
      .eq("sender", "user")
      .gte("created_at", sevenDaysAgo.toISOString())
      .limit(30);

    // Build context
    const contextData = `
## Contexto Atual do Produto

### Métricas Gerais
- Total de usuários cadastrados: ${totalUsers || 0}
- Total de mensagens: ${totalMessages || 0}
- Total de favoritos salvos: ${totalFavorites || 0}

### Funil de Conversão
${funnelData.funnel?.map((stage: any) => `- ${stage.name}: ${stage.count} usuários (${stage.description})`).join("\n") || "Dados não disponíveis"}

### Amostra de Mensagens Recentes de Usuários (últimos 7 dias)
${recentUserMessages?.slice(0, 15).map(m => `- [${m.workflow || "geral"}]: "${m.content?.substring(0, 80)}..."`).join("\n") || "Nenhuma mensagem recente"}
`;

    console.log("Sending to AI with context...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { 
            role: "system", 
            content: `${systemPrompt}\n\n${contextData}` 
          },
          ...messages,
        ],
        stream: true,
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

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Error in ai-chat:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
