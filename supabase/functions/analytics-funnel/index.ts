import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Descriptions for each funnel step (INDEPENDENT - each step counted separately)
const funnelDescriptions: Record<string, string> = {
  'Cadastrados': 'Total de usuários na tabela user_profiles',
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

// Helper to fetch all records with pagination (overcomes 1000 row limit)
async function fetchAllWithPagination<T>(
  supabase: any,
  table: string,
  selectColumns: string,
  filters?: { column: string; operator: string; value: any }[]
): Promise<T[]> {
  const allRecords: T[] = []
  let offset = 0
  const batchSize = 1000

  while (true) {
    let query = supabase.from(table).select(selectColumns)
    
    // Apply filters
    if (filters) {
      for (const filter of filters) {
        if (filter.operator === 'eq') {
          query = query.eq(filter.column, filter.value)
        } else if (filter.operator === 'in') {
          query = query.in(filter.column, filter.value)
        } else if (filter.operator === 'neq') {
          query = query.neq(filter.column, filter.value)
        } else if (filter.operator === 'not.is') {
          query = query.not(filter.column, 'is', filter.value)
        }
      }
    }
    
    const { data: batch, error } = await query.range(offset, offset + batchSize - 1)
    
    if (error) {
      console.error(`Error fetching from ${table}:`, error)
      break
    }
    
    if (!batch || batch.length === 0) break
    
    allRecords.push(...batch)
    
    offset += batchSize
    if (batch.length < batchSize) break // Last page
  }
  
  return allRecords
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if details are requested
    let includeDetails = false
    const url = new URL(req.url)
    try {
      const body = await req.json()
      includeDetails = body.details === true
    } catch {
      includeDetails = url.searchParams.get('details') === 'true'
    }

    console.log('Starting INDEPENDENT funnel analysis...')

    // ============================================
    // STEP 1: Cadastrados - todos os user_profiles
    // ============================================
    const allProfiles = await fetchAllWithPagination<{ id: string; full_name: string | null; city: string | null; created_at: string | null; onboarding_completed: boolean | null }>(
      supabase,
      'user_profiles',
      'id, full_name, city, created_at, onboarding_completed'
    )
    const cadastradosIds = allProfiles.map(p => p.id)
    console.log(`Step 1 - Cadastrados: ${cadastradosIds.length}`)

    // ============================================
    // STEP 2: Ativação - usuários que enviaram mensagem (INDEPENDENTE)
    // ============================================
    const activatedMessages = await fetchAllWithPagination<{ user_id: string }>(
      supabase,
      'chat_messages',
      'user_id'
    )
    const ativacaoIds = [...new Set(activatedMessages.map(m => m.user_id).filter(Boolean))]
    console.log(`Step 2 - Ativação: ${ativacaoIds.length}`)

    // ============================================
    // STEP 3: Onboarding Completo - usuários que passaram pelo onboarding_workflow (INDEPENDENTE)
    // ============================================
    const onboardingMessages = await fetchAllWithPagination<{ user_id: string }>(
      supabase,
      'chat_messages',
      'user_id',
      [{ column: 'workflow', operator: 'eq', value: 'onboarding_workflow' }]
    )
    const onboardingCompletedIds = [...new Set(onboardingMessages.map(m => m.user_id).filter(Boolean))]
    console.log(`Step 3 - Onboarding Completo: ${onboardingCompletedIds.length}`)

    // ============================================
    // STEP 4: Preferências Definidas - usuários com preferências (INDEPENDENTE)
    // ============================================
    const preferencesProfiles = await fetchAllWithPagination<{ user_id: string; workflow_data: any; course_interest: string[] | null }>(
      supabase,
      'user_preferences',
      'user_id, workflow_data, course_interest'
    )
    const preferenciasIds = [...new Set(preferencesProfiles.map(p => p.user_id).filter(Boolean))]
    console.log(`Step 4 - Preferências Definidas: ${preferenciasIds.length}`)

    // ============================================
    // STEP 5: Match Iniciado - usuários que iniciaram match workflow (INDEPENDENTE)
    // ============================================
    const matchMessages = await fetchAllWithPagination<{ user_id: string }>(
      supabase,
      'chat_messages',
      'user_id',
      [{ column: 'workflow', operator: 'eq', value: 'match_workflow' }]
    )
    const matchIniciadoIds = [...new Set(matchMessages.map(m => m.user_id).filter(Boolean))]
    console.log(`Step 5 - Match Iniciado: ${matchIniciadoIds.length}`)

    // ============================================
    // STEP 6: Match Realizado - usuários que receberam resultado (INDEPENDENTE)
    // ============================================
    const matchRealizadoIds = [...new Set(
      preferencesProfiles
        .filter(p => {
          if (!p.workflow_data) return false
          if (typeof p.workflow_data === 'object' && Object.keys(p.workflow_data).length === 0) return false
          return true
        })
        .map(p => p.user_id)
        .filter(Boolean)
    )]
    console.log(`Step 6 - Match Realizado: ${matchRealizadoIds.length}`)

    // ============================================
    // STEP 7: Salvaram Favoritos - usuários que salvaram favoritos (INDEPENDENTE)
    // ============================================
    const favoriteRecords = await fetchAllWithPagination<{ user_id: string }>(
      supabase,
      'user_favorites',
      'user_id'
    )
    const favoritosIds = [...new Set(favoriteRecords.map(f => f.user_id).filter(Boolean))]
    console.log(`Step 7 - Salvaram Favoritos: ${favoritosIds.length}`)

    // ============================================
    // Build user data map for drill-down (if requested)
    // ============================================
    let usersDataMap: Map<string, UserData> = new Map()
    
    if (includeDetails) {
      console.log(`Fetching details for ${cadastradosIds.length} users`)
      
      // Create a map of user_id -> course_interest from preferences
      const courseMap = new Map<string, string[]>()
      for (const pref of preferencesProfiles) {
        if (pref.course_interest) {
          courseMap.set(pref.user_id, pref.course_interest)
        }
      }
      
      // Fetch phone numbers from auth.users
      const phoneMap = new Map<string, string>()
      let page = 1
      const perPage = 1000
      
      while (true) {
        const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers({
          page,
          perPage
        })
        
        if (authError) {
          console.error('Error fetching auth users:', authError)
          break
        }
        
        if (!authUsers?.users || authUsers.users.length === 0) break
        
        for (const user of authUsers.users) {
          if (user.phone) {
            phoneMap.set(user.id, user.phone)
          }
        }
        
        if (authUsers.users.length < perPage) break
        page++
      }
      
      // Build complete user data map
      for (const profile of allProfiles) {
        usersDataMap.set(profile.id, {
          id: profile.id,
          full_name: profile.full_name,
          phone: phoneMap.get(profile.id) || null,
          city: profile.city,
          created_at: profile.created_at,
          course_interest: courseMap.get(profile.id) || null
        })
      }
      
      console.log(`Built user data map with ${usersDataMap.size} users, ${phoneMap.size} have phones, ${courseMap.size} have course interests`)
    }

    // Helper to get user data for a list of IDs
    const getUsersData = (userIds: string[]): UserData[] => {
      return userIds
        .map(id => usersDataMap.get(id))
        .filter((u): u is UserData => u !== undefined)
    }

    // Build INDEPENDENT funnel (no conversion rates - each step counted separately)
    const funnel = [
      { 
        etapa: 'Cadastrados', 
        valor: cadastradosIds.length,
        description: funnelDescriptions['Cadastrados'],
        ...(includeDetails && { 
          user_ids: cadastradosIds,
          users: getUsersData(cadastradosIds)
        })
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

    console.log('INDEPENDENT funnel response:', funnel.map(f => ({ 
      etapa: f.etapa, 
      valor: f.valor, 
      usersCount: f.users?.length 
    })))

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
