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

    // Brazil timezone offset (UTC-3 for Brasília standard time)
    const BRAZIL_OFFSET_HOURS = -3

    // Helper function to convert UTC date to Brazil timezone
    const toBrazilTime = (utcDate: Date): Date => {
      const brazilTime = new Date(utcDate.getTime() + (BRAZIL_OFFSET_HOURS * 60 * 60 * 1000))
      return brazilTime
    }

    // Get Brazil "today" start
    const getBrazilTodayStart = (): Date => {
      const now = new Date()
      const brazilNow = toBrazilTime(now)
      // Create a date for midnight Brazil time in UTC
      const brazilMidnight = new Date(Date.UTC(
        brazilNow.getUTCFullYear(),
        brazilNow.getUTCMonth(),
        brazilNow.getUTCDate(),
        -BRAZIL_OFFSET_HOURS, 0, 0, 0
      ))
      return brazilMidnight
    }

    if (mode === 'day') {
      // Get messages from today (Brazil time), grouped by hour
      const todayStart = getBrazilTodayStart()
      
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('created_at, user_id')
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: true })

      if (error) throw error

      // Initialize 24 hours
      const hourlyMap = new Map<number, { mensagens: number; usuarios: Set<string> }>()
      for (let h = 0; h < 24; h++) {
        hourlyMap.set(h, { mensagens: 0, usuarios: new Set() })
      }

      // Count messages and unique users per hour (in Brazil timezone)
      messages?.forEach((msg) => {
        if (msg.created_at) {
          const utcDate = new Date(msg.created_at)
          const brazilDate = toBrazilTime(utcDate)
          const hour = brazilDate.getUTCHours()
          const hourData = hourlyMap.get(hour)!
          hourData.mensagens++
          if (msg.user_id) {
            hourData.usuarios.add(msg.user_id)
          }
        }
      })

      // Convert to array format
      const activity = Array.from(hourlyMap.entries()).map(([hour, data]) => ({
        label: `${hour.toString().padStart(2, '0')}h`,
        mensagens: data.mensagens,
        usuarios: data.usuarios.size,
      }))

      console.log('Analytics activity (day - Brazil time) response:', activity.filter(a => a.mensagens > 0))

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
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const brazilDate = toBrazilTime(date)
        const dayKey = `${brazilDate.getUTCFullYear()}-${String(brazilDate.getUTCMonth() + 1).padStart(2, '0')}-${String(brazilDate.getUTCDate()).padStart(2, '0')}`
        activityMap.set(dayKey, { mensagens: 0, usuarios: new Set(), dayOfWeek: brazilDate.getUTCDay() })
      }

      // Count messages and unique users per day (in Brazil timezone)
      messages?.forEach((msg) => {
        if (msg.created_at) {
          const utcDate = new Date(msg.created_at)
          const brazilDate = toBrazilTime(utcDate)
          const dayKey = `${brazilDate.getUTCFullYear()}-${String(brazilDate.getUTCMonth() + 1).padStart(2, '0')}-${String(brazilDate.getUTCDate()).padStart(2, '0')}`
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

      console.log('Analytics activity (week - Brazil time) response:', activity)

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