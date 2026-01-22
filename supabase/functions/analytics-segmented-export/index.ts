import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Focus regions (states)
const FOCUS_STATES = ['PB', 'BA', 'RN', 'PE', 'PARAÍBA', 'BAHIA', 'RIO GRANDE DO NORTE', 'PERNAMBUCO']

interface UserExportData {
  id: string
  nome: string
  telefone: string
  cidade: string
  curso: string
  etapa: string
  data_cadastro: string
  sessions_count: number
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

// Calculate sessions using 30-min gap
function calculateSessions(messages: { created_at: string }[]): number {
  if (messages.length === 0) return 0
  
  const sorted = [...messages].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  
  let sessions = 1
  const GAP_MS = 30 * 60 * 1000 // 30 minutes
  
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].created_at).getTime()
    const curr = new Date(sorted[i].created_at).getTime()
    if (curr - prev > GAP_MS) {
      sessions++
    }
  }
  
  return sessions
}

// Determine funnel stage
function determineFunnelStage(
  userId: string,
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

// Check if user is in focus region
function isInFocusRegion(city: string | null, statePreference: string | null, locationPreference: string | null): boolean {
  const checkValue = (val: string | null): boolean => {
    if (!val) return false
    const upper = val.toUpperCase()
    return FOCUS_STATES.some(state => upper.includes(state))
  }
  
  return checkValue(city) || checkValue(statePreference) || checkValue(locationPreference)
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

    console.log('Starting segmented export analysis...')

    // Calculate date 7 days ago
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoISO = sevenDaysAgo.toISOString()

    // Fetch all data in parallel
    const [
      authUsers,
      allMessages,
      recentMessages,
      preferences,
      favorites,
      profiles,
    ] = await Promise.all([
      fetchAllAuthUsers(supabase),
      fetchAllRows<{ user_id: string; workflow: string | null; created_at: string }>(
        supabase, 'chat_messages', 'user_id, workflow, created_at'
      ),
      fetchAllRows<{ user_id: string; created_at: string }>(
        supabase, 'chat_messages', 'user_id, created_at',
        [{ column: 'created_at', operator: 'gte', value: sevenDaysAgoISO }]
      ),
      fetchAllRows<{ user_id: string; workflow_data: any; course_interest: string[] | null; state_preference: string | null; location_preference: string | null }>(
        supabase, 'user_preferences', 'user_id, workflow_data, course_interest, state_preference, location_preference'
      ),
      fetchAllRows<{ user_id: string }>(
        supabase, 'user_favorites', 'user_id'
      ),
      fetchAllRows<{ id: string; full_name: string | null; city: string | null; created_at: string | null }>(
        supabase, 'user_profiles', 'id, full_name, city, created_at'
      ),
    ])

    console.log(`Fetched: ${authUsers.length} auth users, ${allMessages.length} total messages, ${recentMessages.length} recent messages`)

    // Build lookup maps
    const phoneMap = new Map<string, string | null>()
    const authCreatedMap = new Map<string, string>()
    for (const user of authUsers) {
      phoneMap.set(user.id, user.phone)
      authCreatedMap.set(user.id, user.created_at)
    }

    const profileMap = new Map<string, { full_name: string | null; city: string | null; created_at: string | null }>()
    for (const profile of profiles) {
      profileMap.set(profile.id, profile)
    }

    const preferencesMap = new Map<string, { course_interest: string[] | null; state_preference: string | null; location_preference: string | null; workflow_data: any }>()
    for (const pref of preferences) {
      preferencesMap.set(pref.user_id, pref)
    }

    // Process messages for funnel stages
    const userMessagesMap = new Map<string, { created_at: string }[]>()
    const hasOnboardingSet = new Set<string>()
    const hasMatchInitiatedSet = new Set<string>()

    for (const msg of allMessages) {
      if (!msg.user_id) continue
      
      if (!userMessagesMap.has(msg.user_id)) {
        userMessagesMap.set(msg.user_id, [])
      }
      userMessagesMap.get(msg.user_id)!.push({ created_at: msg.created_at })
      
      if (msg.workflow === 'onboarding_workflow') hasOnboardingSet.add(msg.user_id)
      if (msg.workflow === 'match_workflow') hasMatchInitiatedSet.add(msg.user_id)
    }

    // Calculate sessions from recent messages (last 7 days)
    const recentMessagesMap = new Map<string, { created_at: string }[]>()
    for (const msg of recentMessages) {
      if (!msg.user_id) continue
      if (!recentMessagesMap.has(msg.user_id)) {
        recentMessagesMap.set(msg.user_id, [])
      }
      recentMessagesMap.get(msg.user_id)!.push({ created_at: msg.created_at })
    }

    const favoritesSet = new Set(favorites.map(f => f.user_id))

    // Build user export data for all users
    const allUsersData: UserExportData[] = []

    for (const authUser of authUsers) {
      const userId = authUser.id
      const profile = profileMap.get(userId)
      const pref = preferencesMap.get(userId)
      
      const hasMessages = userMessagesMap.has(userId)
      const hasOnboarding = hasOnboardingSet.has(userId)
      const hasPreferences = !!pref
      const hasMatchInitiated = hasMatchInitiatedSet.has(userId)
      const hasMatchCompleted = pref?.workflow_data && typeof pref.workflow_data === 'object' && Object.keys(pref.workflow_data).length > 0
      const hasFavorites = favoritesSet.has(userId)

      const etapa = determineFunnelStage(
        userId,
        hasMessages,
        hasOnboarding,
        hasPreferences,
        hasMatchInitiated,
        hasMatchCompleted,
        hasFavorites
      )

      const recentUserMessages = recentMessagesMap.get(userId) || []
      const sessionsCount = calculateSessions(recentUserMessages)

      const courseInterest = pref?.course_interest
      const cursoStr = courseInterest && courseInterest.length > 0 ? courseInterest.join(', ') : ''

      allUsersData.push({
        id: userId,
        nome: profile?.full_name || 'Anônimo',
        telefone: formatPhone(phoneMap.get(userId) || null),
        cidade: profile?.city || '',
        curso: cursoStr,
        etapa,
        data_cadastro: formatDate(authCreatedMap.get(userId) || profile?.created_at || null),
        sessions_count: sessionsCount,
      })
    }

    console.log(`Total users processed: ${allUsersData.length}`)

    // Categorize users into 3 groups
    const usedIds = new Set<string>()

    // Aba 1: Engajados nas praças foco (Power Users + Focus Region)
    const aba1_engajados_foco: UserExportData[] = []
    for (const user of allUsersData) {
      const pref = preferencesMap.get(user.id)
      const profile = profileMap.get(user.id)
      
      const inFocusRegion = isInFocusRegion(
        profile?.city || null,
        pref?.state_preference || null,
        pref?.location_preference || null
      )
      
      if (inFocusRegion && user.sessions_count >= 2) {
        aba1_engajados_foco.push(user)
        usedIds.add(user.id)
      }
    }

    // Aba 2: Engajados todos os locais (Power Users, excluding those already in Aba 1)
    const aba2_engajados_todos: UserExportData[] = []
    for (const user of allUsersData) {
      if (usedIds.has(user.id)) continue
      
      if (user.sessions_count >= 2) {
        aba2_engajados_todos.push(user)
        usedIds.add(user.id)
      }
    }

    // Aba 3: Desengajados nas praças foco (< 2 sessions + Focus Region)
    const aba3_desengajados_foco: UserExportData[] = []
    for (const user of allUsersData) {
      if (usedIds.has(user.id)) continue
      
      const pref = preferencesMap.get(user.id)
      const profile = profileMap.get(user.id)
      
      const inFocusRegion = isInFocusRegion(
        profile?.city || null,
        pref?.state_preference || null,
        pref?.location_preference || null
      )
      
      if (inFocusRegion && user.sessions_count < 2) {
        aba3_desengajados_foco.push(user)
        usedIds.add(user.id)
      }
    }

    console.log(`Aba 1 (Engajados Foco): ${aba1_engajados_foco.length}`)
    console.log(`Aba 2 (Engajados Todos): ${aba2_engajados_todos.length}`)
    console.log(`Aba 3 (Desengajados Foco): ${aba3_desengajados_foco.length}`)

    // Remove sessions_count from output (internal use only)
    const cleanData = (users: UserExportData[]) => users.map(({ sessions_count, id, ...rest }) => rest)

    return new Response(JSON.stringify({
      aba1_engajados_foco: cleanData(aba1_engajados_foco),
      aba2_engajados_todos: cleanData(aba2_engajados_todos),
      aba3_desengajados_foco: cleanData(aba3_desengajados_foco),
      summary: {
        total_users: allUsersData.length,
        aba1_count: aba1_engajados_foco.length,
        aba2_count: aba2_engajados_todos.length,
        aba3_count: aba3_desengajados_foco.length,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in analytics-segmented-export:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
