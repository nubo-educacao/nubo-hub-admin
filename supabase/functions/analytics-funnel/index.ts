import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Descriptions for each funnel step
const funnelDescriptions: Record<string, string> = {
  'Cadastrados': 'Total de usuários na tabela user_profiles',
  'Ativação': 'Usuários que enviaram ao menos 1 mensagem (registro em chat_messages)',
  'Onboarding Completo': 'Usuários com onboarding_completed = true na tabela user_profiles',
  'Preferências Definidas': 'Usuários únicos com registro em user_preferences',
  'Match Iniciado': 'Usuários únicos que iniciaram o workflow de match (workflow = match_workflow em chat_messages)',
  'Match Realizado': 'Usuários que receberam resultado do match (workflow_data diferente de {} em user_preferences)',
  'Salvaram Favoritos': 'Usuários únicos que salvaram ao menos 1 favorito na tabela user_favorites',
  'Fluxo Específico': 'Usuários que entraram em SISU, ProUni ou FIES workflow (workflow in sisu_workflow, prouni_workflow, fies_workflow)',
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

    console.log('Starting funnel analysis with pagination...')

    // Step 1: Total registered users (with pagination)
    const allProfiles = await fetchAllWithPagination<{ id: string; full_name: string | null; city: string | null; created_at: string | null }>(
      supabase,
      'user_profiles',
      'id, full_name, city, created_at'
    )
    const totalUsers = allProfiles.length
    const allProfileIds = allProfiles.map(p => p.id)
    console.log(`Step 1 - Cadastrados: ${totalUsers}`)

    // Step 1.5: Users who sent at least 1 message (Activation) - with pagination
    const activatedMessages = await fetchAllWithPagination<{ user_id: string }>(
      supabase,
      'chat_messages',
      'user_id'
    )
    const activatedUserIds = [...new Set(activatedMessages.map(m => m.user_id).filter(Boolean))]
    const uniqueActivatedUsers = activatedUserIds.length
    console.log(`Step 1.5 - Ativação: ${uniqueActivatedUsers}`)

    // Step 2: Users who completed onboarding (with pagination)
    const onboardingProfiles = await fetchAllWithPagination<{ id: string; full_name: string | null; city: string | null; created_at: string | null }>(
      supabase,
      'user_profiles',
      'id, full_name, city, created_at',
      [{ column: 'onboarding_completed', operator: 'eq', value: true }]
    )
    const onboardingCompleted = onboardingProfiles.length
    const onboardingUserIds = onboardingProfiles.map(p => p.id)
    console.log(`Step 2 - Onboarding Completo: ${onboardingCompleted}`)

    // Step 3: Users who have any preferences record (with pagination)
    const preferencesProfiles = await fetchAllWithPagination<{ user_id: string }>(
      supabase,
      'user_preferences',
      'user_id'
    )
    const preferencesUserIds = [...new Set(preferencesProfiles.map(p => p.user_id).filter(Boolean))]
    const preferencesSet = preferencesUserIds.length
    console.log(`Step 3 - Preferências Definidas: ${preferencesSet}`)

    // Step 4: Users who started match workflow (with pagination)
    const matchMessages = await fetchAllWithPagination<{ user_id: string }>(
      supabase,
      'chat_messages',
      'user_id',
      [{ column: 'workflow', operator: 'eq', value: 'match_workflow' }]
    )
    const matchUserIds = [...new Set(matchMessages.map(m => m.user_id).filter(Boolean))]
    const uniqueMatchUsers = matchUserIds.length
    console.log(`Step 4 - Match Iniciado: ${uniqueMatchUsers}`)

    // Step 4.5: Users who completed match (workflow_data is not empty {}) - with pagination
    const matchCompletedProfiles = await fetchAllWithPagination<{ user_id: string; workflow_data: any }>(
      supabase,
      'user_preferences',
      'user_id, workflow_data'
    )
    // Filter users where workflow_data is not null and not an empty object
    const matchCompletedUserIds = [...new Set(
      matchCompletedProfiles
        .filter(p => {
          if (!p.workflow_data) return false
          // Check if it's an empty object
          if (typeof p.workflow_data === 'object' && Object.keys(p.workflow_data).length === 0) return false
          return true
        })
        .map(p => p.user_id)
        .filter(Boolean)
    )]
    const uniqueMatchCompletedUsers = matchCompletedUserIds.length
    console.log(`Step 4.5 - Match Realizado: ${uniqueMatchCompletedUsers}`)

    // Step 5: Users who saved favorites (with pagination)
    const favoriteRecords = await fetchAllWithPagination<{ user_id: string }>(
      supabase,
      'user_favorites',
      'user_id'
    )
    const favoriteUserIds = [...new Set(favoriteRecords.map(f => f.user_id).filter(Boolean))]
    const uniqueFavoriteUsers = favoriteUserIds.length
    console.log(`Step 5 - Salvaram Favoritos: ${uniqueFavoriteUsers}`)

    // Step 6: Users who engaged in specific workflows (sisu/prouni/fies) - with pagination
    const specificWorkflowMessages = await fetchAllWithPagination<{ user_id: string }>(
      supabase,
      'chat_messages',
      'user_id',
      [{ column: 'workflow', operator: 'in', value: ['sisu_workflow', 'prouni_workflow', 'fies_workflow'] }]
    )
    const specificWorkflowUserIds = [...new Set(specificWorkflowMessages.map(u => u.user_id).filter(Boolean))]
    const uniqueSpecificWorkflowUsers = specificWorkflowUserIds.length
    console.log(`Step 6 - Fluxo Específico: ${uniqueSpecificWorkflowUsers}`)

    // If details are requested, fetch complete user data including phone from auth.users
    let usersDataMap: Map<string, UserData> = new Map()
    
    if (includeDetails) {
      // Get all unique user IDs across all steps
      const allUserIds = [...new Set([
        ...allProfileIds,
        ...activatedUserIds,
        ...onboardingUserIds,
        ...preferencesUserIds,
        ...matchUserIds,
        ...matchCompletedUserIds,
        ...favoriteUserIds,
        ...specificWorkflowUserIds
      ])]
      
      console.log(`Fetching details for ${allUserIds.length} users`)
      
      // Fetch user profiles with pagination (already fetched above, reuse)
      const profilesData = allProfiles
      
      // Fetch user preferences (for course_interest) with pagination
      const preferencesData = await fetchAllWithPagination<{ user_id: string; course_interest: string[] | null }>(
        supabase,
        'user_preferences',
        'user_id, course_interest'
      )
      
      // Create a map of user_id -> course_interest
      const courseMap = new Map<string, string[]>()
      for (const pref of preferencesData) {
        if (pref.course_interest) {
          courseMap.set(pref.user_id, pref.course_interest)
        }
      }
      
      // Fetch phone numbers from auth.users using admin API with pagination
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
      for (const profile of profilesData) {
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

    // Build funnel with optional users data for drill-down
    const funnel = [
      { 
        etapa: 'Cadastrados', 
        valor: totalUsers,
        description: funnelDescriptions['Cadastrados'],
        ...(includeDetails && { 
          user_ids: allProfileIds,
          users: getUsersData(allProfileIds)
        })
      },
      { 
        etapa: 'Ativação', 
        valor: uniqueActivatedUsers,
        description: funnelDescriptions['Ativação'],
        ...(includeDetails && { 
          user_ids: activatedUserIds,
          users: getUsersData(activatedUserIds as string[])
        })
      },
      { 
        etapa: 'Onboarding Completo', 
        valor: onboardingCompleted,
        description: funnelDescriptions['Onboarding Completo'],
        ...(includeDetails && { 
          user_ids: onboardingUserIds,
          users: getUsersData(onboardingUserIds)
        })
      },
      { 
        etapa: 'Preferências Definidas', 
        valor: preferencesSet,
        description: funnelDescriptions['Preferências Definidas'],
        ...(includeDetails && { 
          user_ids: preferencesUserIds,
          users: getUsersData(preferencesUserIds)
        })
      },
      { 
        etapa: 'Match Iniciado', 
        valor: uniqueMatchUsers,
        description: funnelDescriptions['Match Iniciado'],
        ...(includeDetails && { 
          user_ids: matchUserIds,
          users: getUsersData(matchUserIds as string[])
        })
      },
      { 
        etapa: 'Match Realizado', 
        valor: uniqueMatchCompletedUsers,
        description: funnelDescriptions['Match Realizado'],
        ...(includeDetails && { 
          user_ids: matchCompletedUserIds,
          users: getUsersData(matchCompletedUserIds as string[])
        })
      },
      { 
        etapa: 'Salvaram Favoritos', 
        valor: uniqueFavoriteUsers,
        description: funnelDescriptions['Salvaram Favoritos'],
        ...(includeDetails && { 
          user_ids: favoriteUserIds,
          users: getUsersData(favoriteUserIds as string[])
        })
      },
      { 
        etapa: 'Fluxo Específico', 
        valor: uniqueSpecificWorkflowUsers,
        description: funnelDescriptions['Fluxo Específico'],
        ...(includeDetails && { 
          user_ids: specificWorkflowUserIds,
          users: getUsersData(specificWorkflowUserIds as string[])
        })
      },
    ]

    console.log('Analytics funnel response:', funnel.map(f => ({ etapa: f.etapa, valor: f.valor, usersCount: f.users?.length })))

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
