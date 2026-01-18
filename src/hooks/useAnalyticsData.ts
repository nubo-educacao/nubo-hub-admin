import { useQuery } from "@tanstack/react-query";
import {
  fetchDashboardStats,
  fetchActivityData,
  fetchTopCourses,
  fetchFunnelData,
  fetchUserPreferences,
  fetchErrorLogs,
  fetchTopUsers,
  fetchLocationData,
  type DateRange,
} from "@/lib/analytics-queries";

export function useDashboardStats(dateRange?: DateRange) {
  return useQuery({
    queryKey: ["dashboard-stats", dateRange],
    queryFn: () => fetchDashboardStats(dateRange),
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 60 * 5, // Refresh every 5 minutes
  });
}

export function useActivityData() {
  return useQuery({
    queryKey: ["activity-data"],
    queryFn: fetchActivityData,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useTopCourses() {
  return useQuery({
    queryKey: ["top-courses"],
    queryFn: fetchTopCourses,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}

export function useFunnelData() {
  return useQuery({
    queryKey: ["funnel-data"],
    queryFn: fetchFunnelData,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useUserPreferences() {
  return useQuery({
    queryKey: ["user-preferences"],
    queryFn: fetchUserPreferences,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}

export function useErrorLogs() {
  return useQuery({
    queryKey: ["error-logs"],
    queryFn: fetchErrorLogs,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 60 * 2, // Refresh every 2 minutes
  });
}

export function useTopUsers() {
  return useQuery({
    queryKey: ["top-users"],
    queryFn: fetchTopUsers,
    staleTime: 1000 * 60 * 15, // 15 minutes
  });
}

export function useLocationData() {
  return useQuery({
    queryKey: ["location-data"],
    queryFn: fetchLocationData,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}
