import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    Search,
    CheckCircle2,
    XCircle,
    Clock,
    FileSpreadsheet,
    Eye,
} from "lucide-react";
import type { ApplicationWithDetails, PartnerOption } from "@/services/applicationsService";

// ─── Status helpers ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
    string,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }
> = {
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

// ─── Phone formatter ─────────────────────────────────────────────────────────

function formatPhone(phone: string | null): string {
    if (!phone) return "—";
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 13) {
        return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
    if (digits.length === 12) {
        return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
    }
    if (digits.length === 11) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    return phone;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface ApplicationsTableProps {
    applications: ApplicationWithDetails[];
    isLoading: boolean;
    onViewAnswers: (app: ApplicationWithDetails) => void;
    /** If provided, renders the partner filter dropdown (Admin mode) */
    partners?: PartnerOption[];
    partnerFilter?: string;
    onPartnerFilterChange?: (value: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ApplicationsTable({
    applications,
    isLoading,
    onViewAnswers,
    partners,
    partnerFilter,
    onPartnerFilterChange,
}: ApplicationsTableProps) {
    const showPartnerColumn = !!partners;
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    const filteredApplications = useMemo(() => {
        return applications.filter((app) => {
            if (statusFilter !== "all" && app.status !== statusFilter) return false;
            if (search) {
                const searchLower = search.toLowerCase();
                const nameMatch = app.full_name?.toLowerCase().includes(searchLower);
                if (!nameMatch) return false;
            }
            return true;
        });
    }, [applications, statusFilter, search]);

    if (isLoading) {
        return (
            <div className="flex h-[200px] items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nome..."
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                {partners && onPartnerFilterChange && (
                    <Select value={partnerFilter || "all"} onValueChange={onPartnerFilterChange}>
                        <SelectTrigger className="w-full sm:w-[220px]">
                            <SelectValue placeholder="Todos os Parceiros" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os Parceiros</SelectItem>
                            {partners.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
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
                            <TableHead>Whatsapp</TableHead>
                            {showPartnerColumn && <TableHead>Parceiro</TableHead>}
                            <TableHead>Status</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredApplications.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={showPartnerColumn ? 6 : 5} className="text-center py-8 text-muted-foreground">
                                    Nenhuma candidatura encontrada.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredApplications.map((app) => (
                                <TableRow key={app.id}>
                                    <TableCell className="font-medium whitespace-nowrap">
                                        {app.full_name || "—"}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        {formatPhone(app.phone)}
                                    </TableCell>
                                    {showPartnerColumn && (
                                        <TableCell className="whitespace-nowrap">
                                            {app.partner_name || "—"}
                                        </TableCell>
                                    )}
                                    <TableCell>
                                        <StatusBadge status={app.status} />
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-muted-foreground">
                                        {new Date(app.created_at).toLocaleDateString("pt-BR")}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onViewAnswers(app)}
                                            title="Ver respostas"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

export { STATUS_CONFIG, formatPhone };
