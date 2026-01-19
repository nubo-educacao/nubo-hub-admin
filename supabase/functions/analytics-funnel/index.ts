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

    // Step 1: Total registered users
    const { data: allProfiles, count: totalUsers } = await supabase
      .from('user_profiles')
      .select('id, full_name, city, created_at', { count: 'exact' })
    
    const allProfileIds = allProfiles?.map(p => p.id) || []

    // Step 1.5: Users who sent at least 1 message (Activation)
    const { data: activatedMessages } = await supabase
      .from('chat_messages')
      .select('user_id')
    
    const activatedUserIds = [...new Set(activatedMessages?.map(m => m.user_id).filter(Boolean) || [])]
    const uniqueActivatedUsers = activatedUserIds.length

    // Step 2: Users who completed onboarding
    const { data: onboardingProfiles, count: onboardingCompleted } = await supabase
      .from('user_profiles')
      .select('id, full_name, city, created_at', { count: 'exact' })
      .eq('onboarding_completed', true)
    
    const onboardingUserIds = onboardingProfiles?.map(p => p.id) || []

    // Step 3: Users who have any preferences record
    const { data: preferencesProfiles } = await supabase
      .from('user_preferences')
      .select('user_id')

    // Count unique users that appear in user_preferences
    const preferencesUserIds = [...new Set(preferencesProfiles?.map(p => p.user_id).filter(Boolean) || [])]
    const preferencesSet = preferencesUserIds.length

    // Step 4: Users who started match workflow
    const { data: matchMessages } = await supabase
      .from('chat_messages')
      .select('user_id')
      .eq('workflow', 'match_workflow')
    
    const matchUserIds = [...new Set(matchMessages?.map(m => m.user_id).filter(Boolean) || [])]
    const uniqueMatchUsers = matchUserIds.length

    // Step 4.5: Users who completed match (workflow_data is not empty {})
    const { data: matchCompletedProfiles } = await supabase
      .from('user_preferences')
      .select('user_id, workflow_data')
    
    // Filter users where workflow_data is not null and not an empty object
    const matchCompletedUserIds = [...new Set(
      matchCompletedProfiles
        ?.filter(p => {
          if (!p.workflow_data) return false
          // Check if it's an empty object
          if (typeof p.workflow_data === 'object' && Object.keys(p.workflow_data).length === 0) return false
          return true
        })
        .map(p => p.user_id)
        .filter(Boolean) || []
    )]
    const uniqueMatchCompletedUsers = matchCompletedUserIds.length

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
      
      // Fetch user profiles
      const { data: profilesData } = await supabase
        .from('user_profiles')
        .select('id, full_name, city, created_at')
        .in('id', allUserIds)
      
      // Fetch user preferences (for course_interest)
      const { data: preferencesData } = await supabase
        .from('user_preferences')
        .select('user_id, course_interest')
        .in('user_id', allUserIds)
      
      // Create a map of user_id -> course_interest
      const courseMap = new Map<string, string[]>()
      if (preferencesData) {
        for (const pref of preferencesData) {
          if (pref.course_interest) {
            courseMap.set(pref.user_id, pref.course_interest)
          }
        }
      }
      
      // Fetch phone numbers from auth.users using admin API
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers({
        perPage: 1000
      })
      
      if (authError) {
        console.error('Error fetching auth users:', authError)
      }
      
      // Create a map of user_id -> phone from auth.users
      const phoneMap = new Map<string, string>()
      if (authUsers?.users) {
        for (const user of authUsers.users) {
          if (user.phone) {
            phoneMap.set(user.id, user.phone)
          }
        }
      }
      
      // Build complete user data map
      if (profilesData) {
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
        valor: totalUsers || 0,
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
        valor: onboardingCompleted || 0,
        description: funnelDescriptions['Onboarding Completo'],
        ...(includeDetails && { 
          user_ids: onboardingUserIds,
          users: getUsersData(onboardingUserIds)
        })
      },
      { 
        etapa: 'Preferências Definidas', 
        valor: preferencesSet || 0,
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
