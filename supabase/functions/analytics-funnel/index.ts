import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const funnelDescriptions: Record<string, string> = {
  'Cadastrados': 'Total de usuários autenticados (auth.users)',
  'Ativos (7d)': 'Usuários que enviaram mensagem ou usaram catálogo nos últimos 7 dias',
  'Inativos (7d)': 'Usuários que só cadastraram, mas não interagiram nos últimos 7 dias',
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

    console.log('Starting funnel analysis...')

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // ========== PARALLEL QUERIES ==========
    const [
      authUsersResult,
      allMessagesResult,
      recentMessagesResult,
      recentFavoritesResult,
      recentPreferencesResult,
      onboardingMessagesResult,
      matchMessagesResult,
      preferencesResult,
      favoritesResult,
      profilesResult,
    ] = await Promise.all([
      // 1. Auth users count
      supabase.auth.admin.listUsers({ page: 1, perPage: 1 }),
      
      // 2. All messages (for activation - users who ever sent a message)
      supabase
        .from('chat_messages')
        .select('user_id')
        .limit(100000),
      
      // 3. Recent messages (7d) for active users
      supabase
        .from('chat_messages')
        .select('user_id')
        .gte('created_at', sevenDaysAgo.toISOString())
        .limit(50000),
      
      // 4. Recent favorites (7d) for active users
      supabase
        .from('user_favorites')
        .select('user_id')
        .gte('created_at', sevenDaysAgo.toISOString())
        .limit(10000),
      
      // 5. Recent preferences (7d) for active users
      supabase
        .from('user_preferences')
        .select('user_id')
        .gte('updated_at', sevenDaysAgo.toISOString())
        .limit(10000),
      
      // 6. Onboarding workflow messages
      supabase
        .from('chat_messages')
        .select('user_id')
        .eq('workflow', 'onboarding_workflow')
        .limit(50000),
      
      // 7. Match workflow messages
      supabase
        .from('chat_messages')
        .select('user_id')
        .eq('workflow', 'match_workflow')
        .limit(50000),
      
      // 8. User preferences (for preferences defined + match realized)
      supabase
        .from('user_preferences')
        .select('user_id, workflow_data, course_interest')
        .limit(10000),
      
      // 9. Favorites (all time)
      supabase
        .from('user_favorites')
        .select('user_id')
        .limit(10000),
      
      // 10. Profiles (for details)
      includeDetails ? supabase
        .from('user_profiles')
        .select('id, full_name, city, created_at') : Promise.resolve({ data: [] }),
    ])

    // Get total from auth metadata
    const totalRegistered = (authUsersResult as any).data?.total || 
      authUsersResult.data?.users?.length || 0

    // Calculate ACTIVE users (7d): users who sent messages OR used catalog
    const recentMessageUserIds = new Set<string>()
    for (const row of recentMessagesResult.data || []) {
      if (row.user_id) recentMessageUserIds.add(row.user_id)
    }
    
    const recentCatalogUserIds = new Set<string>()
    for (const row of recentFavoritesResult.data || []) {
      if (row.user_id && !recentMessageUserIds.has(row.user_id)) {
        recentCatalogUserIds.add(row.user_id)
      }
    }
    for (const row of recentPreferencesResult.data || []) {
      if (row.user_id && !recentMessageUserIds.has(row.user_id)) {
        recentCatalogUserIds.add(row.user_id)
      }
    }
    
    const activeUserIds = [...recentMessageUserIds, ...recentCatalogUserIds]
    const inactiveCount = totalRegistered - activeUserIds.length

    // Ativação: users who EVER sent a message
    const ativacaoIds = [...new Set((allMessagesResult.data || [])
      .map(m => m.user_id)
      .filter(Boolean))]
    
    // Onboarding
    const onboardingCompletedIds = [...new Set((onboardingMessagesResult.data || [])
      .map(m => m.user_id)
      .filter(Boolean))]
    
    // Preferências Definidas
    const preferenciasIds = [...new Set((preferencesResult.data || [])
      .map(p => p.user_id)
      .filter(Boolean))]
    
    // Match Iniciado
    const matchIniciadoIds = [...new Set((matchMessagesResult.data || [])
      .map(m => m.user_id)
      .filter(Boolean))]
    
    // Match Realizado
    const matchRealizadoIds = [...new Set((preferencesResult.data || [])
      .filter(p => {
        if (!p.workflow_data) return false
        if (typeof p.workflow_data === 'object' && Object.keys(p.workflow_data).length === 0) return false
        return true
      })
      .map(p => p.user_id)
      .filter(Boolean))]
    
    // Favoritos
    const favoritosIds = [...new Set((favoritesResult.data || [])
      .map(f => f.user_id)
      .filter(Boolean))]

    console.log('Funnel counts:', {
      cadastrados: totalRegistered,
      ativos7d: activeUserIds.length,
      inativos7d: inactiveCount,
      ativacao: ativacaoIds.length,
      onboarding: onboardingCompletedIds.length,
      preferencias: preferenciasIds.length,
      matchIniciado: matchIniciadoIds.length,
      matchRealizado: matchRealizadoIds.length,
      favoritos: favoritosIds.length,
    })

    // Build user data map for drill-down
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
      
      for (const userId of [...ativacaoIds, ...preferenciasIds, ...favoritosIds, ...activeUserIds]) {
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

    // Build funnel response - NOW INCLUDING ACTIVE/INACTIVE
    const funnel = [
      { 
        etapa: 'Cadastrados', 
        valor: totalRegistered,
        description: funnelDescriptions['Cadastrados'],
      },
      { 
        etapa: 'Ativos (7d)', 
        valor: activeUserIds.length,
        description: funnelDescriptions['Ativos (7d)'],
        ...(includeDetails && { 
          user_ids: activeUserIds,
          users: getUsersData(activeUserIds)
        })
      },
      { 
        etapa: 'Inativos (7d)', 
        valor: inactiveCount,
        description: funnelDescriptions['Inativos (7d)'],
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

    console.log('Funnel response ready')

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