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

    // Read type from body (POST) or query string (GET)
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
      // Get message counts per user
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('user_id')

      const messageCounts = new Map<string, number>()
      messages?.forEach(m => {
        if (m.user_id) {
          messageCounts.set(m.user_id, (messageCounts.get(m.user_id) || 0) + 1)
        }
      })

      // Get favorite counts per user
      const { data: favorites } = await supabase
        .from('user_favorites')
        .select('user_id')

      const favoriteCounts = new Map<string, number>()
      favorites?.forEach(f => {
        if (f.user_id) {
          favoriteCounts.set(f.user_id, (favoriteCounts.get(f.user_id) || 0) + 1)
        }
      })

      // Get user profiles
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name')

      // Calculate engagement score and build ranking
      const userScores = profiles?.map(profile => {
        const messageCount = messageCounts.get(profile.id) || 0
        const favoriteCount = favoriteCounts.get(profile.id) || 0
        const engagementScore = messageCount * 1 + favoriteCount * 3

        return {
          id: profile.id,
          name: profile.full_name || 'Usuário Anônimo',
          messages: messageCount,
          favorites: favoriteCount,
          score: engagementScore,
        }
      }) || []

      // Sort by score and take top 10
      const topUsers = userScores
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)

      console.log('Analytics rankings (users) response:', topUsers.length, 'users')

      return new Response(JSON.stringify(topUsers), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (type === 'locations') {
      // Get locations from user_profiles
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('city')
        .not('city', 'is', null)

      // Get locations from user_preferences
      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('state_preference')
        .not('state_preference', 'is', null)

      // Count locations
      const locationCounts = new Map<string, number>()
      
      profiles?.forEach(p => {
        if (p.city) {
          locationCounts.set(p.city, (locationCounts.get(p.city) || 0) + 1)
        }
      })

      preferences?.forEach(p => {
        if (p.state_preference) {
          const loc = p.state_preference
          locationCounts.set(loc, (locationCounts.get(loc) || 0) + 1)
        }
      })

      // Convert to array and sort
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
      // Get course interests from user_preferences
      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('course_interest')
        .not('course_interest', 'is', null)

      // Count course occurrences
      const courseCounts = new Map<string, number>()
      
      preferences?.forEach(p => {
        if (p.course_interest && Array.isArray(p.course_interest)) {
          p.course_interest.forEach((course: string) => {
            courseCounts.set(course, (courseCounts.get(course) || 0) + 1)
          })
        }
      })

      // Convert to array and sort
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
      // Get program preferences
      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('program_preference')
        .not('program_preference', 'is', null)

      // Count preferences
      const prefCounts = new Map<string, number>()
      
      preferences?.forEach(p => {
        if (p.program_preference) {
          prefCounts.set(p.program_preference, (prefCounts.get(p.program_preference) || 0) + 1)
        }
      })

      const total = preferences?.length || 1

      // Convert to array with percentages
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
