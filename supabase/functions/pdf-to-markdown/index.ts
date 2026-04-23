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

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
    
    const prompt = `Analise o PDF e extraia estes campos em formato JSON ESTRITO (apenas o objeto JSON, sem blocos de código):
{
  "title": "Título curto",
  "description": "Resumo (1-2 frases)",
  "category_name": "uma destas: partner, prouni, sisu, cloudinha, passport, general",
  "partner_name": "Nome do parceiro ou vazio",
  "keywords": ["tag1", "tag2", "tag3"],
  "markdown": "Conteúdo MD completo e detalhado (tabelas e listas inclusas, não resuma o texto)"
}`;

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
        responseMimeType: "application/json"
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
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
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;

    console.log("Finish Reason:", candidate?.finishReason);
    console.log("Token Count Usage:", JSON.stringify(data.usageMetadata));

    if (!text) {
      throw new Error(`Resposta do Gemini veio vazia. Payload completo: ${JSON.stringify(data)}`);
    }

    try {
      JSON.parse(text); // Valida se o JSON está íntegro
    } catch (parseError) {
      console.error("JSON truncado recebido do Gemini:", text.substring(text.length - 100));
      throw new Error(`O modelo interrompeu a geração do texto (finishReason: ${candidate?.finishReason}). O arquivo pode ser muito longo ou o modelo falhou.`);
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
