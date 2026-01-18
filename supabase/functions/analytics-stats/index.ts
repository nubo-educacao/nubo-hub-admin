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

    // Parse date range from request body
    let dateRange: { from?: string; to?: string } = {}
    try {
      const body = await req.json()
      dateRange = body.dateRange || {}
    } catch {
      // No body or invalid JSON, use defaults
    }

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    // Active users (users who sent messages in last 7 days)
    const { count: activeUsers } = await supabase
      .from('chat_messages')
      .select('user_id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString())

    // Active users previous period (for comparison)
    const { count: activeUsersPrev } = await supabase
      .from('chat_messages')
      .select('user_id', { count: 'exact', head: true })
      .gte('created_at', fourteenDaysAgo.toISOString())
      .lt('created_at', sevenDaysAgo.toISOString())

    // Total messages
    const { count: totalMessages } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })

    // Messages last 7 days
    const { count: messagesThisWeek } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString())

    // Messages previous week
    const { count: messagesPrevWeek } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', fourteenDaysAgo.toISOString())
      .lt('created_at', sevenDaysAgo.toISOString())

    // Total favorites
    const { count: totalFavorites } = await supabase
      .from('user_favorites')
      .select('*', { count: 'exact', head: true })

    // Favorites this week
    const { count: favoritesThisWeek } = await supabase
      .from('user_favorites')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString())

    // Favorites previous week
    const { count: favoritesPrevWeek } = await supabase
      .from('user_favorites')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', fourteenDaysAgo.toISOString())
      .lt('created_at', sevenDaysAgo.toISOString())

    // Errors today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { count: errorsToday } = await supabase
      .from('agent_errors')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString())
      .eq('resolved', false)

    // Errors yesterday
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
    const { count: errorsYesterday } = await supabase
      .from('agent_errors')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday.toISOString())
      .lt('created_at', today.toISOString())
      .eq('resolved', false)

    // Calculate percentage changes
    const calcChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0
      return Math.round(((current - previous) / previous) * 100)
    }

    const response = {
      activeUsers: activeUsers || 0,
      activeUsersChange: calcChange(activeUsers || 0, activeUsersPrev || 0),
      totalMessages: totalMessages || 0,
      messagesChange: calcChange(messagesThisWeek || 0, messagesPrevWeek || 0),
      totalFavorites: totalFavorites || 0,
      favoritesChange: calcChange(favoritesThisWeek || 0, favoritesPrevWeek || 0),
      errorsToday: errorsToday || 0,
      errorsChange: calcChange(errorsToday || 0, errorsYesterday || 0),
    }

    console.log('Analytics stats response:', response)

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in analytics-stats:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
