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

    // Active users (DISTINCT users who sent messages in last 7 days)
    // Using pagination to overcome 1000-row limit
    const batchSize = 1000
    
    let activeUserIds: string[] = []
    let offset = 0
    while (true) {
      const { data: batch } = await supabase
        .from('chat_messages')
        .select('user_id')
        .gte('created_at', sevenDaysAgo.toISOString())
        .range(offset, offset + batchSize - 1)
      
      if (!batch || batch.length === 0) break
      
      for (const row of batch) {
        if (row.user_id) activeUserIds.push(row.user_id)
      }
      
      offset += batchSize
      if (batch.length < batchSize) break
    }
    const activeUsers = new Set(activeUserIds.filter(Boolean)).size

    // Active users previous period (DISTINCT, for comparison)
    let prevUserIds: string[] = []
    offset = 0
    while (true) {
      const { data: batch } = await supabase
        .from('chat_messages')
        .select('user_id')
        .gte('created_at', fourteenDaysAgo.toISOString())
        .lt('created_at', sevenDaysAgo.toISOString())
        .range(offset, offset + batchSize - 1)
      
      if (!batch || batch.length === 0) break
      
      for (const row of batch) {
        if (row.user_id) prevUserIds.push(row.user_id)
      }
      
      offset += batchSize
      if (batch.length < batchSize) break
    }
    const activeUsersPrev = new Set(prevUserIds.filter(Boolean)).size

    // Total messages (count all rows in chat_messages)
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

    // Power Users - users with 2+ accesses (message sessions) in last 7 days
    // Group by user_id and count distinct days they accessed
    const userAccessCount = new Map<string, number>()
    activeUserIds.forEach(userId => {
      if (userId) {
        userAccessCount.set(userId, (userAccessCount.get(userId) || 0) + 1)
      }
    })

    // Power users are those with 2+ messages (indicating repeated engagement)
    const powerUsersList: { userId: string; accessCount: number }[] = []
    userAccessCount.forEach((count, userId) => {
      if (count >= 2) {
        powerUsersList.push({ userId, accessCount: count })
      }
    })
    powerUsersList.sort((a, b) => b.accessCount - a.accessCount)

    const powerUsersCount = powerUsersList.length

    // Previous period power users for comparison
    const prevUserAccessCount = new Map<string, number>()
    prevUserIds.forEach(userId => {
      if (userId) {
        prevUserAccessCount.set(userId, (prevUserAccessCount.get(userId) || 0) + 1)
      }
    })
    let powerUsersPrevCount = 0
    prevUserAccessCount.forEach((count) => {
      if (count >= 2) powerUsersPrevCount++
    })

    // Calculate percentage changes
    const calcChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0
      return Math.round(((current - previous) / previous) * 100)
    }

    const response = {
      activeUsers: activeUsers,
      activeUsersChange: calcChange(activeUsers, activeUsersPrev),
      totalMessages: totalMessages || 0,
      messagesChange: calcChange(messagesThisWeek || 0, messagesPrevWeek || 0),
      totalFavorites: totalFavorites || 0,
      favoritesChange: calcChange(favoritesThisWeek || 0, favoritesPrevWeek || 0),
      errorsToday: errorsToday || 0,
      errorsChange: calcChange(errorsToday || 0, errorsYesterday || 0),
      powerUsers: powerUsersCount,
      powerUsersChange: calcChange(powerUsersCount, powerUsersPrevCount),
      powerUsersList: powerUsersList.slice(0, 50), // Top 50 for the modal
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
