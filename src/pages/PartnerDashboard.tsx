import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    getMyPartnerId,
    getApplicationsByPartner,
    getPartnerFormFields,
    getPartnerDetails,
    getUserProfiles,
    type StudentApplication,
    type PartnerFormField,
} from "@/services/partnerPortalService";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Download,
    Search,
    Users,
    CheckCircle2,
    XCircle,
    Clock,
    FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";

// ─── Status helpers ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
    started: { label: "Em Andamento", variant: "outline", icon: Clock },
    eligible: { label: "Elegível", variant: "default", icon: CheckCircle2 },
    ineligible: { label: "Inelegível", variant: "destructive", icon: XCircle },
    submitted: { label: "Enviado", variant: "secondary", icon: FileSpreadsheet },
};

function StatusBadge({ status }: { status: string }) {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.started;
    const Icon = config.icon;
    return (
        <Badge variant={config.variant} className="flex items-center gap-1 whitespace-nowrap">
            <Icon className="h-3 w-3" />
            {config.label}
        </Badge>
    );
}

// ─── Excel Export ────────────────────────────────────────────────────────────

function exportToExcel(
    applications: StudentApplication[],
    formFields: PartnerFormField[],
    profiles: Record<string, any>,
    partnerName: string
) {
    // Build CSV headers
    const fixedHeaders = ["Nome", "Cidade", "Estado", "Status", "Data"];
    const dynamicHeaders = formFields.map((f) => f.question_text || f.field_name);
    const allHeaders = [...fixedHeaders, ...dynamicHeaders];

    // Build rows
    const rows = applications.map((app) => {
        const profile = profiles[app.user_id] || {};
        const fixedCols = [
            profile.full_name || "—",
            profile.city || "—",
            profile.state || "—",
            STATUS_CONFIG[app.status]?.label || app.status,
            new Date(app.created_at).toLocaleDateString("pt-BR"),
        ];
        const dynamicCols = formFields.map((f) => {
            const val = (app.answers as Record<string, unknown>)?.[f.field_name];
            return val != null ? String(val) : "—";
        });
        return [...fixedCols, ...dynamicCols];
    });

    // Build CSV content (BOM for Excel)
    const BOM = "\uFEFF";
    const csvContent =
        BOM +
        [allHeaders.join(";"), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))].join(
            "\n"
        );

    // Download
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
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");

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

    // 4. Fetch applications
    const { data: applications = [], isLoading: loadingApps } = useQuery({
        queryKey: ["partnerApplications", partnerId],
        queryFn: () => getApplicationsByPartner(partnerId!),
        enabled: !!partnerId,
    });

    // 5. Fetch user profiles to enrich table
    const userIds = useMemo(() => [...new Set(applications.map((a) => a.user_id))], [applications]);
    const { data: profilesRaw = [] } = useQuery({
        queryKey: ["userProfiles", userIds],
        queryFn: () => getUserProfiles(userIds),
        enabled: userIds.length > 0,
    });

    const profiles = useMemo(() => {
        const map: Record<string, any> = {};
        profilesRaw.forEach((p: any) => {
            map[p.id] = p;
        });
        return map;
    }, [profilesRaw]);

    // ─── Filtering ───────────────────────────────────────────────────────────

    const filteredApplications = useMemo(() => {
        return applications.filter((app) => {
            // Status filter
            if (statusFilter !== "all" && app.status !== statusFilter) return false;

            // Search filter (name, city)
            if (search) {
                const profile = profiles[app.user_id];
                const searchLower = search.toLowerCase();
                const nameMatch = profile?.full_name?.toLowerCase().includes(searchLower);
                const cityMatch = profile?.city?.toLowerCase().includes(searchLower);
                if (!nameMatch && !cityMatch) return false;
            }

            return true;
        });
    }, [applications, statusFilter, search, profiles]);

    // ─── Stats ───────────────────────────────────────────────────────────────

    const stats = useMemo(() => {
        const total = applications.length;
        const eligible = applications.filter((a) => a.status === "eligible" || a.status === "submitted").length;
        const submitted = applications.filter((a) => a.status === "submitted").length;
        return { total, eligible, submitted };
    }, [applications]);

    // ─── Loading & Error States ──────────────────────────────────────────────

    if (loadingPartnerId || loadingApps) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
                    onClick={() => exportToExcel(filteredApplications, formFields, profiles, partner?.name || "parceiro")}
                    disabled={filteredApplications.length === 0}
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

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Candidaturas</CardTitle>
                    <CardDescription>
                        {filteredApplications.length} de {applications.length} registros
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nome ou cidade..."
                                className="pl-9"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Todos os Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os Status</SelectItem>
                                <SelectItem value="started">Em Andamento</SelectItem>
                                <SelectItem value="eligible">Elegível</SelectItem>
                                <SelectItem value="ineligible">Inelegível</SelectItem>
                                <SelectItem value="submitted">Enviado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Table */}
                    <div className="rounded-md border overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Cidade/UF</TableHead>
                                    <TableHead>Status</TableHead>
                                    {formFields.map((f) => (
                                        <TableHead key={f.id}>{f.question_text || f.field_name}</TableHead>
                                    ))}
                                    <TableHead>Data</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredApplications.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4 + formFields.length} className="text-center py-8 text-muted-foreground">
                                            Nenhuma candidatura encontrada.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredApplications.map((app) => {
                                        const profile = profiles[app.user_id] || {};
                                        return (
                                            <TableRow key={app.id}>
                                                <TableCell className="font-medium whitespace-nowrap">
                                                    {profile.full_name || "—"}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    {profile.city || "—"}{profile.state ? ` / ${profile.state}` : ""}
                                                </TableCell>
                                                <TableCell>
                                                    <StatusBadge status={app.status} />
                                                </TableCell>
                                                {formFields.map((f) => (
                                                    <TableCell key={f.id}>
                                                        {(app.answers as Record<string, unknown>)?.[f.field_name] != null
                                                            ? String((app.answers as Record<string, unknown>)[f.field_name])
                                                            : "—"}
                                                    </TableCell>
                                                ))}
                                                <TableCell className="whitespace-nowrap text-muted-foreground">
                                                    {new Date(app.created_at).toLocaleDateString("pt-BR")}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
