import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    getApplicationsWithDetails,
    getPartnersList,
    type ApplicationWithDetails,
} from "@/services/applicationsService";
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

// ─── Excel Export ────────────────────────────────────────────────────────────

function exportToExcel(applications: ApplicationWithDetails[]) {
    const headers = ["Nome", "Whatsapp", "Parceiro", "Status", "Data"];

    const rows = applications.map((app) => [
        app.full_name || "—",
        app.phone || "—",
        app.partner_name || "—",
        STATUS_CONFIG[app.status]?.label || app.status,
        new Date(app.created_at).toLocaleDateString("pt-BR"),
    ]);

    const BOM = "\uFEFF";
    const csvContent =
        BOM +
        [headers.join(";"), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))].join(
            "\n"
        );

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `candidaturas_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Arquivo exportado com sucesso!");
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PartnerApplications() {
    const [selectedApp, setSelectedApp] = useState<ApplicationWithDetails | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [partnerFilter, setPartnerFilter] = useState<string>("all");

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

    // ─── Stats ───────────────────────────────────────────────────────────────

    const stats = useMemo(() => {
        const total = applications.length;
        const eligible = applications.filter((a) => a.status === "eligible" || a.status === "submitted").length;
        const submitted = applications.filter((a) => a.status === "submitted").length;
        return { total, eligible, submitted };
    }, [applications]);

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
                    onClick={() => exportToExcel(applications)}
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
                        isLoading={isLoading}
                        onViewAnswers={handleViewAnswers}
                        partners={partners}
                        partnerFilter={partnerFilter}
                        onPartnerFilterChange={setPartnerFilter}
                    />
                </CardContent>
            </Card>

            {/* Answers Modal */}
            <ApplicationAnswersModal
                application={selectedApp}
                open={modalOpen}
                onOpenChange={setModalOpen}
            />
        </div>
    );
}
