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

    // Parse request body for mode
    let mode = 'week'
    try {
      const body = await req.json()
      if (body.mode === 'day' || body.mode === 'week') {
        mode = body.mode
      }
    } catch {
      // Use default
    }

    // Brazil is UTC-3, so we subtract 3 hours from UTC to get Brazil time
    // When it's 19:00 UTC, it's 16:00 in Brazil
    const BRAZIL_OFFSET_MS = 3 * 60 * 60 * 1000 // 3 hours in milliseconds

    // Get hour in Brazil timezone from a UTC timestamp
    const getBrazilHour = (utcTimestamp: string): number => {
      const utcDate = new Date(utcTimestamp)
      // Subtract 3 hours to get Brazil time
      const brazilDate = new Date(utcDate.getTime() - BRAZIL_OFFSET_MS)
      return brazilDate.getUTCHours()
    }

    // Get 15-minute slot key (e.g., "14:15") from a UTC timestamp
    const get15MinSlot = (utcTimestamp: string): string => {
      const utcDate = new Date(utcTimestamp)
      const brazilDate = new Date(utcDate.getTime() - BRAZIL_OFFSET_MS)
      const hour = brazilDate.getUTCHours()
      const minutes = brazilDate.getUTCMinutes()
      const slot = Math.floor(minutes / 15) * 15
      return `${hour.toString().padStart(2, '0')}:${slot.toString().padStart(2, '0')}`
    }

    // Get Brazil date string (YYYY-MM-DD) from a UTC timestamp
    const getBrazilDateKey = (utcTimestamp: string): string => {
      const utcDate = new Date(utcTimestamp)
      const brazilDate = new Date(utcDate.getTime() - BRAZIL_OFFSET_MS)
      return `${brazilDate.getUTCFullYear()}-${String(brazilDate.getUTCMonth() + 1).padStart(2, '0')}-${String(brazilDate.getUTCDate()).padStart(2, '0')}`
    }

    // Get current time in Brazil
    const getNowInBrazil = (): Date => {
      return new Date(Date.now() - BRAZIL_OFFSET_MS)
    }

    // Get start of today in Brazil (as UTC timestamp for querying)
    const getBrazilTodayStartUTC = (): Date => {
      const brazilNow = getNowInBrazil()
      // Midnight Brazil time = 03:00 UTC
      return new Date(Date.UTC(
        brazilNow.getUTCFullYear(),
        brazilNow.getUTCMonth(),
        brazilNow.getUTCDate(),
        3, 0, 0, 0 // 03:00 UTC = 00:00 Brazil
      ))
    }

    if (mode === 'day') {
      // Get messages from today (Brazil time), grouped by hour
      const todayStartUTC = getBrazilTodayStartUTC()
      
      console.log('Brazil today start (UTC):', todayStartUTC.toISOString())
      console.log('Current Brazil time:', getNowInBrazil().toISOString())
      
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('created_at, user_id')
        .gte('created_at', todayStartUTC.toISOString())
        .order('created_at', { ascending: true })

      if (error) throw error

      // Initialize 96 slots (24 hours * 4 slots per hour = 15-minute intervals)
      const slotMap = new Map<string, { mensagens: number; usuarios: Set<string> }>()
      for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 15) {
          const key = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
          slotMap.set(key, { mensagens: 0, usuarios: new Set() })
        }
      }

      // Count messages and unique users per 15-min slot (in Brazil timezone)
      messages?.forEach((msg) => {
        if (msg.created_at) {
          const slotKey = get15MinSlot(msg.created_at)
          const slotData = slotMap.get(slotKey)
          if (slotData) {
            slotData.mensagens++
            if (msg.user_id) {
              slotData.usuarios.add(msg.user_id)
            }
          }
        }
      })

      // Convert to array format - only include slots with data or from hours with data
      const activity = Array.from(slotMap.entries()).map(([slot, data]) => ({
        label: slot,
        mensagens: data.mensagens,
        usuarios: data.usuarios.size,
      }))

      console.log('Analytics activity (day - Brasília - 15min) response:', activity.filter(a => a.mensagens > 0).length, 'slots with data')

      return new Response(JSON.stringify(activity), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } else {
      // Get messages from last 7 days (week mode)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('created_at, user_id')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: true })

      if (error) throw error

      // Aggregate by day (in Brazil timezone)
      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
      const activityMap = new Map<string, { mensagens: number; usuarios: Set<string>; dayOfWeek: number }>()

      // Initialize last 7 days (Brazil time)
      const brazilNow = getNowInBrazil()
      for (let i = 6; i >= 0; i--) {
        const date = new Date(brazilNow.getTime())
        date.setUTCDate(date.getUTCDate() - i)
        const dayKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
        activityMap.set(dayKey, { mensagens: 0, usuarios: new Set(), dayOfWeek: date.getUTCDay() })
      }

      // Count messages and unique users per day (in Brazil timezone)
      messages?.forEach((msg) => {
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

      console.log('Analytics activity (week - Brasília) response:', activity)

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