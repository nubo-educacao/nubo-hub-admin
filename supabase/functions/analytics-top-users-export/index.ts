import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface UserExportData {
  nome: string;
  telefone: string;
  cidade_residencia: string;
  local_interesse: string;
  mensagens: number;
  etapa_funil: string;
  curso_interesse: string;
  favoritos: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting top users export for Match Realizado...");

    // Step 1: Get all users who have workflow_data (Match Realizado)
    const matchRealizadoUsers = new Set<string>();
    let prefOffset = 0;
    const prefBatchSize = 1000;

    while (true) {
      const { data: prefs, error: prefsError } = await supabase
        .from("user_preferences")
        .select("user_id, workflow_data, location_preference")
        .not("workflow_data", "is", null)
        .range(prefOffset, prefOffset + prefBatchSize - 1);

      if (prefsError) {
        console.error("Error fetching preferences:", prefsError);
        break;
      }

      if (!prefs || prefs.length === 0) break;

      for (const pref of prefs) {
        // Check if workflow_data is not empty
        if (
          pref.workflow_data &&
          typeof pref.workflow_data === "object" &&
          Object.keys(pref.workflow_data).length > 0
        ) {
          matchRealizadoUsers.add(pref.user_id);
        }
      }

      if (prefs.length < prefBatchSize) break;
      prefOffset += prefBatchSize;
    }

    console.log(`Found ${matchRealizadoUsers.size} users with Match Realizado`);

    if (matchRealizadoUsers.size === 0) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Get message counts for all users (last 30 days for broader range)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const messageCounts = new Map<string, number>();
    let msgOffset = 0;
    const msgBatchSize = 1000;

    while (true) {
      const { data: messages, error: msgError } = await supabase
        .from("chat_messages")
        .select("user_id")
        .eq("sender", "user")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .range(msgOffset, msgOffset + msgBatchSize - 1);

      if (msgError) {
        console.error("Error fetching messages:", msgError);
        break;
      }

      if (!messages || messages.length === 0) break;

      for (const msg of messages) {
        if (msg.user_id) {
          messageCounts.set(msg.user_id, (messageCounts.get(msg.user_id) || 0) + 1);
        }
      }

      if (messages.length < msgBatchSize) break;
      msgOffset += msgBatchSize;
    }

    console.log(`Counted messages for ${messageCounts.size} users`);

    // Step 3: Filter to only Match Realizado users and sort by message count
    const matchRealizadoWithMessages: Array<{ userId: string; count: number }> = [];

    for (const userId of matchRealizadoUsers) {
      const count = messageCounts.get(userId) || 0;
      if (count > 0) {
        matchRealizadoWithMessages.push({ userId, count });
      }
    }

    // Sort by message count descending and take top 100
    matchRealizadoWithMessages.sort((a, b) => b.count - a.count);
    const top100 = matchRealizadoWithMessages.slice(0, 100);

    console.log(`Top 100 Match Realizado users selected`);

    if (top100.length === 0) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = top100.map((u) => u.userId);

    // Step 4: Fetch user profiles
    const profilesMap = new Map<string, { full_name: string; city: string }>();
    
    for (let i = 0; i < userIds.length; i += 50) {
      const batch = userIds.slice(i, i + 50);
      const { data: profiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select("id, full_name, city")
        .in("id", batch);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        continue;
      }

      if (profiles) {
        for (const profile of profiles) {
          profilesMap.set(profile.id, {
            full_name: profile.full_name || "Anônimo",
            city: profile.city || "",
          });
        }
      }
    }

    // Step 5: Fetch user preferences for location_preference and course_interest
    const preferencesMap = new Map<string, { location: string; courses: string[] }>();
    
    for (let i = 0; i < userIds.length; i += 50) {
      const batch = userIds.slice(i, i + 50);
      const { data: preferences, error: prefsError } = await supabase
        .from("user_preferences")
        .select("user_id, location_preference, course_interest")
        .in("user_id", batch);

      if (prefsError) {
        console.error("Error fetching preferences:", prefsError);
        continue;
      }

      if (preferences) {
        for (const pref of preferences) {
          preferencesMap.set(pref.user_id, {
            location: pref.location_preference || "",
            courses: pref.course_interest || [],
          });
        }
      }
    }

    // Step 6: Fetch phone numbers from auth.users (requires service role)
    const phonesMap = new Map<string, string>();
    
    // Fetch all auth users with pagination to get phones
    let page = 1;
    const perPage = 1000;
    
    while (true) {
      const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
        page,
        perPage,
      });

      if (authError) {
        console.error("Error fetching auth users:", authError);
        break;
      }

      if (authData?.users) {
        for (const user of authData.users) {
          if (userIds.includes(user.id) && user.phone) {
            phonesMap.set(user.id, user.phone);
          }
        }
      }

      // Check if there are more pages
      if (!authData?.users || authData.users.length < perPage) {
        break;
      }
      page++;
    }

    console.log(`Fetched ${phonesMap.size} phone numbers`);

    // Step 7: Fetch favorites count for each user
    const favoritesMap = new Map<string, number>();
    
    for (let i = 0; i < userIds.length; i += 50) {
      const batch = userIds.slice(i, i + 50);
      const { data: favorites, error: favsError } = await supabase
        .from("user_favorites")
        .select("user_id")
        .in("user_id", batch);

      if (favsError) {
        console.error("Error fetching favorites:", favsError);
        continue;
      }

      if (favorites) {
        for (const fav of favorites) {
          favoritesMap.set(fav.user_id, (favoritesMap.get(fav.user_id) || 0) + 1);
        }
      }
    }

    console.log(`Fetched favorites for ${favoritesMap.size} users`);

    // Step 8: Determine funnel stage for each user
    // Funnel stages: Cadastrados → Ativação → Onboarding → Preferências → Match Iniciado → Match Realizado → Favoritos
    const funnelStageMap = new Map<string, string>();

    // Check for onboarding_workflow activity
    const onboardingUsers = new Set<string>();
    let onboardingOffset = 0;
    
    while (true) {
      const { data: onboardingMsgs, error: onboardingError } = await supabase
        .from("chat_messages")
        .select("user_id")
        .eq("workflow", "onboarding_workflow")
        .in("user_id", userIds)
        .range(onboardingOffset, onboardingOffset + 999);

      if (onboardingError) {
        console.error("Error fetching onboarding messages:", onboardingError);
        break;
      }

      if (!onboardingMsgs || onboardingMsgs.length === 0) break;

      for (const msg of onboardingMsgs) {
        if (msg.user_id) onboardingUsers.add(msg.user_id);
      }

      if (onboardingMsgs.length < 1000) break;
      onboardingOffset += 1000;
    }

    // Check for match_workflow activity (Match Iniciado)
    const matchIniciadoUsers = new Set<string>();
    let matchOffset = 0;
    
    while (true) {
      const { data: matchMsgs, error: matchError } = await supabase
        .from("chat_messages")
        .select("user_id")
        .eq("workflow", "match_workflow")
        .in("user_id", userIds)
        .range(matchOffset, matchOffset + 999);

      if (matchError) {
        console.error("Error fetching match messages:", matchError);
        break;
      }

      if (!matchMsgs || matchMsgs.length === 0) break;

      for (const msg of matchMsgs) {
        if (msg.user_id) matchIniciadoUsers.add(msg.user_id);
      }

      if (matchMsgs.length < 1000) break;
      matchOffset += 1000;
    }

    // Determine funnel stage for each user (all users here have Match Realizado)
    for (const userId of userIds) {
      const hasFavorites = (favoritesMap.get(userId) || 0) > 0;
      
      // Since all users in this export have Match Realizado, determine highest stage
      if (hasFavorites) {
        funnelStageMap.set(userId, "Favoritos");
      } else {
        funnelStageMap.set(userId, "Match Realizado");
      }
    }

    // Step 9: Build export data
    const exportData: UserExportData[] = top100.map((item) => {
      const profile = profilesMap.get(item.userId);
      const phone = phonesMap.get(item.userId) || "";
      const prefs = preferencesMap.get(item.userId);
      const locationPref = prefs?.location || "";
      const courseInterest = prefs?.courses?.join(", ") || "";
      const favoritesCount = favoritesMap.get(item.userId) || 0;
      const funnelStage = funnelStageMap.get(item.userId) || "Match Realizado";

      // Format phone number
      let formattedPhone = phone;
      if (phone && phone.startsWith("+55")) {
        const digits = phone.replace(/\D/g, "").slice(2); // Remove +55
        if (digits.length === 11) {
          formattedPhone = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
        } else if (digits.length === 10) {
          formattedPhone = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
        }
      }

      return {
        nome: profile?.full_name || "Anônimo",
        telefone: formattedPhone,
        cidade_residencia: profile?.city || "",
        local_interesse: locationPref,
        mensagens: item.count,
        etapa_funil: funnelStage,
        curso_interesse: courseInterest,
        favoritos: favoritesCount,
      };
    });

    console.log(`Export data ready with ${exportData.length} users`);

    return new Response(JSON.stringify(exportData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in analytics-top-users-export:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
