import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    getApplicationsWithDetails,
    getPartnersList,
    getEligibleCountForPartner,
    getPartnerFormCounts,
    type ApplicationWithDetails,
} from "@/services/applicationsService";
import { getPartnerFormFields, type PartnerFormField } from "@/services/partnerPortalService";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Download,
    Users,
    CheckCircle2,
    FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import ApplicationsTable, { STATUS_CONFIG } from "@/components/applications/ApplicationsTable";
import ApplicationAnswersModal from "@/components/applications/ApplicationAnswersModal";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";

// ─── Excel Export ────────────────────────────────────────────────────────────

function exportToExcel(
    applications: ApplicationWithDetails[],
    formFields: PartnerFormField[],
    partnerName: string
) {
    const fixedHeaders = ["Nome", "Whatsapp", "Parceiro", "Status", "Elegibilidade", "Data"];
    
    // Identified fields from partner_forms
    const formFieldNames = new Set(formFields.map((f) => f.field_name));
    const dynamicHeaders = formFields.map((f) => f.question_text || f.field_name);
    
    // Collect all other keys present in any application's answers
    const otherKeys = new Set<string>();
    applications.forEach((app) => {
        const ans = (app.answers as Record<string, unknown>) || {};
        Object.keys(ans).forEach((key) => {
            if (!formFieldNames.has(key)) {
                otherKeys.add(key);
            }
        });
    });
    const extraHeaders = Array.from(otherKeys);
    
    const allHeaders = [...fixedHeaders, ...dynamicHeaders, ...extraHeaders];

    const getEligibilityStr = (app: ApplicationWithDetails): string => {
        if (!app.eligibility_results || !Array.isArray(app.eligibility_results)) return "—";
        const res = app.eligibility_results.find((r: any) => r.partner_id === app.partner_id);
        if (!res) return "—";
        const met = Number(res.met_criteria) || 0;
        const total = Number(res.total_criteria) || 0;
        return `${met}/${total}`;
    };

    const rows = applications.map((app) => {
        const fixedCols = [
            app.full_name || "—",
            app.phone || "—",
            app.partner_name || "—",
            STATUS_CONFIG[app.status]?.label || app.status,
            getEligibilityStr(app),
            new Date(app.created_at).toLocaleDateString("pt-BR"),
        ];
        const dynamicCols = formFields.map((f) => {
            const val = (app.answers as Record<string, unknown>)?.[f.field_name];
            return val != null ? String(val) : "—";
        });
        const extraCols = extraHeaders.map((k) => {
            const val = (app.answers as Record<string, unknown>)?.[k];
            return val != null ? String(val) : "—";
        });
        return [...fixedCols, ...dynamicCols, ...extraCols];
    });

    const BOM = "\uFEFF";
    const csvContent =
        BOM +
        [allHeaders.join(";"), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))].join(
            "\n"
        );

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `candidaturas_${partnerName.replace(/\s+/g, "_").toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Arquivo exportado com sucesso!");
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PartnerApplications() {
    const [selectedApp, setSelectedApp] = useState<ApplicationWithDetails | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [partnerFilter, setPartnerFilter] = useState<string>("all");
    const [filteredApps, setFilteredApps] = useState<ApplicationWithDetails[]>([]);

    // 1. Fetch partners list for filter
    const { data: partners = [] } = useQuery({
        queryKey: ["partnersList"],
        queryFn: getPartnersList,
    });

    // 2. Fetch all applications (or filtered by partner)
    const effectivePartnerId = partnerFilter === "all" ? undefined : partnerFilter;

    const { data: applications = [], isLoading } = useQuery({
        queryKey: ["applicationsWithDetails", effectivePartnerId ?? "all"],
        queryFn: () => getApplicationsWithDetails(effectivePartnerId),
    });

    // 3. Fetch form fields for the filtered partner
    const { data: formFields = [] } = useQuery({
        queryKey: ["partnerFormFields", effectivePartnerId],
        queryFn: () => getPartnerFormFields(effectivePartnerId!),
        enabled: !!effectivePartnerId,
    });

    // 4. Fetch eligible count for the filtered partner
    const { data: eligibleCount = 0 } = useQuery({
        queryKey: ["eligibleCount", effectivePartnerId],
        queryFn: () => getEligibleCountForPartner(effectivePartnerId!),
        enabled: !!effectivePartnerId,
    });

    // 5. Fetch form counts for calculating completion on the fly
    const { data: formCounts = {} } = useQuery({
        queryKey: ["partnerFormCountsTable"],
        queryFn: getPartnerFormCounts,
    });

    const completionChartData = useMemo(() => {
        const buckets = {
            "1. Até 25%": 0,
            "2. Até 50%": 0,
            "3. Até 75%": 0,
            "4. Até 100%": 0
        };

        filteredApps.forEach(app => {
            const filled = Object.keys(app.answers || {}).length;
            const totalForms = formCounts[app.partner_id] || 0;
            let percent = 0;
            if (app.status === 'SUBMITTED') {
                percent = 100;
            } else if (totalForms > 0) {
                percent = Math.min(100, Math.round((filled * 100) / totalForms));
            }
            
            if (percent <= 25) buckets["1. Até 25%"]++;
            else if (percent <= 50) buckets["2. Até 50%"]++;
            else if (percent <= 75) buckets["3. Até 75%"]++;
            else buckets["4. Até 100%"]++;
        });

        return Object.keys(buckets).sort().map(bucket => ({
            name: bucket,
            count: buckets[bucket as keyof typeof buckets]
        }));
    }, [filteredApps, formCounts]);

    // ─── Stats ───────────────────────────────────────────────────────────────

    const stats = useMemo(() => {
        const total = filteredApps.length;
        const submitted = filteredApps.filter((a) => a.status === "SUBMITTED").length;
        
        const eligible = filteredApps.filter((app) => {
            if (!app.eligibility_results || !Array.isArray(app.eligibility_results)) return false;
            const res = app.eligibility_results.find((r: any) => r.partner_id === app.partner_id);
            if (!res) return false;
            const met = Number(res.met_criteria) || 0;
            const totalFields = Number(res.total_criteria) || 0;
            return met === totalFields && totalFields > 0;
        }).length;

        return { total, eligible, submitted };
    }, [filteredApps]);

    // ─── Handlers ────────────────────────────────────────────────────────────

    const handleViewAnswers = (app: ApplicationWithDetails) => {
        setSelectedApp(app);
        setModalOpen(true);
    };

    return (
        <div className="container mx-auto space-y-6 p-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Candidaturas</h1>
                    <p className="text-muted-foreground">
                        Visualize todas as candidaturas dos estudantes
                    </p>
                </div>
                <Button
                    onClick={() => exportToExcel(filteredApps, formFields, partners.find(p => p.id === partnerFilter)?.name || "Geral")}
                    disabled={filteredApps.length === 0}
                    className="flex items-center gap-2"
                >
                    <Download className="h-4 w-4" />
                    Exportar Excel
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-6 flex items-center gap-4">
                        <div className="p-3 rounded-full bg-primary/10">
                            <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{stats.total}</p>
                            <p className="text-xs text-muted-foreground">Total de Inscrições</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6 flex items-center gap-4">
                        <div className="p-3 rounded-full bg-green-500/10">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{stats.eligible}</p>
                            <p className="text-xs text-muted-foreground">Elegíveis</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6 flex items-center gap-4">
                        <div className="p-3 rounded-full bg-blue-500/10">
                            <FileSpreadsheet className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{stats.submitted}</p>
                            <p className="text-xs text-muted-foreground">Enviados</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Progression Chart */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Progresso das Candidaturas</CardTitle>
                    <CardDescription>
                        Distribuição do percentual de preenchimento dos formulários {effectivePartnerId ? 'deste parceiro' : 'geral'}.
                    </CardDescription>
                </CardHeader>
                <CardContent className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={completionChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" fontSize={12} />
                            <YAxis fontSize={12} allowDecimals={false} />
                            <RechartsTooltip cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Candidaturas" />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Applications Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Candidaturas</CardTitle>
                    <CardDescription>
                        {applications.length} registros
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ApplicationsTable
                        applications={applications}
                        isLoading={isLoading}
                        onViewAnswers={handleViewAnswers}
                        partners={partners}
                        partnerFilter={partnerFilter}
                        onPartnerFilterChange={setPartnerFilter}
                        onFilteredDataChange={setFilteredApps}
                    />
                </CardContent>
            </Card>

            {/* Answers Modal */}
            <ApplicationAnswersModal
                application={selectedApp}
                formFields={formFields}
                open={modalOpen}
                onOpenChange={setModalOpen}
            />
        </div>
    );
}
