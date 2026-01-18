import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Descriptions for each funnel step
const funnelDescriptions: Record<string, string> = {
  'Cadastrados': 'Total de usuários na tabela user_profiles',
  'Onboarding Completo': 'Usuários com onboarding_completed = true na tabela user_profiles',
  'Preferências Definidas': 'Usuários que preencheram nota do ENEM em user_preferences (enem_score não nulo)',
  'Match Iniciado': 'Usuários únicos que iniciaram o workflow de match (workflow = match_workflow em chat_messages)',
  'Salvaram Favoritos': 'Usuários únicos que salvaram ao menos 1 favorito na tabela user_favorites',
  'Fluxo Específico': 'Usuários que entraram em SISU, ProUni ou FIES workflow (workflow in sisu_workflow, prouni_workflow, fies_workflow)',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Check if details are requested
    let includeDetails = false
    const url = new URL(req.url)
    try {
      const body = await req.json()
      includeDetails = body.details === true
    } catch {
      includeDetails = url.searchParams.get('details') === 'true'
    }

    // Step 1: Total registered users
    const { data: allProfiles, count: totalUsers } = await supabase
      .from('user_profiles')
      .select('id, full_name, city, created_at', { count: 'exact' })
    
    const allProfileIds = allProfiles?.map(p => p.id) || []

    // Step 2: Users who completed onboarding
    const { data: onboardingProfiles, count: onboardingCompleted } = await supabase
      .from('user_profiles')
      .select('id, full_name, city, created_at', { count: 'exact' })
      .eq('onboarding_completed', true)
    
    const onboardingUserIds = onboardingProfiles?.map(p => p.id) || []

    // Step 3: Users who filled preferences (have enem_score)
    const { data: preferencesProfiles, count: preferencesSet } = await supabase
      .from('user_preferences')
      .select('user_id', { count: 'exact' })
      .not('enem_score', 'is', null)
    
    const preferencesUserIds = preferencesProfiles?.map(p => p.user_id) || []

    // Step 4: Users who started match workflow
    const { data: matchMessages } = await supabase
      .from('chat_messages')
      .select('user_id')
      .eq('workflow', 'match_workflow')
    
    const matchUserIds = [...new Set(matchMessages?.map(m => m.user_id).filter(Boolean) || [])]
    const uniqueMatchUsers = matchUserIds.length

    // Step 5: Users who saved favorites
    const { data: favoriteRecords } = await supabase
      .from('user_favorites')
      .select('user_id')
    
    const favoriteUserIds = [...new Set(favoriteRecords?.map(f => f.user_id).filter(Boolean) || [])]
    const uniqueFavoriteUsers = favoriteUserIds.length

    // Step 6: Users who engaged in specific workflows (sisu/prouni/fies)
    const { data: specificWorkflowMessages } = await supabase
      .from('chat_messages')
      .select('user_id')
      .in('workflow', ['sisu_workflow', 'prouni_workflow', 'fies_workflow'])
    
    const specificWorkflowUserIds = [...new Set(specificWorkflowMessages?.map(u => u.user_id).filter(Boolean) || [])]
    const uniqueSpecificWorkflowUsers = specificWorkflowUserIds.length

    // Build funnel with optional user_ids for drill-down
    const funnel = [
      { 
        etapa: 'Cadastrados', 
        valor: totalUsers || 0,
        description: funnelDescriptions['Cadastrados'],
        ...(includeDetails && { user_ids: allProfileIds })
      },
      { 
        etapa: 'Onboarding Completo', 
        valor: onboardingCompleted || 0,
        description: funnelDescriptions['Onboarding Completo'],
        ...(includeDetails && { user_ids: onboardingUserIds })
      },
      { 
        etapa: 'Preferências Definidas', 
        valor: preferencesSet || 0,
        description: funnelDescriptions['Preferências Definidas'],
        ...(includeDetails && { user_ids: preferencesUserIds })
      },
      { 
        etapa: 'Match Iniciado', 
        valor: uniqueMatchUsers,
        description: funnelDescriptions['Match Iniciado'],
        ...(includeDetails && { user_ids: matchUserIds })
      },
      { 
        etapa: 'Salvaram Favoritos', 
        valor: uniqueFavoriteUsers,
        description: funnelDescriptions['Salvaram Favoritos'],
        ...(includeDetails && { user_ids: favoriteUserIds })
      },
      { 
        etapa: 'Fluxo Específico', 
        valor: uniqueSpecificWorkflowUsers,
        description: funnelDescriptions['Fluxo Específico'],
        ...(includeDetails && { user_ids: specificWorkflowUserIds })
      },
    ]

    console.log('Analytics funnel response:', funnel.map(f => ({ etapa: f.etapa, valor: f.valor })))

    return new Response(JSON.stringify(funnel), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in analytics-funnel:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
