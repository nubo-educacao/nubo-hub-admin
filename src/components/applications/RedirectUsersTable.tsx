import { useMemo, useState } from "react";
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
import { Download, Eye } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { PartnerRedirectUser } from "@/services/partnerPortalService";
import { StudentDetailsModal } from "@/components/students/StudentDetailsModal";
import { toast } from "sonner";

interface RedirectUsersTableProps {
  redirectUsers: PartnerRedirectUser[];
  partnerName?: string;
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
    "Complemento"
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
    u.complement || "—"
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

export default function RedirectUsersTable({ redirectUsers, partnerName = "parceiro" }: RedirectUsersTableProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const uniqueUsers = useMemo(() => {
    if (!redirectUsers) return [];
    
    const userMap = new Map<string, PartnerRedirectUser>();
    
    redirectUsers.forEach((user) => {
      const key = user.whatsapp || user.full_name;
      const existing = userMap.get(key);
      
      if (!existing || new Date(user.created_at) > new Date(existing.created_at)) {
        userMap.set(key, user);
      }
    });
    
    return Array.from(userMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [redirectUsers]);

  const handleViewProfile = (userId: string) => {
    setSelectedStudentId(userId);
    setIsModalOpen(true);
  };

  if (!redirectUsers || redirectUsers.length === 0) {
    return null;
  }

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg">Redirecionamentos Externos</CardTitle>
          <CardDescription>
            {uniqueUsers.length} usuários únicos que clicaram para se candidatar externamente
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
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>URL de Destino</TableHead>
                <TableHead>Data do Último Clique</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uniqueUsers.map((user, idx) => (
                <TableRow key={`${generateUserKey(user, idx)}`}>
                  <TableCell className="font-medium">{user.full_name || "—"}</TableCell>
                  <TableCell>{user.whatsapp || "—"}</TableCell>
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
