import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const funnelDescriptions: Record<string, string> = {
  'Cadastrados': 'Total de usuários autenticados (auth.users)',
  'Ativação': 'Usuários que enviaram ao menos 1 mensagem',
  'Onboarding Completo': 'Usuários que passaram pelo workflow de onboarding',
  'Preferências Definidas': 'Usuários que preencheram preferências',
  'Match Iniciado': 'Usuários que iniciaram o workflow de match',
  'Match Realizado': 'Usuários que receberam resultado (workflow_data preenchido)',
  'Salvaram Favoritos': 'Usuários que salvaram ao menos 1 favorito',
}

interface UserData {
  id: string;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  created_at: string | null;
  course_interest: string[] | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let includeDetails = false
    const url = new URL(req.url)
    try {
      const body = await req.json()
      includeDetails = body.details === true
    } catch {
      includeDetails = url.searchParams.get('details') === 'true'
    }

    console.log('Starting OPTIMIZED funnel analysis...')

    // ========== PARALLEL QUERIES ==========
    // Run all queries in parallel for maximum speed
    const [
      authUsersResult,
      allMessagesResult,
      onboardingMessagesResult,
      matchMessagesResult,
      preferencesResult,
      favoritesResult,
      profilesResult,
    ] = await Promise.all([
      // 1. Auth users count (single call)
      supabase.auth.admin.listUsers({ page: 1, perPage: 1 }),
      
      // 2. All messages (for activation) - with high limit
      supabase
        .from('chat_messages')
        .select('user_id')
        .limit(100000),
      
      // 3. Onboarding workflow messages
      supabase
        .from('chat_messages')
        .select('user_id')
        .eq('workflow', 'onboarding_workflow')
        .limit(50000),
      
      // 4. Match workflow messages
      supabase
        .from('chat_messages')
        .select('user_id')
        .eq('workflow', 'match_workflow')
        .limit(50000),
      
      // 5. User preferences (for preferences defined + match realized)
      supabase
        .from('user_preferences')
        .select('user_id, workflow_data, course_interest')
        .limit(10000),
      
      // 6. Favorites
      supabase
        .from('user_favorites')
        .select('user_id')
        .limit(10000),
      
      // 7. Profiles (for details)
      includeDetails ? supabase
        .from('user_profiles')
        .select('id, full_name, city, created_at') : Promise.resolve({ data: [] }),
    ])

    // Get total from auth metadata or count
    const totalRegistered = (authUsersResult as any).data?.total || 
      authUsersResult.data?.users?.length || 0

    // Step 2: Ativação
    const ativacaoIds = [...new Set((allMessagesResult.data || [])
      .map(m => m.user_id)
      .filter(Boolean))]
    
    // Step 3: Onboarding
    const onboardingCompletedIds = [...new Set((onboardingMessagesResult.data || [])
      .map(m => m.user_id)
      .filter(Boolean))]
    
    // Step 4: Preferências Definidas
    const preferenciasIds = [...new Set((preferencesResult.data || [])
      .map(p => p.user_id)
      .filter(Boolean))]
    
    // Step 5: Match Iniciado
    const matchIniciadoIds = [...new Set((matchMessagesResult.data || [])
      .map(m => m.user_id)
      .filter(Boolean))]
    
    // Step 6: Match Realizado
    const matchRealizadoIds = [...new Set((preferencesResult.data || [])
      .filter(p => {
        if (!p.workflow_data) return false
        if (typeof p.workflow_data === 'object' && Object.keys(p.workflow_data).length === 0) return false
        return true
      })
      .map(p => p.user_id)
      .filter(Boolean))]
    
    // Step 7: Favoritos
    const favoritosIds = [...new Set((favoritesResult.data || [])
      .map(f => f.user_id)
      .filter(Boolean))]

    console.log('Funnel counts:', {
      cadastrados: totalRegistered,
      ativacao: ativacaoIds.length,
      onboarding: onboardingCompletedIds.length,
      preferencias: preferenciasIds.length,
      matchIniciado: matchIniciadoIds.length,
      matchRealizado: matchRealizadoIds.length,
      favoritos: favoritosIds.length,
    })

    // Build user data map for drill-down (if requested)
    let usersDataMap: Map<string, UserData> = new Map()
    
    if (includeDetails) {
      const courseMap = new Map<string, string[]>()
      for (const pref of preferencesResult.data || []) {
        if (pref.course_interest) {
          courseMap.set(pref.user_id, pref.course_interest)
        }
      }
      
      const profileDataMap = new Map<string, { full_name: string | null; city: string | null; created_at: string | null }>()
      for (const profile of profilesResult.data || []) {
        profileDataMap.set(profile.id, {
          full_name: profile.full_name,
          city: profile.city,
          created_at: profile.created_at
        })
      }
      
      // For cadastrados, we only have the count, not individual IDs
      // So details will only be available for other steps
      for (const userId of [...ativacaoIds, ...preferenciasIds, ...favoritosIds]) {
        if (!usersDataMap.has(userId)) {
          const profileData = profileDataMap.get(userId)
          usersDataMap.set(userId, {
            id: userId,
            full_name: profileData?.full_name || null,
            phone: null,
            city: profileData?.city || null,
            created_at: profileData?.created_at || null,
            course_interest: courseMap.get(userId) || null
          })
        }
      }
    }

    const getUsersData = (userIds: string[]): UserData[] => {
      return userIds
        .map(id => usersDataMap.get(id))
        .filter((u): u is UserData => u !== undefined)
    }

    // Build funnel response
    const funnel = [
      { 
        etapa: 'Cadastrados', 
        valor: totalRegistered,
        description: funnelDescriptions['Cadastrados'],
      },
      { 
        etapa: 'Ativação', 
        valor: ativacaoIds.length,
        description: funnelDescriptions['Ativação'],
        ...(includeDetails && { 
          user_ids: ativacaoIds,
          users: getUsersData(ativacaoIds)
        })
      },
      { 
        etapa: 'Onboarding Completo', 
        valor: onboardingCompletedIds.length,
        description: funnelDescriptions['Onboarding Completo'],
        ...(includeDetails && { 
          user_ids: onboardingCompletedIds,
          users: getUsersData(onboardingCompletedIds)
        })
      },
      { 
        etapa: 'Preferências Definidas', 
        valor: preferenciasIds.length,
        description: funnelDescriptions['Preferências Definidas'],
        ...(includeDetails && { 
          user_ids: preferenciasIds,
          users: getUsersData(preferenciasIds)
        })
      },
      { 
        etapa: 'Match Iniciado', 
        valor: matchIniciadoIds.length,
        description: funnelDescriptions['Match Iniciado'],
        ...(includeDetails && { 
          user_ids: matchIniciadoIds,
          users: getUsersData(matchIniciadoIds)
        })
      },
      { 
        etapa: 'Match Realizado', 
        valor: matchRealizadoIds.length,
        description: funnelDescriptions['Match Realizado'],
        ...(includeDetails && { 
          user_ids: matchRealizadoIds,
          users: getUsersData(matchRealizadoIds)
        })
      },
      { 
        etapa: 'Salvaram Favoritos', 
        valor: favoritosIds.length,
        description: funnelDescriptions['Salvaram Favoritos'],
        ...(includeDetails && { 
          user_ids: favoritosIds,
          users: getUsersData(favoritosIds)
        })
      },
    ]

    console.log('Optimized funnel response ready')

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