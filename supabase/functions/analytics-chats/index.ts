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
  hasMatchRealized: boolean,
  hasFavorites: boolean,
  hasSpecificFlow: boolean
): string {
  if (hasSpecificFlow) return 'Fluxo Específico';
  if (hasFavorites) return 'Salvaram Favoritos';
  if (hasMatchRealized) return 'Match Realizado';
  if (hasMatchMessages) return 'Match Iniciado';
  if (hasPreferences) return 'Preferências Definidas';
  if (profile?.onboarding_completed) return 'Onboarding Completo';
  return 'Cadastrados';
}

// Helper to fetch data in batches to overcome Supabase 1000-row limit
// deno-lint-ignore no-explicit-any
async function fetchInBatches<T>(
  supabase: any,
  table: string,
  selectFields: string,
  filterColumn: string,
  ids: string[],
  // NOTE: Using too-large batches with `.in()` can create very large URLs and fail at the HTTP layer.
  // Keep the default conservative and add a fallback splitter to guarantee full retrieval.
  batchSize: number = 100
): Promise<T[]> {
  const allResults: T[] = [];

  const fetchBatchWithFallback = async (batchIds: string[]): Promise<T[]> => {
    const { data, error } = await supabase
      .from(table)
      .select(selectFields)
      .in(filterColumn, batchIds);

    if (error) {
      // If the batch fails (commonly due to very large URL/query string), split and retry.
      if (batchIds.length > 1) {
        const mid = Math.ceil(batchIds.length / 2);
        const left = await fetchBatchWithFallback(batchIds.slice(0, mid));
        const right = await fetchBatchWithFallback(batchIds.slice(mid));
        return [...left, ...right];
      }

      console.error(`Error fetching ${table} batch:`, {
        error,
        table,
        filterColumn,
        batchSize: batchIds.length,
      });
      return [];
    }

    return (data as T[]) || [];
  };

  for (let i = 0; i < ids.length; i += batchSize) {
    const batchIds = ids.slice(i, i + batchSize);

    const batchResults = await fetchBatchWithFallback(batchIds);
    allResults.push(...batchResults);
  }

  return allResults;
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

      // Fetch preferences for location_preference and workflow_data
      const { data: prefData } = await supabase
        .from('user_preferences')
        .select('location_preference, enem_score, workflow_data')
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

      // Check if match was realized (workflow_data has content)
      const hasMatchRealized = prefData?.workflow_data &&
        typeof prefData.workflow_data === 'object' &&
        Object.keys(prefData.workflow_data).length > 0

      const funnelStage = determineFunnelStage(
        userId,
        profileData ? { onboarding_completed: profileData.onboarding_completed } : null,
        !!prefData?.enem_score,
        hasMatchMessages,
        hasMatchRealized,
        (favCount || 0) > 0,
        hasSpecificFlow
      )

      // Reverse messages to chronological order and sort with tie-breaker
      const orderedMessages = (messages || [])
        .reverse()
        .sort((a, b) => {
          const timeA = new Date(a.created_at).getTime()
          const timeB = new Date(b.created_at).getTime()

          // Primary sort by time
          if (timeA !== timeB) return timeA - timeB

          // Tie-breaker: user before cloudinha
          const senderOrder = (s: string) => s === 'user' ? 0 : 1
          return senderOrder(a.sender) - senderOrder(b.sender)
        })

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

    // ============ MODE: LIST - Fast loading using Database RPC ============
    console.log('Loading user list (RPC mode)')

    // Use date filters if provided, otherwise default to last 30 days
    const defaultDateFrom = new Date()
    defaultDateFrom.setDate(defaultDateFrom.getDate() - 30)

    const effectiveDateFrom = dateFrom || defaultDateFrom
    const effectiveDateTo = dateTo || new Date()
    // If dateTo is provided, it was already set to end of day above. If new Date(), it is now.

    console.log(`Date range: ${effectiveDateFrom.toISOString()} to ${effectiveDateTo.toISOString()}`)

    const { data: users, error } = await supabase.rpc('get_chat_analytics_summary', {
      p_date_from: effectiveDateFrom.toISOString(),
      p_date_to: effectiveDateTo.toISOString()
    })

    if (error) {
      console.error('Error fetching analytics summary:', error)
      throw error
    }

    console.log(`RPC returned ${users?.length || 0} user summaries`)

    return new Response(JSON.stringify({ users: users || [], total: users?.length || 0 }), {
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
