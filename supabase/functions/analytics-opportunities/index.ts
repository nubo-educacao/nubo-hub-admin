import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SavedOpportunity {
  type: string;
  count: number;
  uniqueUsers: number;
}

interface ProgramPreference {
  name: string;
  count: number;
  percentage: number;
}

interface ModalityBreakdown {
  name: string;
  count: number;
}

interface OpportunityTypesData {
  savedOpportunities: {
    byType: SavedOpportunity[];
    withVagasOciosas: number;
    total: number;
  };
  programPreferences: ProgramPreference[];
  vagasOciosas: {
    total: number;
    byModality: ModalityBreakdown[];
  };
  conversionInsight: {
    interestedInSisu: number;
    savedSisu: number;
    interestedInProuni: number;
    savedProuni: number;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Fetching user behavior opportunity data...');

    // 1. Fetch saved opportunities (favorites) by type
    // Join user_favorites -> courses -> opportunities to get opportunity types
    const { data: favoritesData, error: favError } = await supabase
      .from('user_favorites')
      .select(`
        id,
        user_id,
        course_id,
        courses!inner (
          id,
          opportunities (
            id,
            opportunity_type
          )
        )
      `)
      .not('course_id', 'is', null);

    if (favError) {
      console.error('Error fetching favorites:', favError);
      throw favError;
    }

    console.log('Favorites data:', JSON.stringify(favoritesData, null, 2));

    // Count favorites by opportunity type
    const typeCountMap: Record<string, { count: number; users: Set<string> }> = {
      sisu: { count: 0, users: new Set() },
      prouni: { count: 0, users: new Set() },
    };
    
    let totalFavorites = 0;
    const courseIdsWithFavorites: string[] = [];

    for (const fav of favoritesData || []) {
      totalFavorites++;
      const courses = fav.courses as unknown as { id: string; opportunities: { id: string; opportunity_type: string }[] } | null;
      
      if (courses?.id) {
        courseIdsWithFavorites.push(courses.id);
      }
      
      if (courses?.opportunities) {
        for (const opp of courses.opportunities) {
          const type = opp.opportunity_type || 'unknown';
          if (!typeCountMap[type]) {
            typeCountMap[type] = { count: 0, users: new Set() };
          }
          typeCountMap[type].count++;
          typeCountMap[type].users.add(fav.user_id);
        }
      }
    }

    const savedByType: SavedOpportunity[] = Object.entries(typeCountMap)
      .filter(([_, data]) => data.count > 0)
      .map(([type, data]) => ({
        type: type === 'sisu' ? 'SISU' : type === 'prouni' ? 'ProUni' : type,
        count: data.count,
        uniqueUsers: data.users.size,
      }))
      .sort((a, b) => b.count - a.count);

    console.log('Saved by type:', savedByType);

    // 2. Check how many favorites have vagas ociosas available
    let favoritesWithVagasOciosas = 0;
    
    if (courseIdsWithFavorites.length > 0) {
      // Get opportunities for these courses that have vagas ociosas
      const { data: oppWithVagas, error: vagasCheckError } = await supabase
        .from('opportunities')
        .select(`
          id,
          course_id,
          opportunitiessisuvacancies!inner (
            vagas_ociosas_2025
          )
        `)
        .in('course_id', courseIdsWithFavorites)
        .gt('opportunitiessisuvacancies.vagas_ociosas_2025', 0);

      if (!vagasCheckError && oppWithVagas) {
        const coursesWithVagas = new Set(oppWithVagas.map(o => o.course_id));
        favoritesWithVagasOciosas = courseIdsWithFavorites.filter(id => coursesWithVagas.has(id)).length;
      }
      
      console.log('Favorites with vagas ociosas:', favoritesWithVagasOciosas);
    }

    // 3. Fetch program preferences from user_preferences
    const { data: preferencesData, error: prefError } = await supabase
      .from('user_preferences')
      .select('program_preference')
      .not('program_preference', 'is', null);

    if (prefError) {
      console.error('Error fetching preferences:', prefError);
      throw prefError;
    }

    // Count program preferences
    const prefCounts: Record<string, number> = {};
    for (const row of preferencesData || []) {
      const pref = row.program_preference || 'Não informado';
      prefCounts[pref] = (prefCounts[pref] || 0) + 1;
    }

    const totalPrefs = Object.values(prefCounts).reduce((a, b) => a + b, 0);
    const programPreferences: ProgramPreference[] = Object.entries(prefCounts)
      .map(([name, count]) => ({
        name: name === 'sisu' ? 'SISU' : name === 'prouni' ? 'ProUni' : name === 'both' ? 'Ambos' : name === 'indiferente' ? 'Indiferente' : name,
        count,
        percentage: totalPrefs > 0 ? Math.round((count / totalPrefs) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    console.log('Program preferences:', programPreferences);

    // 4. Fetch vagas ociosas summary (opportunity available)
    const { data: vagasData, error: vagasError } = await supabase
      .from('opportunitiessisuvacancies')
      .select('vagas_ociosas_2025, ds_mod_concorrencia')
      .not('vagas_ociosas_2025', 'is', null)
      .gt('vagas_ociosas_2025', 0);

    if (vagasError) {
      console.error('Error fetching vagas ociosas:', vagasError);
      throw vagasError;
    }

    let totalVagasOciosas = 0;
    const modalityCounts: Record<string, number> = {};

    for (const row of vagasData || []) {
      const vagas = row.vagas_ociosas_2025 || 0;
      totalVagasOciosas += vagas;
      
      const modality = row.ds_mod_concorrencia || 'Não especificado';
      modalityCounts[modality] = (modalityCounts[modality] || 0) + vagas;
    }

    const byModality: ModalityBreakdown[] = Object.entries(modalityCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    console.log('Total vagas ociosas:', totalVagasOciosas);

    // 5. Build conversion insight
    const interestedInSisu = prefCounts['sisu'] || 0;
    const interestedInProuni = prefCounts['prouni'] || 0;
    const savedSisu = typeCountMap['sisu']?.users.size || 0;
    const savedProuni = typeCountMap['prouni']?.users.size || 0;

    const result: OpportunityTypesData = {
      savedOpportunities: {
        byType: savedByType,
        withVagasOciosas: favoritesWithVagasOciosas,
        total: totalFavorites,
      },
      programPreferences,
      vagasOciosas: {
        total: totalVagasOciosas,
        byModality,
      },
      conversionInsight: {
        interestedInSisu,
        savedSisu,
        interestedInProuni,
        savedProuni,
      },
    };

    console.log('Returning user behavior data:', JSON.stringify(result, null, 2));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in analytics-opportunities:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
