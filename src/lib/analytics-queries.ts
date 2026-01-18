import { supabase } from "@/integrations/supabase/client";
import { subDays, format, startOfDay, endOfDay } from "date-fns";

export interface DateRange {
  from: Date;
  to: Date;
}

export interface DashboardStats {
  activeUsers: number;
  totalMessages: number;
  favoritesSaved: number;
  errorsToday: number;
  activeUsersChange: number;
  messagesChange: number;
  favoritesChange: number;
  errorsChange: number;
}

export interface ActivityData {
  name: string;
  mensagens: number;
  usuarios: number;
  date: string;
}

export interface CourseInterest {
  name: string;
  buscas: number;
}

export interface FunnelStep {
  label: string;
  value: number;
  color: string;
}

export interface UserPreference {
  name: string;
  value: number;
  color: string;
}

export interface ErrorLog {
  id: string;
  type: "error" | "warning" | "info";
  message: string;
  endpoint?: string;
  timestamp: string;
  count?: number;
  error_type: string;
  resolved: boolean;
  created_at: string;
}

export interface TopUser {
  user_id: string;
  full_name: string | null;
  message_count: number;
  favorites_count: number;
  score: number;
}

export interface LocationData {
  city: string;
  state: string;
  count: number;
}

// Fetch dashboard stats
export async function fetchDashboardStats(dateRange?: DateRange): Promise<DashboardStats> {
  const today = new Date();
  const yesterday = subDays(today, 1);
  const weekAgo = subDays(today, 7);
  const twoWeeksAgo = subDays(today, 14);

  // Active users in last 7 days
  const { count: activeUsers } = await supabase
    .from("chat_messages")
    .select("user_id", { count: "exact", head: true })
    .gte("created_at", weekAgo.toISOString());

  // Active users in previous week (for comparison)
  const { count: prevActiveUsers } = await supabase
    .from("chat_messages")
    .select("user_id", { count: "exact", head: true })
    .gte("created_at", twoWeeksAgo.toISOString())
    .lt("created_at", weekAgo.toISOString());

  // Total messages
  const { count: totalMessages } = await supabase
    .from("chat_messages")
    .select("*", { count: "exact", head: true });

  // Messages in last 7 days
  const { count: recentMessages } = await supabase
    .from("chat_messages")
    .select("*", { count: "exact", head: true })
    .gte("created_at", weekAgo.toISOString());

  // Messages in previous week
  const { count: prevMessages } = await supabase
    .from("chat_messages")
    .select("*", { count: "exact", head: true })
    .gte("created_at", twoWeeksAgo.toISOString())
    .lt("created_at", weekAgo.toISOString());

  // Total favorites
  const { count: favoritesSaved } = await supabase
    .from("user_favorites")
    .select("*", { count: "exact", head: true });

  // Recent favorites
  const { count: recentFavorites } = await supabase
    .from("user_favorites")
    .select("*", { count: "exact", head: true })
    .gte("created_at", weekAgo.toISOString());

  // Previous favorites
  const { count: prevFavorites } = await supabase
    .from("user_favorites")
    .select("*", { count: "exact", head: true })
    .gte("created_at", twoWeeksAgo.toISOString())
    .lt("created_at", weekAgo.toISOString());

  // Errors today
  const { count: errorsToday } = await supabase
    .from("agent_errors")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startOfDay(today).toISOString())
    .eq("resolved", false);

  // Errors yesterday
  const { count: errorsYesterday } = await supabase
    .from("agent_errors")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startOfDay(yesterday).toISOString())
    .lt("created_at", endOfDay(yesterday).toISOString())
    .eq("resolved", false);

  const calcChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  return {
    activeUsers: activeUsers || 0,
    totalMessages: totalMessages || 0,
    favoritesSaved: favoritesSaved || 0,
    errorsToday: errorsToday || 0,
    activeUsersChange: calcChange(activeUsers || 0, prevActiveUsers || 0),
    messagesChange: calcChange(recentMessages || 0, prevMessages || 0),
    favoritesChange: calcChange(recentFavorites || 0, prevFavorites || 0),
    errorsChange: -calcChange(errorsToday || 0, errorsYesterday || 0),
  };
}

// Fetch weekly activity data
export async function fetchActivityData(): Promise<ActivityData[]> {
  const days = [];
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  for (let i = 6; i >= 0; i--) {
    const date = subDays(new Date(), i);
    const startDate = startOfDay(date).toISOString();
    const endDate = endOfDay(date).toISOString();

    const { count: messages } = await supabase
      .from("chat_messages")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    const { data: users } = await supabase
      .from("chat_messages")
      .select("user_id")
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    const uniqueUsers = new Set(users?.map(u => u.user_id)).size;

    days.push({
      name: dayNames[date.getDay()],
      mensagens: messages || 0,
      usuarios: uniqueUsers,
      date: format(date, "yyyy-MM-dd"),
    });
  }

  return days;
}

// Fetch top courses from user preferences
export async function fetchTopCourses(): Promise<CourseInterest[]> {
  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("course_interest");

  const courseCounts: Record<string, number> = {};

  preferences?.forEach((pref) => {
    if (pref.course_interest && Array.isArray(pref.course_interest)) {
      pref.course_interest.forEach((course: string) => {
        courseCounts[course] = (courseCounts[course] || 0) + 1;
      });
    }
  });

  const sorted = Object.entries(courseCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([name, buscas]) => ({ name, buscas }));

  // If no data, return placeholder
  if (sorted.length === 0) {
    return [
      { name: "Sem dados", buscas: 0 }
    ];
  }

  return sorted;
}

// Fetch funnel data
export async function fetchFunnelData(): Promise<FunnelStep[]> {
  // Total registered users
  const { count: totalUsers } = await supabase
    .from("user_profiles")
    .select("*", { count: "exact", head: true });

  // Completed onboarding
  const { count: completedOnboarding } = await supabase
    .from("user_profiles")
    .select("*", { count: "exact", head: true })
    .eq("onboarding_completed", true);

  // Users with preferences defined (has enem_score)
  const { count: definedPreferences } = await supabase
    .from("user_preferences")
    .select("*", { count: "exact", head: true })
    .not("enem_score", "is", null);

  // Users who started match workflow
  const { data: matchUsers } = await supabase
    .from("chat_messages")
    .select("user_id")
    .eq("workflow", "match_workflow");
  const uniqueMatchUsers = new Set(matchUsers?.map(u => u.user_id)).size;

  // Users who favorited something
  const { data: favUsers } = await supabase
    .from("user_favorites")
    .select("user_id");
  const uniqueFavUsers = new Set(favUsers?.map(u => u.user_id)).size;

  // Users in specific workflows (SISU/ProUni)
  const { data: sisuProuniUsers } = await supabase
    .from("chat_messages")
    .select("user_id")
    .in("workflow", ["sisu_workflow", "prouni_workflow"]);
  const uniqueSisuProuniUsers = new Set(sisuProuniUsers?.map(u => u.user_id)).size;

  return [
    { label: "Cadastrados", value: totalUsers || 0, color: "bg-primary" },
    { label: "Onboarding completo", value: completedOnboarding || 0, color: "bg-chart-2" },
    { label: "Preferências definidas", value: definedPreferences || 0, color: "bg-chart-3" },
    { label: "Iniciaram matching", value: uniqueMatchUsers, color: "bg-chart-4" },
    { label: "Favoritaram", value: uniqueFavUsers, color: "bg-chart-5" },
    { label: "SISU/ProUni flow", value: uniqueSisuProuniUsers, color: "bg-success" },
  ];
}

// Fetch user preferences distribution
export async function fetchUserPreferences(): Promise<UserPreference[]> {
  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("program_preference");

  const counts: Record<string, number> = {};

  preferences?.forEach((pref) => {
    const program = pref.program_preference || "Não definido";
    counts[program] = (counts[program] || 0) + 1;
  });

  const colors = [
    "hsl(199, 89%, 48%)",
    "hsl(142, 71%, 45%)",
    "hsl(38, 92%, 50%)",
    "hsl(280, 87%, 65%)",
    "hsl(217, 91%, 60%)",
  ];

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, value], index) => ({
      name: name === "sisu" ? "SISU" : name === "prouni" ? "ProUni" : name === "fies" ? "FIES" : name,
      value: total > 0 ? Math.round((value / total) * 100) : 0,
      color: colors[index % colors.length],
    }));
}

// Fetch error logs
export async function fetchErrorLogs(): Promise<ErrorLog[]> {
  const { data: errors } = await supabase
    .from("agent_errors")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  if (!errors || errors.length === 0) {
    return [];
  }

  return errors.map((error) => {
    const createdAt = new Date(error.created_at || "");
    const now = new Date();
    const diffMs = now.getTime() - createdAt.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    let timestamp = "";
    if (diffMins < 60) {
      timestamp = `${diffMins} min atrás`;
    } else if (diffHours < 24) {
      timestamp = `${diffHours}h atrás`;
    } else {
      timestamp = format(createdAt, "dd/MM HH:mm");
    }

    let type: "error" | "warning" | "info" = "error";
    if (error.resolved) {
      type = "info";
    } else if (error.recovery_attempted) {
      type = "warning";
    }

    return {
      id: error.id,
      type,
      message: error.error_message || error.error_type,
      endpoint: error.trace_id ? `/trace/${error.trace_id}` : undefined,
      timestamp,
      error_type: error.error_type,
      resolved: error.resolved || false,
      created_at: error.created_at || "",
    };
  });
}

// Fetch top engaged users
export async function fetchTopUsers(): Promise<TopUser[]> {
  // Get message counts per user
  const { data: messageCounts } = await supabase
    .from("chat_messages")
    .select("user_id");

  const userMessageCounts: Record<string, number> = {};
  messageCounts?.forEach((m) => {
    if (m.user_id) {
      userMessageCounts[m.user_id] = (userMessageCounts[m.user_id] || 0) + 1;
    }
  });

  // Get favorites counts per user
  const { data: favoriteCounts } = await supabase
    .from("user_favorites")
    .select("user_id");

  const userFavoriteCounts: Record<string, number> = {};
  favoriteCounts?.forEach((f) => {
    if (f.user_id) {
      userFavoriteCounts[f.user_id] = (userFavoriteCounts[f.user_id] || 0) + 1;
    }
  });

  // Get user profiles
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, full_name");

  const profileMap: Record<string, string | null> = {};
  profiles?.forEach((p) => {
    profileMap[p.id] = p.full_name;
  });

  // Combine all users
  const allUsers = new Set([
    ...Object.keys(userMessageCounts),
    ...Object.keys(userFavoriteCounts),
  ]);

  const users: TopUser[] = Array.from(allUsers).map((userId) => {
    const messageCount = userMessageCounts[userId] || 0;
    const favoritesCount = userFavoriteCounts[userId] || 0;
    const score = messageCount * 2 + favoritesCount * 5;

    return {
      user_id: userId,
      full_name: profileMap[userId] || null,
      message_count: messageCount,
      favorites_count: favoritesCount,
      score,
    };
  });

  return users.sort((a, b) => b.score - a.score).slice(0, 10);
}

// Fetch location data
export async function fetchLocationData(): Promise<LocationData[]> {
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("city");

  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("state_preference");

  const locationCounts: Record<string, number> = {};

  profiles?.forEach((p) => {
    if (p.city) {
      locationCounts[p.city] = (locationCounts[p.city] || 0) + 1;
    }
  });

  const stateCounts: Record<string, number> = {};
  preferences?.forEach((p) => {
    if (p.state_preference) {
      stateCounts[p.state_preference] = (stateCounts[p.state_preference] || 0) + 1;
    }
  });

  // Combine city and state data
  const combined: LocationData[] = [];

  Object.entries(locationCounts).forEach(([city, count]) => {
    combined.push({ city, state: "", count });
  });

  Object.entries(stateCounts).forEach(([state, count]) => {
    combined.push({ city: "", state, count });
  });

  return combined.sort((a, b) => b.count - a.count).slice(0, 10);
}
