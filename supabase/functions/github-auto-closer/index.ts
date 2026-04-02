import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PATCH',
}

const GITHUB_OWNER = Deno.env.get("GITHUB_OWNER") || "nubo-educacao";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const GITHUB_PAT = Deno.env.get("GITHUB_PAT");
    if (!GITHUB_PAT) throw new Error("GITHUB_PAT não configurado no Vault.");

    // Buscar TODAS as issues abertas que possuem a label 'status:concluido'
    // O GitHub Search API retorna o atributo 'updated_at' que é modificado quando a tag é adicionada
    const searchQuery = `is:issue is:open label:status:concluido org:${GITHUB_OWNER}`;
    const encodedQuery = encodeURIComponent(searchQuery);

    const githubRes = await fetch(`https://api.github.com/search/issues?q=${encodedQuery}`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_PAT}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Nubo-Cron-Bot'
      }
    });

    const data = await githubRes.json();
    const issues = data.items || [];

    const now = new Date();
    const closedIssues = [];

    for (const issue of issues) {
      const updatedAt = new Date(issue.updated_at);
      const hoursSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);

      // Se a issue foi marcada como concluída há mais de 24 horas, fechar!
      if (hoursSinceUpdate >= 24) {
        
        // Extrai o nome do repositório através do repository_url
        // ex: https://api.github.com/repos/nubo-educacao/nubo-conecta-app
        const parts = issue.repository_url.split('/');
        const repo = parts[parts.length - 1];

        const patchRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${repo}/issues/${issue.number}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${GITHUB_PAT}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'Nubo-Cron-Bot'
          },
          body: JSON.stringify({ state: 'closed' })
        });

        if (patchRes.ok) {
          closedIssues.push({ issue: issue.number, repo });
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processed: issues.length,
      closed: closedIssues.length,
      closed_details: closedIssues
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})
