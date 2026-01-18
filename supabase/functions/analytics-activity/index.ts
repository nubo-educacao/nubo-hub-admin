import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Get messages from last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('created_at, user_id')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: true })

    if (error) throw error

    // Aggregate by day
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    const activityMap = new Map<string, { mensagens: number; usuarios: Set<string> }>()

    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dayKey = date.toISOString().split('T')[0]
      activityMap.set(dayKey, { mensagens: 0, usuarios: new Set() })
    }

    // Count messages and unique users per day
    messages?.forEach((msg) => {
      const dayKey = msg.created_at?.split('T')[0]
      if (dayKey && activityMap.has(dayKey)) {
        const dayData = activityMap.get(dayKey)!
        dayData.mensagens++
        if (msg.user_id) {
          dayData.usuarios.add(msg.user_id)
        }
      }
    })

    // Convert to array format
    const activity = Array.from(activityMap.entries()).map(([dateStr, data]) => {
      const date = new Date(dateStr)
      return {
        dia: dayNames[date.getDay()],
        mensagens: data.mensagens,
        usuarios: data.usuarios.size,
      }
    })

    console.log('Analytics activity response:', activity)

    return new Response(JSON.stringify(activity), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in analytics-activity:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
