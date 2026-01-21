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

// Helper to fetch all rows with pagination
// deno-lint-ignore no-explicit-any
async function fetchAllRows<T>(
  supabase: any,
  table: string,
  select: string,
  filters?: { column: string; operator: string; value: string | boolean }[]
): Promise<T[]> {
  const allRows: T[] = []
  const pageSize = 1000
  let from = 0
  let hasMore = true

  while (hasMore) {
    let query = supabase.from(table).select(select).range(from, from + pageSize - 1)
    
    if (filters) {
      for (const f of filters) {
        if (f.operator === 'gte') query = query.gte(f.column, f.value)
        else if (f.operator === 'lt') query = query.lt(f.column, f.value)
        else if (f.operator === 'eq') query = query.eq(f.column, f.value)
      }
    }

    const { data, error } = await query
    if (error) throw error

    if (data && data.length > 0) {
      allRows.push(...(data as T[]))
      from += pageSize
      hasMore = data.length === pageSize
    } else {
      hasMore = false
    }
  }

  return allRows
}

// Helper to fetch all auth users with pagination
// deno-lint-ignore no-explicit-any
async function fetchAllAuthUsers(supabase: any): Promise<{ data: { users: { id: string; phone: string | null; created_at: string }[]; total: number } }> {
  const allUsers: { id: string; phone: string | null; created_at: string }[] = []
  const pageSize = 1000
  let page = 1
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: pageSize })
    if (error) throw error

    if (data?.users && data.users.length > 0) {
      allUsers.push(...data.users.map((u: { id: string; phone: string | null; created_at: string }) => ({
        id: u.id,
        phone: u.phone,
        created_at: u.created_at
      })))
      page++
      hasMore = data.users.length === pageSize
    } else {
      hasMore = false
    }
  }

  return { data: { users: allUsers, total: allUsers.length } }
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

    console.log('Starting funnel analysis with full pagination...')

    // ========== PARALLEL QUERIES WITH FULL PAGINATION ==========
    const [
      authUsersResult,
      allMessagesResult,
      preferencesResult,
      favoritesResult,
      profilesResult,
    ] = await Promise.all([
      // 1. Auth users - fetch ALL to get phone numbers when includeDetails
      includeDetails 
        ? fetchAllAuthUsers(supabase)
        : supabase.auth.admin.listUsers({ page: 1, perPage: 1 }),
      
      // 2. ALL messages with pagination
      fetchAllRows<{ user_id: string; workflow: string | null }>(
        supabase, 'chat_messages', 'user_id, workflow'
      ),
      
      // 3. ALL preferences with pagination
      fetchAllRows<{ user_id: string; workflow_data: unknown; course_interest: string[] | null }>(
        supabase, 'user_preferences', 'user_id, workflow_data, course_interest'
      ),
      
      // 4. ALL favorites with pagination
      fetchAllRows<{ user_id: string }>(
        supabase, 'user_favorites', 'user_id'
      ),
      
      // 5. Profiles (for details)
      includeDetails ? fetchAllRows<{ id: string; full_name: string | null; city: string | null; created_at: string | null }>(
        supabase, 'user_profiles', 'id, full_name, city, created_at'
      ) : Promise.resolve([]),
    ])

    // Get total from auth metadata - works for both includeDetails and non-includeDetails cases
    const authData = (authUsersResult as { data?: { users?: unknown[]; total?: number } }).data
    const totalRegistered = authData?.total || authData?.users?.length || 0

    console.log('Total messages fetched:', allMessagesResult.length)
    console.log('Total preferences fetched:', preferencesResult.length)
    console.log('Total favorites fetched:', favoritesResult.length)

    // Process messages for funnel stages
    const ativacaoSet = new Set<string>()
    const onboardingSet = new Set<string>()
    const matchIniciadoSet = new Set<string>()

    for (const msg of allMessagesResult) {
      if (!msg.user_id) continue
      
      // Ativação = any message
      ativacaoSet.add(msg.user_id)
      
      // Onboarding = onboarding_workflow
      if (msg.workflow === 'onboarding_workflow') {
        onboardingSet.add(msg.user_id)
      }
      
      // Match iniciado = match_workflow
      if (msg.workflow === 'match_workflow') {
        matchIniciadoSet.add(msg.user_id)
      }
    }

    const ativacaoIds = [...ativacaoSet]
    const onboardingCompletedIds = [...onboardingSet]
    const matchIniciadoIds = [...matchIniciadoSet]
    
    // Preferências Definidas
    const preferenciasIds = [...new Set(preferencesResult.map(p => p.user_id).filter(Boolean))]
    
    // Match Realizado
    const matchRealizadoIds = [...new Set(preferencesResult
      .filter(p => {
        if (!p.workflow_data) return false
        if (typeof p.workflow_data === 'object' && Object.keys(p.workflow_data as object).length === 0) return false
        return true
      })
      .map(p => p.user_id)
      .filter(Boolean))]
    
    // Favoritos
    const favoritosIds = [...new Set(favoritesResult.map(f => f.user_id).filter(Boolean))]

    console.log('Funnel counts:', {
      cadastrados: totalRegistered,
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
      // Build phone map from auth users
      const phoneMap = new Map<string, string | null>()
      const authCreatedMap = new Map<string, string>()
      const authUsers = (authUsersResult as { data: { users: { id: string; phone: string | null; created_at: string }[] } }).data?.users || []
      for (const user of authUsers) {
        phoneMap.set(user.id, user.phone)
        authCreatedMap.set(user.id, user.created_at)
      }
      
      const courseMap = new Map<string, string[]>()
      for (const pref of preferencesResult) {
        if (pref.course_interest) {
          courseMap.set(pref.user_id, pref.course_interest)
        }
      }
      
      const profileDataMap = new Map<string, { full_name: string | null; city: string | null; created_at: string | null }>()
      for (const profile of profilesResult) {
        profileDataMap.set(profile.id, {
          full_name: profile.full_name,
          city: profile.city,
          created_at: profile.created_at
        })
      }
      
      // Collect all unique user IDs from all funnel stages
      const allUserIds = new Set([
        ...ativacaoIds, 
        ...onboardingCompletedIds,
        ...preferenciasIds, 
        ...matchIniciadoIds,
        ...matchRealizadoIds,
        ...favoritosIds
      ])
      
      for (const userId of allUserIds) {
        const profileData = profileDataMap.get(userId)
        // Use auth.users created_at as primary, fallback to profile
        const createdAt = authCreatedMap.get(userId) || profileData?.created_at || null
        usersDataMap.set(userId, {
          id: userId,
          full_name: profileData?.full_name || null,
          phone: phoneMap.get(userId) || null,
          city: profileData?.city || null,
          created_at: createdAt,
          course_interest: courseMap.get(userId) || null
        })
      }
    }

    const getUsersData = (userIds: string[]): UserData[] => {
      return userIds
        .map(id => usersDataMap.get(id))
        .filter((u): u is UserData => u !== undefined)
    }

    // Build funnel response (NO inativos)
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