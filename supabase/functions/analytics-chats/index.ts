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

interface UserConversation {
  user_id: string;
  user_name: string;
  city: string | null;
  location_preference: string | null;
  age: number | null;
  education: string | null;
  active_workflow: string | null;
  first_contact: string | null;
  total_messages: number;
  workflow: string | null;
  funnel_stage: string | null;
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
    let limit = 10
    try {
      const body = await req.json()
      if (body.limit) limit = Math.min(body.limit, 50)
    } catch {
      // Use defaults
    }

    // Get unique user_ids with recent messages (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: recentUsers, error: usersError } = await supabase
      .from('chat_messages')
      .select('user_id')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .not('user_id', 'is', null)
      .order('created_at', { ascending: false })

    if (usersError) {
      console.error('Error fetching recent users:', usersError)
      throw usersError
    }

    // Get unique user IDs with most recent activity first
    const uniqueUserIds: string[] = []
    const seenUsers = new Set<string>()
    for (const row of recentUsers || []) {
      if (row.user_id && !seenUsers.has(row.user_id)) {
        seenUsers.add(row.user_id)
        uniqueUserIds.push(row.user_id)
        if (uniqueUserIds.length >= limit) break
      }
    }

    console.log(`Found ${uniqueUserIds.length} unique users with recent messages`)

    if (uniqueUserIds.length === 0) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch user profiles with onboarding status
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, full_name, city, age, education, active_workflow, created_at, onboarding_completed')
      .in('id', uniqueUserIds)

    const profileMap = new Map<string, {
      full_name: string;
      city: string | null;
      age: number | null;
      education: string | null;
      active_workflow: string | null;
      created_at: string | null;
      onboarding_completed: boolean;
    }>()
    
    for (const profile of profiles || []) {
      profileMap.set(profile.id, {
        full_name: profile.full_name || 'Usuário Anônimo',
        city: profile.city,
        age: profile.age,
        education: profile.education,
        active_workflow: profile.active_workflow,
        created_at: profile.created_at,
        onboarding_completed: profile.onboarding_completed || false,
      })
    }

    // Get user preferences (for funnel stage and location preference)
    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('user_id, enem_score, location_preference')
      .in('user_id', uniqueUserIds)

    const preferencesMap = new Map<string, boolean>()
    const locationPreferenceMap = new Map<string, string | null>()
    for (const pref of preferences || []) {
      if (pref.user_id) {
        if (pref.enem_score) {
          preferencesMap.set(pref.user_id, true)
        }
        locationPreferenceMap.set(pref.user_id, pref.location_preference || null)
      }
    }

    // Get user favorites
    const { data: favorites } = await supabase
      .from('user_favorites')
      .select('user_id')
      .in('user_id', uniqueUserIds)

    const favoritesSet = new Set<string>()
    for (const fav of favorites || []) {
      if (fav.user_id) favoritesSet.add(fav.user_id)
    }

    // Get total message counts and workflow info per user
    const { data: allMessages } = await supabase
      .from('chat_messages')
      .select('user_id, workflow')
      .in('user_id', uniqueUserIds)

    const messageCountMap = new Map<string, number>()
    const matchUsersSet = new Set<string>()
    const specificFlowSet = new Set<string>()
    
    for (const row of allMessages || []) {
      if (row.user_id) {
        messageCountMap.set(row.user_id, (messageCountMap.get(row.user_id) || 0) + 1)
        if (row.workflow === 'match_workflow') matchUsersSet.add(row.user_id)
        if (['sisu_workflow', 'prouni_workflow', 'fies_workflow'].includes(row.workflow || '')) {
          specificFlowSet.add(row.user_id)
        }
      }
    }

    // Fetch messages for each user (last 20 messages per user)
    const conversations: UserConversation[] = []

    for (const userId of uniqueUserIds) {
      const { data: messages, error: messagesError } = await supabase
        .from('chat_messages')
        .select('id, content, sender, workflow, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(20)

      if (messagesError) {
        console.error(`Error fetching messages for user ${userId}:`, messagesError)
        continue
      }

      if (messages && messages.length > 0) {
        // Get the most common workflow for this conversation
        const workflowCounts = new Map<string, number>()
        for (const msg of messages) {
          if (msg.workflow) {
            workflowCounts.set(msg.workflow, (workflowCounts.get(msg.workflow) || 0) + 1)
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

        const profile = profileMap.get(userId)
        const firstMessage = messages[0]

        // Determine funnel stage
        const funnelStage = determineFunnelStage(
          userId,
          profile ? { onboarding_completed: profile.onboarding_completed } : null,
          preferencesMap.has(userId),
          matchUsersSet.has(userId),
          favoritesSet.has(userId),
          specificFlowSet.has(userId)
        )

        conversations.push({
          user_id: userId,
          user_name: profile?.full_name || 'Usuário Anônimo',
          city: profile?.city || null,
          location_preference: locationPreferenceMap.get(userId) || null,
          age: profile?.age || null,
          education: profile?.education || null,
          active_workflow: profile?.active_workflow || null,
          first_contact: firstMessage?.created_at || profile?.created_at || null,
          total_messages: messageCountMap.get(userId) || messages.length,
          workflow: dominantWorkflow,
          funnel_stage: funnelStage,
          messages: messages.map(m => ({
            id: m.id,
            content: m.content || '',
            sender: m.sender || 'user',
            workflow: m.workflow,
            created_at: m.created_at || ''
          }))
        })
      }
    }

    console.log(`Returning ${conversations.length} conversations`)

    return new Response(JSON.stringify(conversations), {
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
