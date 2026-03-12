import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    getMyPartnerId,
    getPartnerFormFields,
    getPartnerDetails,
    type PartnerFormField,
} from "@/services/partnerPortalService";
import {
    getApplicationsWithDetails,
    getEligibleCountForPartner,
    type ApplicationWithDetails,
} from "@/services/applicationsService";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Download,
    Users,
    CheckCircle2,
    XCircle,
    FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import ApplicationsTable, { STATUS_CONFIG } from "@/components/applications/ApplicationsTable";
import ApplicationAnswersModal from "@/components/applications/ApplicationAnswersModal";

// ─── Excel Export ────────────────────────────────────────────────────────────

function exportToExcel(
    applications: ApplicationWithDetails[],
    formFields: PartnerFormField[],
    partnerName: string
) {
    const fixedHeaders = ["Nome", "Whatsapp", "Status", "Elegibilidade", "Data"];
    
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
    link.download = `inscricoes_${partnerName.replace(/\s+/g, "_").toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Arquivo exportado com sucesso!");
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PartnerDashboard() {
    const [selectedApp, setSelectedApp] = useState<ApplicationWithDetails | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    // 1. Resolve the partner_id for this user
    const { data: partnerId, isLoading: loadingPartnerId } = useQuery({
        queryKey: ["myPartnerId"],
        queryFn: getMyPartnerId,
    });

    // 2. Fetch partner details
    const { data: partner } = useQuery({
        queryKey: ["partnerDetails", partnerId],
        queryFn: () => getPartnerDetails(partnerId!),
        enabled: !!partnerId,
    });

    // 3. Fetch form field definitions
    const { data: formFields = [] } = useQuery({
        queryKey: ["partnerFormFields", partnerId],
        queryFn: () => getPartnerFormFields(partnerId!),
        enabled: !!partnerId,
    });

    // 4. Fetch applications via new RPC
    const { data: applications = [], isLoading: loadingApps } = useQuery({
        queryKey: ["applicationsWithDetails", partnerId],
        queryFn: () => getApplicationsWithDetails(partnerId!),
        enabled: !!partnerId,
    });

    // 5. Fetch eligible count for this partner
    const { data: eligibleCount = 0 } = useQuery({
        queryKey: ["eligibleCount", partnerId],
        queryFn: () => getEligibleCountForPartner(partnerId!),
        enabled: !!partnerId,
    });

    // ─── Stats ───────────────────────────────────────────────────────────────

    const stats = useMemo(() => {
        const total = applications.length;
        const eligible = eligibleCount;
        const submitted = applications.filter((a) => a.status === "SUBMITTED").length;
        return { total, eligible, submitted };
    }, [applications, eligibleCount]);

    // ─── Handlers ────────────────────────────────────────────────────────────

    const handleViewAnswers = (app: ApplicationWithDetails) => {
        setSelectedApp(app);
        setModalOpen(true);
    };

    // ─── Loading & Error States ──────────────────────────────────────────────

    if (loadingPartnerId || loadingApps) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    if (!partnerId) {
        return (
            <div className="flex h-full items-center justify-center">
                <Card className="max-w-md">
                    <CardContent className="pt-6 text-center">
                        <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                        <p className="font-medium">Acesso não autorizado</p>
                        <p className="text-sm text-muted-foreground mt-2">
                            Sua conta não está vinculada a nenhum parceiro. Contate o administrador.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{partner?.name || "Portal do Parceiro"}</h1>
                    <p className="text-muted-foreground">
                        Gerencie as candidaturas dos estudantes
                    </p>
                </div>
                <Button
                    onClick={() => exportToExcel(applications, formFields, partner?.name || "parceiro")}
                    disabled={applications.length === 0}
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
                        isLoading={loadingApps}
                        onViewAnswers={handleViewAnswers}
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
