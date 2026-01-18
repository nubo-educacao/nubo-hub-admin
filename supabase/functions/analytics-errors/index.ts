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

    const url = new URL(req.url)
    const limit = parseInt(url.searchParams.get('limit') || '10')
    const typeFilter = url.searchParams.get('type') // error, warning, info
    const statusFilter = url.searchParams.get('status') // resolved, unresolved

    let query = supabase
      .from('agent_errors')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    // Apply type filter based on error_type
    if (typeFilter === 'error') {
      query = query.in('error_type', ['matching_error', 'api_error', 'timeout_error'])
    } else if (typeFilter === 'warning') {
      query = query.in('error_type', ['parsing_error', 'validation_error'])
    } else if (typeFilter === 'info') {
      query = query.in('error_type', ['moderation_error', 'info'])
    }

    // Apply status filter
    if (statusFilter === 'resolved') {
      query = query.eq('resolved', true)
    } else if (statusFilter === 'unresolved') {
      query = query.eq('resolved', false)
    }

    const { data: errors, error } = await query

    if (error) throw error

    // Format errors for frontend
    const formattedErrors = errors?.map(err => {
      // Determine type based on error_type
      let type: 'error' | 'warning' | 'info' = 'error'
      if (['parsing_error', 'validation_error'].includes(err.error_type)) {
        type = 'warning'
      } else if (['moderation_error', 'info'].includes(err.error_type)) {
        type = 'info'
      }

      // Format relative time
      const createdAt = new Date(err.created_at || '')
      const now = new Date()
      const diffMs = now.getTime() - createdAt.getTime()
      const diffMins = Math.floor(diffMs / (1000 * 60))
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      let timeAgo = 'agora'
      if (diffDays > 0) {
        timeAgo = `há ${diffDays}d`
      } else if (diffHours > 0) {
        timeAgo = `há ${diffHours}h`
      } else if (diffMins > 0) {
        timeAgo = `há ${diffMins}min`
      }

      return {
        id: err.id,
        type,
        message: err.error_message || err.error_type,
        count: 1, // Could aggregate similar errors
        time: timeAgo,
        errorType: err.error_type,
        resolved: err.resolved,
        recoveryAttempted: err.recovery_attempted,
        stackTrace: err.stack_trace,
        metadata: err.metadata,
        sessionId: err.session_id,
        userId: err.user_id,
        createdAt: err.created_at,
      }
    }) || []

    console.log('Analytics errors response:', formattedErrors.length, 'errors')

    return new Response(JSON.stringify(formattedErrors), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in analytics-errors:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
