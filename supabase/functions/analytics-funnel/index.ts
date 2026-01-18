import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Step 1: Total registered users
    const { count: totalUsers } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })

    // Step 2: Users who completed onboarding
    const { count: onboardingCompleted } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('onboarding_completed', true)

    // Step 3: Users who filled preferences (have enem_score)
    const { count: preferencesSet } = await supabase
      .from('user_preferences')
      .select('*', { count: 'exact', head: true })
      .not('enem_score', 'is', null)

    // Step 4: Users who started match workflow
    const { data: matchUsers } = await supabase
      .from('chat_messages')
      .select('user_id')
      .eq('workflow', 'match_workflow')
    
    const uniqueMatchUsers = new Set(matchUsers?.map(m => m.user_id) || []).size

    // Step 5: Users who saved favorites
    const { data: favoriteUsers } = await supabase
      .from('user_favorites')
      .select('user_id')
    
    const uniqueFavoriteUsers = new Set(favoriteUsers?.map(f => f.user_id) || []).size

    // Step 6: Users who engaged in specific workflows (sisu/prouni)
    const { data: specificWorkflowUsers } = await supabase
      .from('chat_messages')
      .select('user_id')
      .in('workflow', ['sisu_workflow', 'prouni_workflow', 'fies_workflow'])
    
    const uniqueSpecificWorkflowUsers = new Set(specificWorkflowUsers?.map(u => u.user_id) || []).size

    const funnel = [
      { etapa: 'Cadastrados', valor: totalUsers || 0 },
      { etapa: 'Onboarding Completo', valor: onboardingCompleted || 0 },
      { etapa: 'Preferências Definidas', valor: preferencesSet || 0 },
      { etapa: 'Match Iniciado', valor: uniqueMatchUsers },
      { etapa: 'Salvaram Favoritos', valor: uniqueFavoriteUsers },
      { etapa: 'Fluxo Específico', valor: uniqueSpecificWorkflowUsers },
    ]

    console.log('Analytics funnel response:', funnel)

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
