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

    // Parse request body for mode and zoomHour
    let mode = 'week'
    let zoomHour: number | null = null
    try {
      const body = await req.json()
      if (body.mode === 'day' || body.mode === 'week') {
        mode = body.mode
      }
      if (typeof body.zoomHour === 'number' && body.zoomHour >= 0 && body.zoomHour < 24) {
        zoomHour = body.zoomHour
      }
    } catch {
      // Use default
    }

    // Brazil timezone offset: UTC-3
    // When it's 12:00 UTC, it's 09:00 in Brazil
    const BRAZIL_OFFSET_HOURS = -3

    // Get hour in Brazil timezone from a UTC timestamp
    const getBrazilDate = (utcTimestamp: string): Date => {
      const utcDate = new Date(utcTimestamp)
      // Add the offset (negative means subtract) to convert UTC to Brazil local time
      return new Date(utcDate.getTime() + (BRAZIL_OFFSET_HOURS * 60 * 60 * 1000))
    }

    const getBrazilHour = (utcTimestamp: string): number => {
      return getBrazilDate(utcTimestamp).getUTCHours()
    }

    // Get 15-minute slot key (e.g., "14:15") from a UTC timestamp
    const get15MinSlot = (utcTimestamp: string): string => {
      const brazilDate = getBrazilDate(utcTimestamp)
      const hour = brazilDate.getUTCHours()
      const minutes = brazilDate.getUTCMinutes()
      const slot = Math.floor(minutes / 15) * 15
      return `${hour.toString().padStart(2, '0')}:${slot.toString().padStart(2, '0')}`
    }

    // Get Brazil date string (YYYY-MM-DD) from a UTC timestamp
    const getBrazilDateKey = (utcTimestamp: string): string => {
      const brazilDate = getBrazilDate(utcTimestamp)
      return `${brazilDate.getUTCFullYear()}-${String(brazilDate.getUTCMonth() + 1).padStart(2, '0')}-${String(brazilDate.getUTCDate()).padStart(2, '0')}`
    }

    // Get current time in Brazil
    const getNowInBrazil = (): Date => {
      return new Date(Date.now() + (BRAZIL_OFFSET_HOURS * 60 * 60 * 1000))
    }

    // Get start of today in Brazil (as UTC timestamp for querying)
    // If it's 10:00 Brazil time, we want midnight Brazil = 03:00 UTC same day
    const getBrazilTodayStartUTC = (): Date => {
      const brazilNow = getNowInBrazil()
      const year = brazilNow.getUTCFullYear()
      const month = brazilNow.getUTCMonth()
      const day = brazilNow.getUTCDate()
      // Midnight in Brazil is 03:00 UTC (because Brazil is UTC-3)
      return new Date(Date.UTC(year, month, day, -BRAZIL_OFFSET_HOURS, 0, 0, 0))
    }

    console.log('Current UTC time:', new Date().toISOString())
    console.log('Current Brazil time:', getNowInBrazil().toISOString())
    console.log('Mode:', mode, 'ZoomHour:', zoomHour)

    if (mode === 'day') {
      // Get messages from today (Brazil time)
      const todayStartUTC = getBrazilTodayStartUTC()
      
      console.log('Brazil today start (UTC):', todayStartUTC.toISOString())
      
      // Paginate to get all messages
      let allMessages: { created_at: string | null; user_id: string | null }[] = []
      let page = 0
      const pageSize = 1000
      
      while (true) {
        const { data: messages, error } = await supabase
          .from('chat_messages')
          .select('created_at, user_id')
          .gte('created_at', todayStartUTC.toISOString())
          .order('created_at', { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (error) throw error
        if (!messages || messages.length === 0) break
        
        allMessages = allMessages.concat(messages)
        if (messages.length < pageSize) break
        page++
      }

      console.log('Total messages fetched for today:', allMessages.length)

      // If zoomHour is provided, show 15-minute intervals for that hour only
      if (zoomHour !== null) {
        const slotMap = new Map<string, { mensagens: number; usuarios: Set<string> }>()
        for (let m = 0; m < 60; m += 15) {
          const key = `${zoomHour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
          slotMap.set(key, { mensagens: 0, usuarios: new Set() })
        }

        allMessages.forEach((msg) => {
          if (msg.created_at) {
            const brazilHour = getBrazilHour(msg.created_at)
            if (brazilHour === zoomHour) {
              const slotKey = get15MinSlot(msg.created_at)
              const slotData = slotMap.get(slotKey)
              if (slotData) {
                slotData.mensagens++
                if (msg.user_id) {
                  slotData.usuarios.add(msg.user_id)
                }
              }
            }
          }
        })

        const activity = Array.from(slotMap.entries()).map(([slot, data]) => ({
          label: slot,
          mensagens: data.mensagens,
          usuarios: data.usuarios.size,
        }))

        console.log('Analytics activity (zoom hour', zoomHour, ') response:', activity)

        return new Response(JSON.stringify(activity), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Default: show hourly data
      const hourlyMap = new Map<number, { mensagens: number; usuarios: Set<string> }>()
      for (let h = 0; h < 24; h++) {
        hourlyMap.set(h, { mensagens: 0, usuarios: new Set() })
      }

      allMessages.forEach((msg) => {
        if (msg.created_at) {
          const brazilHour = getBrazilHour(msg.created_at)
          const hourData = hourlyMap.get(brazilHour)!
          hourData.mensagens++
          if (msg.user_id) {
            hourData.usuarios.add(msg.user_id)
          }
        }
      })

      const activity = Array.from(hourlyMap.entries()).map(([hour, data]) => ({
        label: `${hour.toString().padStart(2, '0')}h`,
        mensagens: data.mensagens,
        usuarios: data.usuarios.size,
      }))

      console.log('Analytics activity (day) response sample:', activity.slice(0, 5))

      return new Response(JSON.stringify(activity), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } else {
      // Get messages from last 7 days (week mode)
      const brazilNow = getNowInBrazil()
      const sevenDaysAgoUTC = new Date(Date.UTC(
        brazilNow.getUTCFullYear(),
        brazilNow.getUTCMonth(),
        brazilNow.getUTCDate() - 6,
        -BRAZIL_OFFSET_HOURS, 0, 0, 0
      ))

      console.log('Week query start (UTC):', sevenDaysAgoUTC.toISOString())

      // Paginate to get all messages
      let allMessages: { created_at: string | null; user_id: string | null }[] = []
      let page = 0
      const pageSize = 1000
      
      while (true) {
        const { data: messages, error } = await supabase
          .from('chat_messages')
          .select('created_at, user_id')
          .gte('created_at', sevenDaysAgoUTC.toISOString())
          .order('created_at', { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (error) throw error
        if (!messages || messages.length === 0) break
        
        allMessages = allMessages.concat(messages)
        if (messages.length < pageSize) break
        page++
      }

      console.log('Total messages fetched for week:', allMessages.length)

      // Aggregate by day (in Brazil timezone)
      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
      const activityMap = new Map<string, { mensagens: number; usuarios: Set<string>; dayOfWeek: number }>()

      // Initialize last 7 days (Brazil time)
      for (let i = 6; i >= 0; i--) {
        const dayDate = new Date(Date.UTC(
          brazilNow.getUTCFullYear(),
          brazilNow.getUTCMonth(),
          brazilNow.getUTCDate() - i
        ))
        const dayKey = `${dayDate.getUTCFullYear()}-${String(dayDate.getUTCMonth() + 1).padStart(2, '0')}-${String(dayDate.getUTCDate()).padStart(2, '0')}`
        activityMap.set(dayKey, { mensagens: 0, usuarios: new Set(), dayOfWeek: dayDate.getUTCDay() })
      }

      // Count messages and unique users per day (in Brazil timezone)
      allMessages.forEach((msg) => {
        if (msg.created_at) {
          const dayKey = getBrazilDateKey(msg.created_at)
          if (activityMap.has(dayKey)) {
            const dayData = activityMap.get(dayKey)!
            dayData.mensagens++
            if (msg.user_id) {
              dayData.usuarios.add(msg.user_id)
            }
          }
        }
      })

      // Convert to array format
      const activity = Array.from(activityMap.entries()).map(([dateStr, data]) => {
        return {
          label: dayNames[data.dayOfWeek],
          mensagens: data.mensagens,
          usuarios: data.usuarios.size,
        }
      })

      console.log('Analytics activity (week) response:', activity)

      return new Response(JSON.stringify(activity), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } catch (error) {
    console.error('Error in analytics-activity:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
