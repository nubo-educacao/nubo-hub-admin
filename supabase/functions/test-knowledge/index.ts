import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { markdownContent, question } = await req.json();

    if (!markdownContent || !question) {
      throw new Error("Os campos 'markdownContent' e 'question' são obrigatórios.");
    }

    const API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!API_KEY) {
      throw new Error("GEMINI_API_KEY não configurada.");
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

    const systemPrompt = `Você é a Cloudinha, assistente educacional da plataforma Nubo Hub.
Você DEVE responder a pergunta do estudante usando EXCLUSIVAMENTE o conteúdo do documento abaixo como base de conhecimento.
Se a resposta não estiver no documento, diga claramente que não encontrou essa informação no documento.
Seja acolhedora, clara e objetiva. Use emojis com moderação.

=== DOCUMENTO DE CONHECIMENTO ===
${markdownContent}
=== FIM DO DOCUMENTO ===`;

    const body = {
      contents: [{
        parts: [
          { text: `${systemPrompt}\n\nPergunta do estudante: ${question}` }
        ]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro Gemini:", response.status, errorText);
      throw new Error(`Erro na API Gemini (${response.status})`);
    }

    const data = await response.json();
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!answer) {
      throw new Error("Resposta do Gemini veio vazia.");
    }

    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in test-knowledge:", error);
    const message = error.name === 'AbortError' ? "Timeout no processamento" : error.message;

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
