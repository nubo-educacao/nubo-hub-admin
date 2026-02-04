import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

// Format phone number: 5581981846070 -> (81) 98184-6070
function formatPhone(phone: string): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 13) {
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
  }
  if (digits.length === 12) {
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return phone
}

// Determine funnel stage based on user data
function determineFunnelStage(
  userId: string,
  hasPreferences: boolean,
  hasMatchWorkflow: boolean,
  hasWorkflowData: boolean,
  hasFavorites: boolean,
  hasOnboarding: boolean,
  hasAnyMessage: boolean
): string {
  if (hasFavorites) return 'Favoritos'
  if (hasWorkflowData) return 'Match Realizado'
  if (hasMatchWorkflow) return 'Match Iniciado'
  if (hasPreferences) return 'Preferências Definidas'
  if (hasOnboarding) return 'Onboarding'
  if (hasAnyMessage) return 'Ativação'
  return 'Cadastrado'
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

    console.log('Starting Power Users export...')

    // 1. Fetch all messages with pagination
    const allMessages = await fetchAllRows<{ user_id: string; created_at: string; workflow: string }>(
      supabase, 'chat_messages', 'user_id, created_at, workflow'
    )
    console.log('Total messages fetched:', allMessages.length)

    // 2. Calculate sessions per user (30-min gap = new session)
    const userMessages = new Map<string, Date[]>()
    const userWorkflows = new Map<string, Set<string>>()
    
    for (const msg of allMessages) {
      if (!msg.user_id) continue
      
      const msgDate = new Date(msg.created_at)
      
      if (!userMessages.has(msg.user_id)) {
        userMessages.set(msg.user_id, [])
        userWorkflows.set(msg.user_id, new Set())
      }
      userMessages.get(msg.user_id)!.push(msgDate)
      
      if (msg.workflow) {
        userWorkflows.get(msg.user_id)!.add(msg.workflow)
      }
    }

    // Calculate sessions and identify power users
    const powerUserIds: { userId: string; sessionCount: number }[] = []
    
    for (const [userId, timestamps] of userMessages) {
      timestamps.sort((a, b) => a.getTime() - b.getTime())
      
      let sessions = 1
      for (let i = 1; i < timestamps.length; i++) {
        const gap = (timestamps[i].getTime() - timestamps[i-1].getTime()) / (1000 * 60)
        if (gap > 30) {
          sessions++
        }
      }
      
      if (sessions >= 2) {
        powerUserIds.push({ userId, sessionCount: sessions })
      }
    }

    // Sort by session count desc
    powerUserIds.sort((a, b) => b.sessionCount - a.sessionCount)
    console.log('Power users found:', powerUserIds.length)

    if (powerUserIds.length === 0) {
      return new Response(JSON.stringify({ users: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Fetch user profiles, preferences, and favorites
    const [profilesResult, preferencesResult, favoritesResult] = await Promise.all([
      fetchAllRows<{ id: string; full_name: string; city: string }>(
        supabase, 'user_profiles', 'id, full_name, city'
      ),
      fetchAllRows<{ user_id: string; location_preference: string; course_interest: string[]; workflow_data: unknown }>(
        supabase, 'user_preferences', 'user_id, location_preference, course_interest, workflow_data'
      ),
      fetchAllRows<{ user_id: string }>(
        supabase, 'user_favorites', 'user_id'
      ),
    ])

    // Create maps for quick lookup
    const profileMap = new Map<string, { full_name: string; city: string }>()
    for (const p of profilesResult) {
      profileMap.set(p.id, { full_name: p.full_name || '', city: p.city || '' })
    }

    const preferencesMap = new Map<string, { location_preference: string; course_interest: string[]; hasWorkflowData: boolean }>()
    for (const p of preferencesResult) {
      preferencesMap.set(p.user_id, {
        location_preference: p.location_preference || '',
        course_interest: p.course_interest || [],
        hasWorkflowData: !!p.workflow_data
      })
    }

    // Count favorites per user
    const favoritesCount = new Map<string, number>()
    for (const f of favoritesResult) {
      favoritesCount.set(f.user_id, (favoritesCount.get(f.user_id) || 0) + 1)
    }

    // 4. Fetch phone numbers from Auth API
    const phoneMap = new Map<string, string>()
    const userIdList = powerUserIds.map(u => u.userId)
    
    // Fetch users in batches of 50
    const batchSize = 50
    for (let i = 0; i < userIdList.length; i += batchSize) {
      const batch = userIdList.slice(i, i + batchSize)
      const { data: authData } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000
      })
      
      if (authData?.users) {
        for (const user of authData.users) {
          if (batch.includes(user.id) && user.phone) {
            phoneMap.set(user.id, user.phone)
          }
        }
      }
      break // Only need one call since we're getting all users
    }

    // 5. Build enriched power users list
    const enrichedUsers = powerUserIds.map(({ userId, sessionCount }) => {
      const profile = profileMap.get(userId) || { full_name: '', city: '' }
      const prefs = preferencesMap.get(userId) || { location_preference: '', course_interest: [], hasWorkflowData: false }
      const workflows = userWorkflows.get(userId) || new Set()
      const hasFavorites = (favoritesCount.get(userId) || 0) > 0
      
      const funnelStage = determineFunnelStage(
        userId,
        preferencesMap.has(userId),
        workflows.has('match_workflow'),
        prefs.hasWorkflowData,
        hasFavorites,
        workflows.has('onboarding_workflow'),
        userMessages.has(userId)
      )

      return {
        nome: profile.full_name || 'Usuário Anônimo',
        telefone: formatPhone(phoneMap.get(userId) || ''),
        cidadeResidencia: profile.city,
        localInteresse: prefs.location_preference,
        cursoInteresse: prefs.course_interest.join(', '),
        etapaFunil: funnelStage,
        favoritos: favoritesCount.get(userId) || 0,
        totalAcessos: sessionCount
      }
    })

    console.log('Export complete. Users:', enrichedUsers.length)

    return new Response(JSON.stringify({ users: enrichedUsers }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in analytics-power-users-export:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
