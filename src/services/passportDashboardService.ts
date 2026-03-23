import { supabase } from "@/integrations/supabase/client";

export interface AdminFunnelChartData {
  step_name: string;
  step_order: number;
  user_count: number;
}

export interface AdminPassportPhasesData {
  passport_phase: string;
  total_users: number;
}

export interface AdminFurthestPassportPhasesData {
  furthest_passport_phase: string;
  total_users: number;
}

export interface PartnerFunnelData {
  partner_id: string;
  partner_name: string;
  total_unique_clicks: number;
  total_applications_started: number;
  total_applications_submitted: number;
}

export interface PartnerApplicationBucketsData {
  partner_id: string;
  completion_bucket: string;
  applications_count: number;
}

export async function getAdminFunnelChart(): Promise<AdminFunnelChartData[]> {
  const { data, error } = await (supabase as any)
    .from('vw_admin_funnel_chart')
    .select('*')
    .order('step_order', { ascending: true });
  if (error) throw error;
  return data as AdminFunnelChartData[];
}

export async function getAdminPassportPhases(): Promise<AdminPassportPhasesData[]> {
  const { data, error } = await (supabase as any)
    .from('vw_admin_passport_phases')
    .select('*')
    .order('total_users', { ascending: false });
  if (error) throw error;
  return data as AdminPassportPhasesData[];
}

export async function getAdminFurthestPassportPhases(): Promise<AdminFurthestPassportPhasesData[]> {
  const { data, error } = await (supabase as any)
    .from('vw_admin_furthest_passport_phases')
    .select('*')
    .order('total_users', { ascending: false });
  if (error) throw error;
  return data as AdminFurthestPassportPhasesData[];
}

export async function getPartnerFunnel(): Promise<PartnerFunnelData[]> {
  const { data, error } = await (supabase as any)
    .from('vw_partner_funnel')
    .select('*')
    .order('total_applications_submitted', { ascending: false });
  if (error) throw error;
  return data as PartnerFunnelData[];
}

export async function getPartnerApplicationBuckets(partnerId?: string): Promise<PartnerApplicationBucketsData[]> {
  let query = (supabase as any)
    .from('vw_partner_application_completion_buckets')
    .select('*')
    .order('completion_bucket', { ascending: true });
    
  if (partnerId) {
    query = query.eq('partner_id', partnerId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as PartnerApplicationBucketsData[];
}

export interface ApplicationsOverTimeData {
  date: string;
  label: string;
  count: number;
}

export async function getStudentApplicationsOverTime(): Promise<ApplicationsOverTimeData[]> {
  const { data, error } = await supabase
    .from('student_applications')
    .select('created_at');

  if (error) throw error;
  
  const grouped = (data || []).reduce((acc: Record<string, number>, curr: any) => {
    if (!curr.created_at) return acc;
    const d = new Date(curr.created_at);
    // Use local timezone formatting (pt-BR) or ISO to avoid timezone shifts
    // Using ISO to group safely by Day
    const isoDate = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    acc[isoDate] = (acc[isoDate] || 0) + 1;
    return acc;
  }, {});

  const sorted = Object.keys(grouped).sort().map(dateStr => {
    const [y, m, d] = dateStr.split('-');
    return {
      date: dateStr,
      label: `${d}/${m}`,
      count: grouped[dateStr]
    };
  });

  return sorted;
}
