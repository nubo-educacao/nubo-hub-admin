import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Descriptions for each funnel step (CUMULATIVE - each step requires previous steps)
const funnelDescriptions: Record<string, string> = {
  'Cadastrados': 'Total de usuários na tabela user_profiles',
  'Ativação': 'Cadastrados que enviaram ao menos 1 mensagem',
  'Onboarding Completo': 'Ativados que completaram onboarding (onboarding_completed = true)',
  'Preferências Definidas': 'Onboarding completo que definiram preferências',
  'Match Iniciado': 'Preferências definidas que iniciaram o workflow de match',
  'Match Realizado': 'Match iniciado que receberam resultado (workflow_data preenchido)',
  'Salvaram Favoritos': 'Match realizado que salvaram ao menos 1 favorito',
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

// Helper to calculate conversion rate
function calcConversionRate(current: number, previous: number): string {
  if (previous === 0) return '0.0'
  return ((current / previous) * 100).toFixed(1)
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

    console.log('Starting CUMULATIVE funnel analysis...')

    // ============================================
    // STEP 1: Cadastrados - todos os user_profiles
    // ============================================
    const allProfiles = await fetchAllWithPagination<{ id: string; full_name: string | null; city: string | null; created_at: string | null; onboarding_completed: boolean | null }>(
      supabase,
      'user_profiles',
      'id, full_name, city, created_at, onboarding_completed'
    )
    const cadastradosSet = new Set(allProfiles.map(p => p.id))
    console.log(`Step 1 - Cadastrados: ${cadastradosSet.size}`)

    // ============================================
    // STEP 2: Ativação - cadastrados QUE enviaram mensagem
    // ============================================
    const activatedMessages = await fetchAllWithPagination<{ user_id: string }>(
      supabase,
      'chat_messages',
      'user_id'
    )
    const allActivatedIds = [...new Set(activatedMessages.map(m => m.user_id).filter(Boolean))]
    // CUMULATIVE: only count those who are in cadastradosSet
    const ativacaoSet = new Set(allActivatedIds.filter(id => cadastradosSet.has(id)))
    console.log(`Step 2 - Ativação: ${ativacaoSet.size} (of ${allActivatedIds.length} total activated)`)

    // ============================================
    // STEP 3: Onboarding Completo - ativados QUE completaram onboarding
    // ============================================
    const onboardingCompletedIds = allProfiles
      .filter(p => p.onboarding_completed === true)
      .map(p => p.id)
    // CUMULATIVE: only count those who are in ativacaoSet
    const onboardingSet = new Set(onboardingCompletedIds.filter(id => ativacaoSet.has(id)))
    console.log(`Step 3 - Onboarding Completo: ${onboardingSet.size} (of ${onboardingCompletedIds.length} total with onboarding)`)

    // ============================================
    // STEP 4: Preferências Definidas - onboarding QUE definiram preferências
    // ============================================
    const preferencesProfiles = await fetchAllWithPagination<{ user_id: string; workflow_data: any; course_interest: string[] | null }>(
      supabase,
      'user_preferences',
      'user_id, workflow_data, course_interest'
    )
    const allPreferencesIds = [...new Set(preferencesProfiles.map(p => p.user_id).filter(Boolean))]
    // CUMULATIVE: only count those who are in onboardingSet
    const preferenciasSet = new Set(allPreferencesIds.filter(id => onboardingSet.has(id)))
    console.log(`Step 4 - Preferências Definidas: ${preferenciasSet.size} (of ${allPreferencesIds.length} total with preferences)`)

    // ============================================
    // STEP 5: Match Iniciado - preferências QUE iniciaram match workflow
    // ============================================
    const matchMessages = await fetchAllWithPagination<{ user_id: string }>(
      supabase,
      'chat_messages',
      'user_id',
      [{ column: 'workflow', operator: 'eq', value: 'match_workflow' }]
    )
    const allMatchInitiatedIds = [...new Set(matchMessages.map(m => m.user_id).filter(Boolean))]
    // CUMULATIVE: only count those who are in preferenciasSet
    const matchIniciadoSet = new Set(allMatchInitiatedIds.filter(id => preferenciasSet.has(id)))
    console.log(`Step 5 - Match Iniciado: ${matchIniciadoSet.size} (of ${allMatchInitiatedIds.length} total who initiated match)`)

    // ============================================
    // STEP 6: Match Realizado - match iniciado QUE receberam resultado
    // ============================================
    // Filter users where workflow_data is not null and not an empty object
    const allMatchCompletedIds = [...new Set(
      preferencesProfiles
        .filter(p => {
          if (!p.workflow_data) return false
          if (typeof p.workflow_data === 'object' && Object.keys(p.workflow_data).length === 0) return false
          return true
        })
        .map(p => p.user_id)
        .filter(Boolean)
    )]
    // CUMULATIVE: only count those who are in matchIniciadoSet
    const matchRealizadoSet = new Set(allMatchCompletedIds.filter(id => matchIniciadoSet.has(id)))
    console.log(`Step 6 - Match Realizado: ${matchRealizadoSet.size} (of ${allMatchCompletedIds.length} total who completed match)`)

    // ============================================
    // STEP 7: Salvaram Favoritos - match realizado QUE salvaram favoritos
    // ============================================
    const favoriteRecords = await fetchAllWithPagination<{ user_id: string }>(
      supabase,
      'user_favorites',
      'user_id'
    )
    const allFavoriteIds = [...new Set(favoriteRecords.map(f => f.user_id).filter(Boolean))]
    // CUMULATIVE: only count those who are in matchRealizadoSet
    const favoritosSet = new Set(allFavoriteIds.filter(id => matchRealizadoSet.has(id)))
    console.log(`Step 7 - Salvaram Favoritos: ${favoritosSet.size} (of ${allFavoriteIds.length} total who saved favorites)`)

    // ============================================
    // Build user data map for drill-down (if requested)
    // ============================================
    let usersDataMap: Map<string, UserData> = new Map()
    
    if (includeDetails) {
      const allUserIds = [...cadastradosSet]
      console.log(`Fetching details for ${allUserIds.length} users`)
      
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

    // Convert Sets to arrays for response
    const cadastradosArr = [...cadastradosSet]
    const ativacaoArr = [...ativacaoSet]
    const onboardingArr = [...onboardingSet]
    const preferenciasArr = [...preferenciasSet]
    const matchIniciadoArr = [...matchIniciadoSet]
    const matchRealizadoArr = [...matchRealizadoSet]
    const favoritosArr = [...favoritosSet]

    // Build CUMULATIVE funnel with conversion rates
    const funnel = [
      { 
        etapa: 'Cadastrados', 
        valor: cadastradosSet.size,
        taxa_conversao: '100.0',
        taxa_conversao_anterior: null,
        description: funnelDescriptions['Cadastrados'],
        ...(includeDetails && { 
          user_ids: cadastradosArr,
          users: getUsersData(cadastradosArr)
        })
      },
      { 
        etapa: 'Ativação', 
        valor: ativacaoSet.size,
        taxa_conversao: calcConversionRate(ativacaoSet.size, cadastradosSet.size),
        taxa_conversao_anterior: calcConversionRate(ativacaoSet.size, cadastradosSet.size),
        description: funnelDescriptions['Ativação'],
        ...(includeDetails && { 
          user_ids: ativacaoArr,
          users: getUsersData(ativacaoArr)
        })
      },
      { 
        etapa: 'Onboarding Completo', 
        valor: onboardingSet.size,
        taxa_conversao: calcConversionRate(onboardingSet.size, cadastradosSet.size),
        taxa_conversao_anterior: calcConversionRate(onboardingSet.size, ativacaoSet.size),
        description: funnelDescriptions['Onboarding Completo'],
        ...(includeDetails && { 
          user_ids: onboardingArr,
          users: getUsersData(onboardingArr)
        })
      },
      { 
        etapa: 'Preferências Definidas', 
        valor: preferenciasSet.size,
        taxa_conversao: calcConversionRate(preferenciasSet.size, cadastradosSet.size),
        taxa_conversao_anterior: calcConversionRate(preferenciasSet.size, onboardingSet.size),
        description: funnelDescriptions['Preferências Definidas'],
        ...(includeDetails && { 
          user_ids: preferenciasArr,
          users: getUsersData(preferenciasArr)
        })
      },
      { 
        etapa: 'Match Iniciado', 
        valor: matchIniciadoSet.size,
        taxa_conversao: calcConversionRate(matchIniciadoSet.size, cadastradosSet.size),
        taxa_conversao_anterior: calcConversionRate(matchIniciadoSet.size, preferenciasSet.size),
        description: funnelDescriptions['Match Iniciado'],
        ...(includeDetails && { 
          user_ids: matchIniciadoArr,
          users: getUsersData(matchIniciadoArr)
        })
      },
      { 
        etapa: 'Match Realizado', 
        valor: matchRealizadoSet.size,
        taxa_conversao: calcConversionRate(matchRealizadoSet.size, cadastradosSet.size),
        taxa_conversao_anterior: calcConversionRate(matchRealizadoSet.size, matchIniciadoSet.size),
        description: funnelDescriptions['Match Realizado'],
        ...(includeDetails && { 
          user_ids: matchRealizadoArr,
          users: getUsersData(matchRealizadoArr)
        })
      },
      { 
        etapa: 'Salvaram Favoritos', 
        valor: favoritosSet.size,
        taxa_conversao: calcConversionRate(favoritosSet.size, cadastradosSet.size),
        taxa_conversao_anterior: calcConversionRate(favoritosSet.size, matchRealizadoSet.size),
        description: funnelDescriptions['Salvaram Favoritos'],
        ...(includeDetails && { 
          user_ids: favoritosArr,
          users: getUsersData(favoritosArr)
        })
      },
    ]

    console.log('CUMULATIVE funnel response:', funnel.map(f => ({ 
      etapa: f.etapa, 
      valor: f.valor, 
      taxa_anterior: f.taxa_conversao_anterior,
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
