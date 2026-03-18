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
    const { pdfBase64 } = await req.json();

    if (!pdfBase64) {
      throw new Error("O campo 'pdfBase64' é obrigatório.");
    }

    const API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!API_KEY) {
      throw new Error("GEMINI_API_KEY não configurada.");
    }

    console.log(`Recebido PDF Base64 (Tamanho: ${Math.round(pdfBase64.length / 1024)} KB)`);

    // Estratégia: Enviar diretamente para a API de conteúdo. 
    // Para evitar TLS Handshake EOF em Edge Functions com corpos gigantes, 
    // garantimos que o prompt seja enxuto e usamos Gemini 2.0 Flash.

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
    
    const prompt = `Analise o PDF e extraia estes campos em JSON:
1. title: Título curto.
2. description: Resumo (1-2 frases).
3. category_name: uma destas: "partner", "prouni", "sisu", "cloudinha", "passport", "general".
4. partner_name: Nome do parceiro ou "".
5. keywords: 3-5 tags.
6. markdown: Conteúdo MD completo (tabelas e listas inclusas).`;

    const body = {
      contents: [{
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "application/pdf",
              data: pdfBase64
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            description: { type: "STRING" },
            category_name: { type: "STRING" },
            partner_name: { type: "STRING" },
            keywords: { type: "ARRAY", items: { type: "STRING" } },
            markdown: { type: "STRING" }
          },
          required: ["title", "description", "category_name", "partner_name", "keywords", "markdown"]
        }
      }
    };

    console.log("Chamando Gemini 2.0 Flash...");
    
    // Timeout de segurança
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

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
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("Resposta do Gemini veio vazia.");
    }

    return new Response(text, { // Já é um JSON vindo do Gemini
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in pdf-to-markdown:", error);
    const status = error.name === 'AbortError' ? 504 : 500;
    const message = error.name === 'AbortError' ? "Timeout no processamento da IA" : error.message;
    
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
