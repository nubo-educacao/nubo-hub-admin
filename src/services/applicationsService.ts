import { supabase } from "@/integrations/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApplicationWithDetails {
    id: string;
    user_id: string;
    partner_id: string;
    partner_name: string | null;
    full_name: string | null;
    phone: string | null;
    status: "started" | "eligible" | "ineligible" | "submitted";
    answers: Record<string, unknown>;
    created_at: string;
}

export interface PartnerOption {
    id: string;
    name: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Fetches student applications enriched with user profile, phone, and partner name.
 * Pass partnerId to filter by a specific partner, or omit for all applications.
 */
export async function getApplicationsWithDetails(
    partnerId?: string
): Promise<ApplicationWithDetails[]> {
    const params: Record<string, unknown> = {};
    if (partnerId) {
        params.p_partner_id = partnerId;
    }

    const { data, error } = await (supabase.rpc as any)(
        "get_student_applications_with_details",
        params
    );

    if (error) {
        console.error("Error fetching applications:", error);
        throw error;
    }

    return (data ?? []) as ApplicationWithDetails[];
}

/**
 * Fetches the list of partners for the filter dropdown.
 */
export async function getPartnersList(): Promise<PartnerOption[]> {
    const { data, error } = await supabase
        .from("partners")
        .select("id, name")
        .order("name", { ascending: true });

    if (error) {
        console.error("Error fetching partners list:", error);
        throw error;
    }

    return (data ?? []) as PartnerOption[];
}
