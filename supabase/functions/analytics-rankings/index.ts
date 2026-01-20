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

    let type = 'users'
    const url = new URL(req.url)
    
    try {
      const body = await req.json()
      type = body.type || url.searchParams.get('type') || 'users'
    } catch {
      type = url.searchParams.get('type') || 'users'
    }
    
    console.log('Analytics rankings - type:', type)

    if (type === 'users') {
      const SESSION_GAP_MS = 30 * 60 * 1000
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

      // Run queries in parallel - only fetch last 7 days for performance
      const [messagesResult, favoritesResult, profilesResult] = await Promise.all([
        supabase
          .from('chat_messages')
          .select('user_id, created_at')
          .gte('created_at', sevenDaysAgo.toISOString())
          .order('created_at', { ascending: true }),
        supabase
          .from('user_favorites')
          .select('user_id'),
        supabase
          .from('user_profiles')
          .select('id, full_name'),
      ])

      const messageCounts = new Map<string, number>()
      const userMessages = new Map<string, Date[]>()
      
      for (const m of messagesResult.data || []) {
        if (m.user_id) {
          messageCounts.set(m.user_id, (messageCounts.get(m.user_id) || 0) + 1)
          if (m.created_at) {
            if (!userMessages.has(m.user_id)) {
              userMessages.set(m.user_id, [])
            }
            userMessages.get(m.user_id)!.push(new Date(m.created_at))
          }
        }
      }

      // Calculate sessions
      const sessionCounts = new Map<string, number>()
      userMessages.forEach((timestamps, userId) => {
        timestamps.sort((a, b) => a.getTime() - b.getTime())
        let sessions = timestamps.length > 0 ? 1 : 0
        for (let i = 1; i < timestamps.length; i++) {
          if (timestamps[i].getTime() - timestamps[i-1].getTime() > SESSION_GAP_MS) {
            sessions++
          }
        }
        sessionCounts.set(userId, sessions)
      })

      const favoriteCounts = new Map<string, number>()
      for (const f of favoritesResult.data || []) {
        if (f.user_id) {
          favoriteCounts.set(f.user_id, (favoriteCounts.get(f.user_id) || 0) + 1)
        }
      }

      const userScores = (profilesResult.data || []).map(profile => {
        const messageCount = messageCounts.get(profile.id) || 0
        const favoriteCount = favoriteCounts.get(profile.id) || 0
        const sessions = sessionCounts.get(profile.id) || 0
        return {
          id: profile.id,
          name: profile.full_name || 'Usuário Anônimo',
          messages: messageCount,
          favorites: favoriteCount,
          score: messageCount * 1 + favoriteCount * 3,
          sessions: sessions,
        }
      })

      // Return top 100 instead of all users
      const topUsers = userScores
        .sort((a, b) => b.score - a.score)
        .slice(0, 100)

      console.log('Analytics rankings (users) response:', topUsers.length, 'users')

      return new Response(JSON.stringify(topUsers), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (type === 'locations') {
      const [profilesResult, preferencesResult] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('city')
          .not('city', 'is', null),
        supabase
          .from('user_preferences')
          .select('state_preference')
          .not('state_preference', 'is', null),
      ])

      const locationCounts = new Map<string, number>()
      
      for (const p of profilesResult.data || []) {
        if (p.city) {
          locationCounts.set(p.city, (locationCounts.get(p.city) || 0) + 1)
        }
      }

      for (const p of preferencesResult.data || []) {
        if (p.state_preference) {
          locationCounts.set(p.state_preference, (locationCounts.get(p.state_preference) || 0) + 1)
        }
      }

      const locations = Array.from(locationCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      console.log('Analytics rankings (locations) response:', locations.length, 'locations')

      return new Response(JSON.stringify(locations), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (type === 'courses') {
      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('course_interest')
        .not('course_interest', 'is', null)

      const courseCounts = new Map<string, number>()
      
      for (const p of preferences || []) {
        if (p.course_interest && Array.isArray(p.course_interest)) {
          for (const course of p.course_interest) {
            courseCounts.set(course, (courseCounts.get(course) || 0) + 1)
          }
        }
      }

      const courses = Array.from(courseCounts.entries())
        .map(([name, searches]) => ({ name, searches }))
        .sort((a, b) => b.searches - a.searches)
        .slice(0, 6)

      console.log('Analytics rankings (courses) response:', courses.length, 'courses')

      return new Response(JSON.stringify(courses), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (type === 'preferences') {
      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('program_preference')
        .not('program_preference', 'is', null)

      const prefCounts = new Map<string, number>()
      
      for (const p of preferences || []) {
        if (p.program_preference) {
          prefCounts.set(p.program_preference, (prefCounts.get(p.program_preference) || 0) + 1)
        }
      }

      const total = preferences?.length || 1

      const prefs = Array.from(prefCounts.entries())
        .map(([name, count]) => ({ 
          name, 
          value: Math.round((count / total) * 100)
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)

      console.log('Analytics rankings (preferences) response:', prefs.length, 'preferences')

      return new Response(JSON.stringify(prefs), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (type === 'location_preferences') {
      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('location_preference')
        .not('location_preference', 'is', null)

      const locationCounts = new Map<string, number>()
      
      for (const p of preferences || []) {
        let loc = (p.location_preference || '').trim()
        if (!loc) continue
        loc = loc.charAt(0).toUpperCase() + loc.slice(1)
        locationCounts.set(loc, (locationCounts.get(loc) || 0) + 1)
      }

      const locations = Array.from(locationCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)

      console.log('Analytics rankings (location_preferences) response:', locations.length, 'locations')

      return new Response(JSON.stringify(locations), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid type parameter' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in analytics-rankings:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})