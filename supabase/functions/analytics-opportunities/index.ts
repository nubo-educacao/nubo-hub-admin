import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  programPreferences: ProgramPreference[];
  vagasOciosas: {
    total: number;
    byModality: ModalityBreakdown[];
  };
  totalOpportunities: {
    sisu: number;
    prouni: number;
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

    console.log('Fetching opportunity types data...');

    // 1. Fetch program preferences from user_preferences
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
        name: name === 'sisu' ? 'SISU' : name === 'prouni' ? 'ProUni' : name === 'both' ? 'Ambos' : name,
        count,
        percentage: totalPrefs > 0 ? Math.round((count / totalPrefs) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    console.log('Program preferences:', programPreferences);

    // 2. Fetch vagas ociosas data from opportunitiessisuvacancies
    const { data: vagasData, error: vagasError } = await supabase
      .from('opportunitiessisuvacancies')
      .select('vagas_ociosas_2025, ds_mod_concorrencia')
      .not('vagas_ociosas_2025', 'is', null)
      .gt('vagas_ociosas_2025', 0);

    if (vagasError) {
      console.error('Error fetching vagas ociosas:', vagasError);
      throw vagasError;
    }

    // Sum total vagas ociosas and group by modality
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
      .slice(0, 6); // Top 6 modalities

    console.log('Total vagas ociosas:', totalVagasOciosas);
    console.log('By modality:', byModality);

    // 3. Count total opportunities by type
    const { count: sisuCount, error: sisuError } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('opportunity_type', 'sisu');

    const { count: prouniCount, error: prouniError } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('opportunity_type', 'prouni');

    if (sisuError) console.error('Error counting SISU:', sisuError);
    if (prouniError) console.error('Error counting ProUni:', prouniError);

    const result: OpportunityTypesData = {
      programPreferences,
      vagasOciosas: {
        total: totalVagasOciosas,
        byModality,
      },
      totalOpportunities: {
        sisu: sisuCount || 0,
        prouni: prouniCount || 0,
      },
    };

    console.log('Returning opportunity types data:', result);

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
