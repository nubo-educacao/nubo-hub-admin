import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to fetch all records with pagination
async function fetchAllRecords<T>(
  supabase: any,
  table: string,
  selectFields: string,
  filters?: { column: string; operator: string; value: string }[],
  orderBy?: { column: string; ascending: boolean }
): Promise<T[]> {
  const PAGE_SIZE = 1000
  let allData: T[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from(table)
      .select(selectFields)
      .range(offset, offset + PAGE_SIZE - 1)

    if (filters) {
      for (const filter of filters) {
        if (filter.operator === 'gte') {
          query = query.gte(filter.column, filter.value)
        } else if (filter.operator === 'not.is') {
          query = query.not(filter.column, 'is', null)
        }
      }
    }

    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending })
    }

    const { data, error } = await query

    if (error) {
      console.error(`Error fetching ${table}:`, error)
      break
    }

    if (data && data.length > 0) {
      allData = allData.concat(data as T[])
      offset += PAGE_SIZE
      hasMore = data.length === PAGE_SIZE
    } else {
      hasMore = false
    }
  }

  return allData
}

// Normalize city names to remove duplicates like "São Paulo" vs "São Paulo - SP"
function normalizeCity(city: string): string {
  if (!city) return ''
  
  // Remove state suffix patterns like " - SP", " - RJ", etc.
  let normalized = city.trim()
  const statePattern = /\s*-\s*[A-Z]{2}$/i
  normalized = normalized.replace(statePattern, '')
  
  // Capitalize first letter of each word
  return normalized.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ')
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

      // Fetch all messages with pagination
      interface Message { user_id: string | null; created_at: string | null }
      interface Favorite { user_id: string | null }
      interface Profile { id: string; full_name: string | null }

      const [messages, favorites, profiles] = await Promise.all([
        fetchAllRecords<Message>(
          supabase,
          'chat_messages',
          'user_id, created_at',
          [{ column: 'created_at', operator: 'gte', value: sevenDaysAgo.toISOString() }],
          { column: 'created_at', ascending: true }
        ),
        fetchAllRecords<Favorite>(supabase, 'user_favorites', 'user_id'),
        fetchAllRecords<Profile>(supabase, 'user_profiles', 'id, full_name'),
      ])

      console.log(`Fetched ${messages.length} messages, ${favorites.length} favorites, ${profiles.length} profiles`)

      const messageCounts = new Map<string, number>()
      const userMessages = new Map<string, Date[]>()
      
      for (const m of messages) {
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
      for (const f of favorites) {
        if (f.user_id) {
          favoriteCounts.set(f.user_id, (favoriteCounts.get(f.user_id) || 0) + 1)
        }
      }

      const userScores = profiles.map(profile => {
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
      console.log('Top 3 users:', topUsers.slice(0, 3).map(u => `${u.name}: ${u.messages} msgs, ${u.sessions} sessions`))

      return new Response(JSON.stringify(topUsers), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (type === 'locations') {
      // This shows where users LIVE (from user_profiles.city)
      interface Profile { city: string | null }
      
      const profiles = await fetchAllRecords<Profile>(
        supabase,
        'user_profiles',
        'city',
        [{ column: 'city', operator: 'not.is', value: 'null' }]
      )

      const locationCounts = new Map<string, number>()
      
      for (const p of profiles) {
        if (p.city) {
          const normalized = normalizeCity(p.city)
          if (normalized) {
            locationCounts.set(normalized, (locationCounts.get(normalized) || 0) + 1)
          }
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
      interface Preference { course_interest: string[] | null }
      
      const preferences = await fetchAllRecords<Preference>(
        supabase,
        'user_preferences',
        'course_interest',
        [{ column: 'course_interest', operator: 'not.is', value: 'null' }]
      )

      const courseCounts = new Map<string, number>()
      
      for (const p of preferences) {
        if (p.course_interest && Array.isArray(p.course_interest)) {
          for (const course of p.course_interest) {
            if (course && course.trim()) {
              courseCounts.set(course.trim(), (courseCounts.get(course.trim()) || 0) + 1)
            }
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
      interface Preference { program_preference: string | null }
      
      const preferences = await fetchAllRecords<Preference>(
        supabase,
        'user_preferences',
        'program_preference',
        [{ column: 'program_preference', operator: 'not.is', value: 'null' }]
      )

      const prefCounts = new Map<string, number>()
      
      for (const p of preferences) {
        if (p.program_preference) {
          prefCounts.set(p.program_preference, (prefCounts.get(p.program_preference) || 0) + 1)
        }
      }

      const total = preferences.length || 1

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
      // This shows where users WANT TO STUDY (from user_preferences.location_preference)
      interface Preference { location_preference: string | null }
      
      const preferences = await fetchAllRecords<Preference>(
        supabase,
        'user_preferences',
        'location_preference',
        [{ column: 'location_preference', operator: 'not.is', value: 'null' }]
      )

      const locationCounts = new Map<string, number>()
      
      for (const p of preferences) {
        if (p.location_preference) {
          const loc = normalizeCity(p.location_preference)
          if (loc) {
            locationCounts.set(loc, (locationCounts.get(loc) || 0) + 1)
          }
        }
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
