import { useEffect, useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Download, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PartnerOption } from "@/services/applicationsService";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { PartnerRedirectUser } from "@/services/partnerPortalService";
import { StudentDetailsModal } from "@/components/students/StudentDetailsModal";
import { toast } from "sonner";

interface RedirectUsersTableProps {
  redirectUsers: PartnerRedirectUser[];
  partnerName?: string;
  partners?: PartnerOption[];
}

function exportRedirectsToExcel(users: PartnerRedirectUser[], partnerName: string) {
  const headers = [
    "Nome", 
    "WhatsApp", 
    "URL de Destino", 
    "Data do Último Clique",
    "Cidade",
    "Estado",
    "Escolaridade",
    "Ano Escolar",
    "Idade",
    "Bairro",
    "Rua",
    "Número",
    "Complemento",
    "CEP",
    "País",
    "Interesses de Curso",
    "Turnos",
    "Universidade",
    "Programa",
    "Renda Per Capita",
    "Cotas"
  ];

  const sanitize = (val: unknown) => {
    if (val == null || val === "") return "—";
    if (typeof val === "object") {
      return JSON.stringify(val).replace(/\r?\n|\r/g, ' | ');
    }
    return String(val).replace(/\r?\n|\r/g, ' | ');
  };

  const formatCSVCell = (val: unknown) => {
    const sanitized = sanitize(val);
    return `"${sanitized.replace(/"/g, '""')}"`;
  };

  const rows = users.map((u) => [
    u.full_name || "—",
    u.whatsapp || "—",
    u.redirect_url || "—",
    format(new Date(u.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
    u.city || "—",
    u.state || "—",
    u.education || "—",
    u.education_year || "—",
    u.age || "—",
    u.neighborhood || "—",
    u.street || "—",
    u.street_number || "—",
    u.complement || "—",
    u.zip_code || "—",
    u.country || "—",
    u.course_interest?.join(", ") || "—",
    u.preferred_shifts?.join(", ") || "—",
    u.university_preference || "—",
    u.program_preference || "—",
    u.per_capita_income ? `R$ ${u.per_capita_income.toFixed(2)}` : "—",
    u.quota_types?.join(", ") || "—"
  ]);

  const BOM = "\uFEFF";
  const csvContent =
    BOM +
    [
      headers.map(formatCSVCell).join(";"),
      ...rows.map((r) => r.map(formatCSVCell).join(";"))
    ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `redirecionamentos_${partnerName.replace(/\s+/g, "_").toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast.success("Arquivo exportado com sucesso!");
}

export default function RedirectUsersTable({ redirectUsers, partnerName = "parceiro", partners }: RedirectUsersTableProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [partnerFilter, setPartnerFilter] = useState<string>("all");
  const itemsPerPage = 10;

  const filteredRedirects = useMemo(() => {
    return redirectUsers.filter((user) => {
      if (partnerFilter !== "all" && user.partner_id !== partnerFilter) return false;
      if (search) {
        const searchLower = search.toLowerCase();
        const nameMatch = user.full_name?.toLowerCase().includes(searchLower);
        if (!nameMatch) return false;
      }
      return true;
    });
  }, [redirectUsers, partnerFilter, search]);

  const uniqueUsers = useMemo(() => {
    if (!filteredRedirects) return [];
    
    const userMap = new Map<string, PartnerRedirectUser>();
    
    filteredRedirects.forEach((user) => {
      const key = user.whatsapp || user.full_name;
      const existing = userMap.get(key);
      
      if (!existing || new Date(user.created_at) > new Date(existing.created_at)) {
        userMap.set(key, user);
      }
    });
    
    return Array.from(userMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [filteredRedirects]);
  
  const totalPages = Math.ceil(uniqueUsers.length / itemsPerPage);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return uniqueUsers.slice(start, start + itemsPerPage);
  }, [uniqueUsers, currentPage]);

  const handleViewProfile = (userId: string) => {
    setSelectedStudentId(userId);
    setIsModalOpen(true);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search, partnerFilter]);

  if (!redirectUsers || redirectUsers.length === 0) {
    return null;
  }

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg">Redirecionamentos Externos</CardTitle>
          <CardDescription>
            {filteredRedirects.length} cliques ({uniqueUsers.length} estudantes únicos)
          </CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2"
          onClick={() => exportRedirectsToExcel(uniqueUsers, partnerName)}
        >
          <Download className="h-4 w-4" />
          Exportar Excel
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
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
          {partners && (
            <Select value={partnerFilter} onValueChange={setPartnerFilter}>
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
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>WhatsApp</TableHead>
                {partners && <TableHead>Parceiro</TableHead>}
                <TableHead>URL de Destino</TableHead>
                <TableHead>Data do Último Clique</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUsers.map((user, idx) => (
                <TableRow key={`${generateUserKey(user, idx)}`}>
                  <TableCell className="font-medium">{user.full_name || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">{user.whatsapp || "—"}</TableCell>
                  {partners && (
                    <TableCell className="whitespace-nowrap">
                      {user.partner_name || "—"}
                    </TableCell>
                  )}
                  <TableCell className="text-muted-foreground whitespace-nowrap truncate max-w-[200px]" title={user.redirect_url}>
                    {user.redirect_url || "—"}
                  </TableCell>
                  <TableCell>
                    {format(new Date(user.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleViewProfile(user.user_id)}
                      title="Ver perfil"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between space-x-2 py-4">
            <div className="text-sm text-muted-foreground">
              Página {currentPage} de {totalPages} ({uniqueUsers.length} registros)
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Próximo
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <StudentDetailsModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        studentId={selectedStudentId}
      />
    </Card>
  );
}

function generateUserKey(u: PartnerRedirectUser, idx: number) {
  return `${u.full_name}-${u.whatsapp}-${idx}`;
}
