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

    // Session gap definition (30 minutes = new session)
    const SESSION_GAP_MS = 30 * 60 * 1000

    // Active users (DISTINCT users who sent messages in last 7 days)
    // Using pagination to overcome 1000-row limit
    const batchSize = 1000
    
    let activeUserIds: string[] = []
    const userMessagesCurrentPeriod = new Map<string, Date[]>()
    let offset = 0
    while (true) {
      const { data: batch } = await supabase
        .from('chat_messages')
        .select('user_id, created_at')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: true })
        .range(offset, offset + batchSize - 1)
      
      if (!batch || batch.length === 0) break
      
      for (const row of batch) {
        if (row.user_id) {
          activeUserIds.push(row.user_id)
          // Track timestamps for session calculation
          if (row.created_at) {
            if (!userMessagesCurrentPeriod.has(row.user_id)) {
              userMessagesCurrentPeriod.set(row.user_id, [])
            }
            userMessagesCurrentPeriod.get(row.user_id)!.push(new Date(row.created_at))
          }
        }
      }
      
      offset += batchSize
      if (batch.length < batchSize) break
    }
    const messageUserIds = new Set(activeUserIds.filter(Boolean))
    const activeUsersWithMessages = messageUserIds.size

    // ============================================
    // CATALOG USERS: users with favorites or preferences but NO messages
    // ============================================
    
    // Get users who favorited something in last 7 days
    const catalogUserIds = new Set<string>()
    offset = 0
    while (true) {
      const { data: batch } = await supabase
        .from('user_favorites')
        .select('user_id')
        .gte('created_at', sevenDaysAgo.toISOString())
        .range(offset, offset + batchSize - 1)
      
      if (!batch || batch.length === 0) break
      
      for (const row of batch) {
        if (row.user_id && !messageUserIds.has(row.user_id)) {
          catalogUserIds.add(row.user_id)
        }
      }
      
      offset += batchSize
      if (batch.length < batchSize) break
    }
    
    // Get users who updated preferences in last 7 days
    offset = 0
    while (true) {
      const { data: batch } = await supabase
        .from('user_preferences')
        .select('user_id, updated_at')
        .gte('updated_at', sevenDaysAgo.toISOString())
        .range(offset, offset + batchSize - 1)
      
      if (!batch || batch.length === 0) break
      
      for (const row of batch) {
        if (row.user_id && !messageUserIds.has(row.user_id)) {
          catalogUserIds.add(row.user_id)
        }
      }
      
      offset += batchSize
      if (batch.length < batchSize) break
    }
    
    const catalogUsersCount = catalogUserIds.size
    const totalActiveUsers = activeUsersWithMessages + catalogUsersCount

    // Previous period catalog users for comparison
    const prevCatalogUserIds = new Set<string>()
    const prevMessageUserIds = new Set<string>()
    
    // Previous period message users
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
        if (row.user_id) prevMessageUserIds.add(row.user_id)
      }
      
      offset += batchSize
      if (batch.length < batchSize) break
    }
    
    // Previous period favorites
    offset = 0
    while (true) {
      const { data: batch } = await supabase
        .from('user_favorites')
        .select('user_id')
        .gte('created_at', fourteenDaysAgo.toISOString())
        .lt('created_at', sevenDaysAgo.toISOString())
        .range(offset, offset + batchSize - 1)
      
      if (!batch || batch.length === 0) break
      
      for (const row of batch) {
        if (row.user_id && !prevMessageUserIds.has(row.user_id)) {
          prevCatalogUserIds.add(row.user_id)
        }
      }
      
      offset += batchSize
      if (batch.length < batchSize) break
    }
    
    const catalogUsersPrev = prevCatalogUserIds.size
    const activeUsersPrev = prevMessageUserIds.size
    const totalActiveUsersPrev = activeUsersPrev + catalogUsersPrev

    // Active users previous period (DISTINCT, for comparison)
    const userMessagesPrevPeriod = new Map<string, Date[]>()
    offset = 0
    while (true) {
      const { data: batch } = await supabase
        .from('chat_messages')
        .select('user_id, created_at')
        .gte('created_at', fourteenDaysAgo.toISOString())
        .lt('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: true })
        .range(offset, offset + batchSize - 1)
      
      if (!batch || batch.length === 0) break
      
      for (const row of batch) {
        if (row.user_id && row.created_at) {
          if (!userMessagesPrevPeriod.has(row.user_id)) {
            userMessagesPrevPeriod.set(row.user_id, [])
          }
          userMessagesPrevPeriod.get(row.user_id)!.push(new Date(row.created_at))
        }
      }
      
      offset += batchSize
      if (batch.length < batchSize) break
    }

    // Helper function to calculate sessions from timestamps
    const calculateSessions = (timestamps: Date[]): number => {
      if (timestamps.length === 0) return 0
      timestamps.sort((a, b) => a.getTime() - b.getTime())
      let sessions = 1
      for (let i = 1; i < timestamps.length; i++) {
        const gap = timestamps[i].getTime() - timestamps[i - 1].getTime()
        if (gap > SESSION_GAP_MS) {
          sessions++
        }
      }
      return sessions
    }

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

    // Power Users - users with 2+ sessions (30min gap = new session) in last 7 days
    const userSessionCounts = new Map<string, number>()
    userMessagesCurrentPeriod.forEach((timestamps, userId) => {
      const sessions = calculateSessions(timestamps)
      userSessionCounts.set(userId, sessions)
    })

    // Get user profiles for names
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, full_name')

    const profileMap = new Map<string, string>()
    profiles?.forEach(p => {
      profileMap.set(p.id, p.full_name || 'Usuário Anônimo')
    })

    // Get phone numbers from auth.users using SQL for reliable access
    const phoneMap = new Map<string, string>()
    const userIdsToFetch = Array.from(userSessionCounts.keys()).filter(uid => {
      const sessions = userSessionCounts.get(uid)
      return sessions && sessions >= 2
    })
    
    if (userIdsToFetch.length > 0) {
      const { data: authPhones } = await supabase
        .rpc('get_user_phones_by_ids', { user_ids: userIdsToFetch })
        .single()
      
      // Fallback: try fetching from auth.users directly via admin API with pagination
      if (!authPhones) {
        let page = 1
        const perPage = 1000
        while (true) {
          const { data: authBatch } = await supabase.auth.admin.listUsers({
            page,
            perPage
          })
          if (!authBatch?.users || authBatch.users.length === 0) break
          authBatch.users.forEach(u => {
            if (u.phone && userIdsToFetch.includes(u.id)) {
              phoneMap.set(u.id, u.phone)
            }
          })
          if (authBatch.users.length < perPage) break
          page++
        }
      }
    }

    // Power users are those with 2+ sessions (indicating repeated access)
    const powerUsersList: { userId: string; userName: string; userPhone: string; accessCount: number }[] = []
    userSessionCounts.forEach((sessions, userId) => {
      if (sessions >= 2) {
        powerUsersList.push({ 
          userId, 
          userName: profileMap.get(userId) || 'Usuário Anônimo',
          userPhone: phoneMap.get(userId) || '',
          accessCount: sessions 
        })
      }
    })
    powerUsersList.sort((a, b) => b.accessCount - a.accessCount)

    const powerUsersCount = powerUsersList.length

    // Previous period power users for comparison
    let powerUsersPrevCount = 0
    userMessagesPrevPeriod.forEach((timestamps, userId) => {
      const sessions = calculateSessions(timestamps)
      if (sessions >= 2) powerUsersPrevCount++
    })

    // Calculate percentage changes
    const calcChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0
      return Math.round(((current - previous) / previous) * 100)
    }

    const response = {
      activeUsers: totalActiveUsers, // Now includes catalog users
      activeUsersWithMessages: activeUsersWithMessages,
      catalogUsers: catalogUsersCount,
      activeUsersChange: calcChange(totalActiveUsers, totalActiveUsersPrev),
      catalogUsersChange: calcChange(catalogUsersCount, catalogUsersPrev),
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

    console.log('Analytics stats response:', {
      totalActive: totalActiveUsers,
      withMessages: activeUsersWithMessages,
      catalogOnly: catalogUsersCount,
      powerUsers: powerUsersCount
    })

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
