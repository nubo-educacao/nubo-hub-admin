
import { supabase } from "@/integrations/supabase/client";

export interface StudentProfile {
    id: string;
    full_name: string | null;
    age: number | null;
    city: string | null;
    education: string | null;
    state: string | null;
    is_nubo_student: boolean;
    created_at: string;
    whatsapp?: string | null;
}

export interface UserPreference {
    id: string;
    user_id: string;
    course_interest: string[] | null;
    enem_score: number | null;
    preferred_shifts: string[] | null;
    university_preference: string | null;
    program_preference: string | null;
    family_income_per_capita: number | null;
    quota_types: string[] | null;
    location_preference: string | null;
    state_preference: string | null;
}

export interface UserEnemScore {
    id: string;
    user_id: string;
    year: number;
    nota_linguagens: number | null;
    nota_ciencias_humanas: number | null;
    nota_ciencias_natureza: number | null;
    nota_matematica: number | null;
    nota_redacao: number | null;
}

export interface UserFavorite {
    id: string;
    user_id: string;
    course_id: string | null;
    partner_id: string | null;
    created_at: string;
    // We might want to fetch related course/partner names, but for now raw IDs or simple join if possible
    courses?: { name: string } | null;
    partners?: { name: string } | null;
}

export interface StudentDetails {
    profile: StudentProfile | null;
    preferences: UserPreference | null;
    enem_scores: UserEnemScore[];
    favorites: UserFavorite[];
}

export interface StudentFilters {
    fullName?: string;
    city?: string;
    education?: string;
    isNuboStudent?: boolean | null;
    incomeMin?: number;
    incomeMax?: number;
    quotaTypes?: string[];
    state?: string;
    ageMin?: number;
    ageMax?: number;
}

export const getStudents = async (
    page: number = 0,
    pageSize: number = 20,
    filters?: StudentFilters,
    sortBy: string = 'created_at',
    sortOrder: string = 'desc'
): Promise<{ data: StudentProfile[], count: number }> => {
    const paramFilters = {
        p_page: page,
        p_page_size: pageSize,
        p_filter_name: filters?.fullName || null,
        p_filter_city: filters?.city || null,
        p_filter_education: filters?.education || null,
        p_filter_is_nubo_student: filters?.isNuboStudent ?? null,
        p_filter_income_min: filters?.incomeMin || null,
        p_filter_income_max: filters?.incomeMax || null,
        p_filter_quota_types: (filters?.quotaTypes && filters.quotaTypes.length > 0) ? filters.quotaTypes : null,
        p_sort_by: sortBy,
        p_sort_order: sortOrder,
        p_filter_state: filters?.state || null,
        p_filter_age_min: filters?.ageMin || null,
        p_filter_age_max: filters?.ageMax || null
    };

    const { data, error } = await supabase.rpc('get_students_paginated' as any, paramFilters);

    if (error) {
        throw error;
    }

    // The RPC returns a JSON object { data: [...], count: number }
    // Supabase RPC returns the scalar result directly if it's a single JSON
    const result = data as any;

    return {
        data: (result?.data || []) as StudentProfile[],
        count: result?.count || 0
    };
};

export const getStudentDetails = async (userId: string): Promise<StudentDetails> => {
    const { data, error } = await supabase.rpc('get_student_details_v2', { p_student_id: userId });

    if (error) {
        console.error("Error fetching student details via RPC:", error);
        throw error;
    }

    return data as StudentDetails;
};

export interface StudentStats {
    total_students: number;
    total_cities: number;
    total_states: number;
    average_age: number;
}

export const getStudentStats = async (filters?: StudentFilters): Promise<StudentStats> => {
    const { data, error } = await supabase
        .rpc('get_student_stats' as any, {
            filter_full_name: filters?.fullName || null,
            filter_city: filters?.city || null,
            filter_education: filters?.education || null,
            filter_is_nubo_student: filters?.isNuboStudent ?? null,
            filter_income_min: filters?.incomeMin || null,
            filter_income_max: filters?.incomeMax || null,
            filter_quota_types: (filters?.quotaTypes && filters.quotaTypes.length > 0) ? filters.quotaTypes : null,
            filter_state: filters?.state || null,
            filter_age_min: filters?.ageMin || null,
            filter_age_max: filters?.ageMax || null
        });

    if (error) throw error;
    return data as any as StudentStats;
};

export const importNuboStudents = async (students: any[]): Promise<{ imported_whitelist_entries: number, updated_existing_profiles: number }> => {
    const { data, error } = await supabase
        .rpc('import_nubo_students' as any, { students });

    if (error) throw error;
    return data as any;
};
