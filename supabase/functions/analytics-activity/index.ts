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
    const BRAZIL_OFFSET_HOURS = -3

    const getBrazilDate = (utcTimestamp: string): Date => {
      const utcDate = new Date(utcTimestamp)
      return new Date(utcDate.getTime() + (BRAZIL_OFFSET_HOURS * 60 * 60 * 1000))
    }

    const getBrazilHour = (utcTimestamp: string): number => {
      return getBrazilDate(utcTimestamp).getUTCHours()
    }

    const get15MinSlot = (utcTimestamp: string): string => {
      const brazilDate = getBrazilDate(utcTimestamp)
      const hour = brazilDate.getUTCHours()
      const minutes = brazilDate.getUTCMinutes()
      const slot = Math.floor(minutes / 15) * 15
      return `${hour.toString().padStart(2, '0')}:${slot.toString().padStart(2, '0')}`
    }

    const getBrazilDateKey = (utcTimestamp: string): string => {
      const brazilDate = getBrazilDate(utcTimestamp)
      return `${brazilDate.getUTCFullYear()}-${String(brazilDate.getUTCMonth() + 1).padStart(2, '0')}-${String(brazilDate.getUTCDate()).padStart(2, '0')}`
    }

    const getNowInBrazil = (): Date => {
      return new Date(Date.now() + (BRAZIL_OFFSET_HOURS * 60 * 60 * 1000))
    }

    const getBrazilTodayStartUTC = (): Date => {
      const brazilNow = getNowInBrazil()
      const year = brazilNow.getUTCFullYear()
      const month = brazilNow.getUTCMonth()
      const day = brazilNow.getUTCDate()
      return new Date(Date.UTC(year, month, day, -BRAZIL_OFFSET_HOURS, 0, 0, 0))
    }

    console.log('Mode:', mode, 'ZoomHour:', zoomHour)

    if (mode === 'day') {
      const todayStartUTC = getBrazilTodayStartUTC()
      
      // Single query - no pagination needed for today's data (usually < 1000)
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('created_at, user_id')
        .gte('created_at', todayStartUTC.toISOString())
        .order('created_at', { ascending: true })

      if (error) throw error

      console.log('Messages fetched for today:', messages?.length || 0)

      if (zoomHour !== null) {
        const slotMap = new Map<string, { mensagens: number; usuarios: Set<string> }>()
        for (let m = 0; m < 60; m += 15) {
          const key = `${zoomHour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
          slotMap.set(key, { mensagens: 0, usuarios: new Set() })
        }

        for (const msg of messages || []) {
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
        }

        const activity = Array.from(slotMap.entries()).map(([slot, data]) => ({
          label: slot,
          mensagens: data.mensagens,
          usuarios: data.usuarios.size,
        }))

        return new Response(JSON.stringify(activity), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Hourly data
      const hourlyMap = new Map<number, { mensagens: number; usuarios: Set<string> }>()
      for (let h = 0; h < 24; h++) {
        hourlyMap.set(h, { mensagens: 0, usuarios: new Set() })
      }

      for (const msg of messages || []) {
        if (msg.created_at) {
          const brazilHour = getBrazilHour(msg.created_at)
          const hourData = hourlyMap.get(brazilHour)!
          hourData.mensagens++
          if (msg.user_id) {
            hourData.usuarios.add(msg.user_id)
          }
        }
      }

      const activity = Array.from(hourlyMap.entries()).map(([hour, data]) => ({
        label: `${hour.toString().padStart(2, '0')}h`,
        mensagens: data.mensagens,
        usuarios: data.usuarios.size,
      }))

      console.log('Activity (day) sample:', activity.slice(0, 3))

      return new Response(JSON.stringify(activity), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } else {
      // Week mode
      const brazilNow = getNowInBrazil()
      const sevenDaysAgoUTC = new Date(Date.UTC(
        brazilNow.getUTCFullYear(),
        brazilNow.getUTCMonth(),
        brazilNow.getUTCDate() - 6,
        -BRAZIL_OFFSET_HOURS, 0, 0, 0
      ))

      // Single query for week data
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('created_at, user_id')
        .gte('created_at', sevenDaysAgoUTC.toISOString())
        .order('created_at', { ascending: true })

      if (error) throw error

      console.log('Messages fetched for week:', messages?.length || 0)

      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
      const activityMap = new Map<string, { mensagens: number; usuarios: Set<string>; dayOfWeek: number }>()

      for (let i = 6; i >= 0; i--) {
        const dayDate = new Date(Date.UTC(
          brazilNow.getUTCFullYear(),
          brazilNow.getUTCMonth(),
          brazilNow.getUTCDate() - i
        ))
        const dayKey = `${dayDate.getUTCFullYear()}-${String(dayDate.getUTCMonth() + 1).padStart(2, '0')}-${String(dayDate.getUTCDate()).padStart(2, '0')}`
        activityMap.set(dayKey, { mensagens: 0, usuarios: new Set(), dayOfWeek: dayDate.getUTCDay() })
      }

      for (const msg of messages || []) {
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
      }

      const activity = Array.from(activityMap.entries()).map(([_, data]) => ({
        label: dayNames[data.dayOfWeek],
        mensagens: data.mensagens,
        usuarios: data.usuarios.size,
      }))

      console.log('Activity (week):', activity)

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