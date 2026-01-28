import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to fetch all rows with pagination
async function fetchAllRows<T>(
  supabase: any,
  table: string,
  select: string,
  filters?: { column: string; operator: string; value: any }[]
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

// Fetch all auth users
async function fetchAllAuthUsers(supabase: any): Promise<{ id: string; phone: string | null; created_at: string }[]> {
  const allUsers: { id: string; phone: string | null; created_at: string }[] = []
  const pageSize = 1000
  let page = 1
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: pageSize })
    if (error) throw error

    if (data?.users && data.users.length > 0) {
      allUsers.push(...data.users.map((u: any) => ({
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

  return allUsers
}

// Determine funnel stage
function determineFunnelStage(
  hasMessages: boolean,
  hasOnboarding: boolean,
  hasPreferences: boolean,
  hasMatchInitiated: boolean,
  hasMatchCompleted: boolean,
  hasFavorites: boolean
): string {
  if (hasFavorites) return 'Salvaram Favoritos'
  if (hasMatchCompleted) return 'Match Realizado'
  if (hasMatchInitiated) return 'Match Iniciado'
  if (hasPreferences) return 'Preferências Definidas'
  if (hasOnboarding) return 'Onboarding Completo'
  if (hasMessages) return 'Ativação'
  return 'Cadastrados'
}

// Format phone number
function formatPhone(phone: string | null): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4)
    const part1 = digits.slice(4, 9)
    const part2 = digits.slice(9, 13)
    return `(${ddd}) ${part1}-${part2}`
  }
  if (digits.length === 11) {
    const ddd = digits.slice(0, 2)
    const part1 = digits.slice(2, 7)
    const part2 = digits.slice(7, 11)
    return `(${ddd}) ${part1}-${part2}`
  }
  return phone
}

// Format date
function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${day}/${month}/${year}, ${hours}:${minutes}`
  } catch {
    return ''
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Starting inactive users export...')

    // Calculate date 7 days ago
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoISO = sevenDaysAgo.toISOString()

    // Fetch all data in parallel
    const [
      authUsers,
      allMessages,
      recentMessages,
      recentPreferencesUpdates,
      recentFavorites,
      allPreferences,
      allFavorites,
      profiles,
    ] = await Promise.all([
      fetchAllAuthUsers(supabase),
      fetchAllRows<{ user_id: string; workflow: string | null }>(
        supabase, 'chat_messages', 'user_id, workflow'
      ),
      fetchAllRows<{ user_id: string }>(
        supabase, 'chat_messages', 'user_id',
        [{ column: 'created_at', operator: 'gte', value: sevenDaysAgoISO }]
      ),
      fetchAllRows<{ user_id: string }>(
        supabase, 'user_preferences', 'user_id',
        [{ column: 'updated_at', operator: 'gte', value: sevenDaysAgoISO }]
      ),
      fetchAllRows<{ user_id: string }>(
        supabase, 'user_favorites', 'user_id',
        [{ column: 'created_at', operator: 'gte', value: sevenDaysAgoISO }]
      ),
      fetchAllRows<{ user_id: string; workflow_data: any; course_interest: string[] | null }>(
        supabase, 'user_preferences', 'user_id, workflow_data, course_interest'
      ),
      fetchAllRows<{ user_id: string }>(
        supabase, 'user_favorites', 'user_id'
      ),
      fetchAllRows<{ id: string; full_name: string | null; city: string | null }>(
        supabase, 'user_profiles', 'id, full_name, city'
      ),
    ])

    console.log(`Fetched: ${authUsers.length} auth users`)

    // Build set of active users (had activity in last 7 days)
    const activeUserIds = new Set<string>()
    
    // Users with recent messages
    for (const msg of recentMessages) {
      if (msg.user_id) activeUserIds.add(msg.user_id)
    }
    
    // Users who updated preferences recently
    for (const pref of recentPreferencesUpdates) {
      if (pref.user_id) activeUserIds.add(pref.user_id)
    }
    
    // Users who added favorites recently
    for (const fav of recentFavorites) {
      if (fav.user_id) activeUserIds.add(fav.user_id)
    }

    console.log(`Active users in last 7 days: ${activeUserIds.size}`)

    // Build lookup maps
    const phoneMap = new Map<string, string | null>()
    const authCreatedMap = new Map<string, string>()
    for (const user of authUsers) {
      phoneMap.set(user.id, user.phone)
      authCreatedMap.set(user.id, user.created_at)
    }

    const profileMap = new Map<string, { full_name: string | null; city: string | null }>()
    for (const profile of profiles) {
      profileMap.set(profile.id, profile)
    }

    const preferencesMap = new Map<string, { course_interest: string[] | null; workflow_data: any }>()
    for (const pref of allPreferences) {
      preferencesMap.set(pref.user_id, pref)
    }

    // Process all messages for funnel stages (historical)
    const hasMessagesSet = new Set<string>()
    const hasOnboardingSet = new Set<string>()
    const hasMatchInitiatedSet = new Set<string>()

    for (const msg of allMessages) {
      if (!msg.user_id) continue
      hasMessagesSet.add(msg.user_id)
      if (msg.workflow === 'onboarding_workflow') hasOnboardingSet.add(msg.user_id)
      if (msg.workflow === 'match_workflow') hasMatchInitiatedSet.add(msg.user_id)
    }

    const allFavoritesSet = new Set(allFavorites.map(f => f.user_id))

    // Find inactive users and build export data
    const inactiveUsers: { 
      nome: string
      telefone: string
      cidade: string
      curso: string
      etapa: string
      data_cadastro: string
    }[] = []

    for (const authUser of authUsers) {
      const userId = authUser.id
      
      // Skip if user was active in last 7 days
      if (activeUserIds.has(userId)) continue

      const profile = profileMap.get(userId)
      const pref = preferencesMap.get(userId)

      // Determine funnel stage based on historical activity
      const hasMessages = hasMessagesSet.has(userId)
      const hasOnboarding = hasOnboardingSet.has(userId)
      const hasPreferences = !!pref
      const hasMatchInitiated = hasMatchInitiatedSet.has(userId)
      const hasMatchCompleted = pref?.workflow_data && typeof pref.workflow_data === 'object' && Object.keys(pref.workflow_data).length > 0
      const hasFavorites = allFavoritesSet.has(userId)

      const etapa = determineFunnelStage(
        hasMessages,
        hasOnboarding,
        hasPreferences,
        hasMatchInitiated,
        hasMatchCompleted,
        hasFavorites
      )

      const courseInterest = pref?.course_interest
      const cursoStr = courseInterest && courseInterest.length > 0 ? courseInterest.join(', ') : ''

      inactiveUsers.push({
        nome: profile?.full_name || 'Anônimo',
        telefone: formatPhone(phoneMap.get(userId) || null),
        cidade: profile?.city || '',
        curso: cursoStr,
        etapa,
        data_cadastro: formatDate(authCreatedMap.get(userId) || null),
      })
    }

    console.log(`Inactive users: ${inactiveUsers.length}`)

    return new Response(JSON.stringify({
      users: inactiveUsers,
      summary: {
        total_registered: authUsers.length,
        active_users: activeUserIds.size,
        inactive_users: inactiveUsers.length,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in analytics-export-inactive:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
