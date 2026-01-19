import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChatMessage {
  id: string;
  content: string;
  sender: string;
  workflow: string | null;
  created_at: string;
}

interface UserSummary {
  user_id: string;
  user_name: string;
  city: string | null;
  age: number | null;
  funnel_stage: string | null;
  last_activity: string | null;
  total_messages: number;
  workflow: string | null;
}

interface UserConversation {
  user_id: string;
  user_name: string;
  phone: string | null;
  city: string | null;
  location_preference: string | null;
  age: number | null;
  education: string | null;
  active_workflow: string | null;
  first_contact: string | null;
  last_activity: string | null;
  total_messages: number;
  workflow: string | null;
  funnel_stage: string | null;
  has_more_messages: boolean;
  messages: ChatMessage[];
}

// Determine funnel stage based on user data
function determineFunnelStage(
  userId: string,
  profile: { onboarding_completed?: boolean } | null,
  hasPreferences: boolean,
  hasMatchMessages: boolean,
  hasFavorites: boolean,
  hasSpecificFlow: boolean
): string {
  if (hasSpecificFlow) return 'Fluxo Específico';
  if (hasFavorites) return 'Salvaram Favoritos';
  if (hasMatchMessages) return 'Match Iniciado';
  if (hasPreferences) return 'Preferências Definidas';
  if (profile?.onboarding_completed) return 'Onboarding Completo';
  return 'Cadastrados';
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

    // Parse request body for optional filters
    let body: { 
      mode?: 'list' | 'conversation';
      user_id?: string; 
      offset?: number; 
      messages_limit?: number;
      date_from?: string;
      date_to?: string;
    } = {}
    try {
      body = await req.json()
    } catch {
      // Use defaults
    }

    const mode = body.mode || 'list'

    // Parse date filters
    const dateFrom = body.date_from ? new Date(body.date_from) : null
    const dateTo = body.date_to ? new Date(body.date_to) : null
    // If dateTo is provided, set it to end of day
    if (dateTo) {
      dateTo.setHours(23, 59, 59, 999)
    }

    // ============ MODE: CONVERSATION - Load details for a specific user ============
    if (mode === 'conversation' && body.user_id) {
      console.log(`Loading conversation for user: ${body.user_id}`)
      
      const userId = body.user_id
      const messagesLimit = body.messages_limit || 20
      const offset = body.offset || 0

      // Get total message count
      const { count: totalCount } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      // Fetch messages with offset (ordered DESC to get most recent, then reverse)
      const { data: messages, error: messagesError } = await supabase
        .from('chat_messages')
        .select('id, content, sender, workflow, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + messagesLimit - 1)

      if (messagesError) {
        console.error('Error fetching messages:', messagesError)
        throw messagesError
      }

      // Fetch first message (oldest)
      const { data: firstMsgData } = await supabase
        .from('chat_messages')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)

      // Fetch user profile
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('full_name, city, age, education, active_workflow, created_at, onboarding_completed')
        .eq('id', userId)
        .single()

      // Fetch preferences for location_preference
      const { data: prefData } = await supabase
        .from('user_preferences')
        .select('location_preference, enem_score')
        .eq('user_id', userId)
        .single()

      // Fetch phone from auth API
      let phone: string | null = null
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
          },
        })
        if (response.ok) {
          const userData = await response.json()
          phone = userData.phone || null
        }
      } catch (e) {
        console.error('Error fetching phone:', e)
      }

      // Check favorites
      const { count: favCount } = await supabase
        .from('user_favorites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      // Check workflow types in messages
      const { data: workflowMessages } = await supabase
        .from('chat_messages')
        .select('workflow')
        .eq('user_id', userId)
        .not('workflow', 'is', null)

      const workflowCounts = new Map<string, number>()
      let hasMatchMessages = false
      let hasSpecificFlow = false
      for (const msg of workflowMessages || []) {
        if (msg.workflow) {
          workflowCounts.set(msg.workflow, (workflowCounts.get(msg.workflow) || 0) + 1)
          if (msg.workflow === 'match_workflow') hasMatchMessages = true
          if (['sisu_workflow', 'prouni_workflow', 'fies_workflow'].includes(msg.workflow)) {
            hasSpecificFlow = true
          }
        }
      }

      let dominantWorkflow: string | null = null
      let maxCount = 0
      for (const [workflow, count] of workflowCounts) {
        if (count > maxCount) {
          maxCount = count
          dominantWorkflow = workflow
        }
      }

      const funnelStage = determineFunnelStage(
        userId,
        profileData ? { onboarding_completed: profileData.onboarding_completed } : null,
        !!prefData?.enem_score,
        hasMatchMessages,
        (favCount || 0) > 0,
        hasSpecificFlow
      )

      // Reverse messages to chronological order
      const orderedMessages = (messages || []).reverse()
      const total = totalCount || 0
      const hasMore = total > offset + messagesLimit

      const conversation: UserConversation = {
        user_id: userId,
        user_name: profileData?.full_name || 'Usuário Anônimo',
        phone,
        city: profileData?.city || null,
        location_preference: prefData?.location_preference || null,
        age: profileData?.age || null,
        education: profileData?.education || null,
        active_workflow: profileData?.active_workflow || null,
        first_contact: firstMsgData?.[0]?.created_at || profileData?.created_at || null,
        last_activity: messages?.[0]?.created_at || null,
        total_messages: total,
        workflow: dominantWorkflow,
        funnel_stage: funnelStage,
        has_more_messages: hasMore,
        messages: orderedMessages.map(m => ({
          id: m.id,
          content: m.content || '',
          sender: m.sender || 'user',
          workflow: m.workflow,
          created_at: m.created_at || ''
        }))
      }

      console.log(`Returning conversation with ${orderedMessages.length} messages`)

      return new Response(JSON.stringify(conversation), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ============ MODE: LIST - Fast loading of user summaries ============
    console.log('Loading user list (fast mode)')
    
    // Use date filters if provided, otherwise default to last 30 days
    const defaultDateFrom = new Date()
    defaultDateFrom.setDate(defaultDateFrom.getDate() - 30)
    
    const effectiveDateFrom = dateFrom || defaultDateFrom
    const effectiveDateTo = dateTo || new Date()

    // Get all messages in date range with PAGINATION to overcome 1000-row limit
    const userDataMap = new Map<string, {
      last_activity: string;
      total_messages: number;
      workflows: Map<string, number>;
      hasMatch: boolean;
      hasSpecificFlow: boolean;
    }>()

    let offset = 0
    const batchSize = 1000
    let totalFetched = 0

    while (true) {
      const { data: batch, error: batchError } = await supabase
        .from('chat_messages')
        .select('user_id, workflow, created_at')
        .gte('created_at', effectiveDateFrom.toISOString())
        .lte('created_at', effectiveDateTo.toISOString())
        .not('user_id', 'is', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + batchSize - 1)

      if (batchError) {
        console.error('Error fetching messages batch:', batchError)
        throw batchError
      }

      if (!batch || batch.length === 0) break

      totalFetched += batch.length

      // Aggregate data per user
      for (const row of batch) {
        if (!row.user_id) continue
        
        let userData = userDataMap.get(row.user_id)
        if (!userData) {
          userData = {
            last_activity: row.created_at,
            total_messages: 0,
            workflows: new Map(),
            hasMatch: false,
            hasSpecificFlow: false
          }
          userDataMap.set(row.user_id, userData)
        }
        
        userData.total_messages++
        
        if (row.workflow) {
          userData.workflows.set(row.workflow, (userData.workflows.get(row.workflow) || 0) + 1)
          if (row.workflow === 'match_workflow') userData.hasMatch = true
          if (['sisu_workflow', 'prouni_workflow', 'fies_workflow'].includes(row.workflow)) {
            userData.hasSpecificFlow = true
          }
        }
      }

      offset += batchSize
      
      // If we got less than batchSize, we've reached the end
      if (batch.length < batchSize) break
    }

    console.log(`Fetched ${totalFetched} messages, found ${userDataMap.size} unique users`)

    const uniqueUserIds = Array.from(userDataMap.keys())

    if (uniqueUserIds.length === 0) {
      return new Response(JSON.stringify({ users: [], total: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Batch fetch: profiles
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, full_name, city, age, onboarding_completed')
      .in('id', uniqueUserIds)

    const profileMap = new Map<string, {
      full_name: string;
      city: string | null;
      age: number | null;
      onboarding_completed: boolean;
    }>()
    for (const profile of profiles || []) {
      profileMap.set(profile.id, {
        full_name: profile.full_name || 'Usuário Anônimo',
        city: profile.city,
        age: profile.age,
        onboarding_completed: profile.onboarding_completed || false,
      })
    }

    // Batch fetch: preferences (for funnel stage)
    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('user_id, enem_score')
      .in('user_id', uniqueUserIds)

    const hasPreferencesSet = new Set<string>()
    for (const pref of preferences || []) {
      if (pref.user_id && pref.enem_score) {
        hasPreferencesSet.add(pref.user_id)
      }
    }

    // Batch fetch: favorites (for funnel stage)
    const { data: favorites } = await supabase
      .from('user_favorites')
      .select('user_id')
      .in('user_id', uniqueUserIds)

    const hasFavoritesSet = new Set<string>()
    for (const fav of favorites || []) {
      if (fav.user_id) hasFavoritesSet.add(fav.user_id)
    }

    // Build user summaries
    const users: UserSummary[] = []

    for (const userId of uniqueUserIds) {
      const userData = userDataMap.get(userId)!
      const profile = profileMap.get(userId)

      // Get dominant workflow
      let dominantWorkflow: string | null = null
      let maxCount = 0
      for (const [workflow, count] of userData.workflows) {
        if (count > maxCount) {
          maxCount = count
          dominantWorkflow = workflow
        }
      }

      // Determine funnel stage
      const funnelStage = determineFunnelStage(
        userId,
        profile ? { onboarding_completed: profile.onboarding_completed } : null,
        hasPreferencesSet.has(userId),
        userData.hasMatch,
        hasFavoritesSet.has(userId),
        userData.hasSpecificFlow
      )

      users.push({
        user_id: userId,
        user_name: profile?.full_name || 'Usuário Anônimo',
        city: profile?.city || null,
        age: profile?.age || null,
        funnel_stage: funnelStage,
        last_activity: userData.last_activity,
        total_messages: userData.total_messages,
        workflow: dominantWorkflow,
      })
    }

    // Sort by last_activity (most recent first)
    users.sort((a, b) => {
      const dateA = a.last_activity ? new Date(a.last_activity).getTime() : 0
      const dateB = b.last_activity ? new Date(b.last_activity).getTime() : 0
      return dateB - dateA
    })

    console.log(`Returning ${users.length} user summaries`)

    return new Response(JSON.stringify({ users, total: users.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in analytics-chats:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
