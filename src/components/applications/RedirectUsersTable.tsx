import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { PartnerRedirectUser } from "@/services/partnerPortalService";

interface RedirectUsersTableProps {
  redirectUsers: PartnerRedirectUser[];
}

export default function RedirectUsersTable({ redirectUsers }: RedirectUsersTableProps) {
  if (!redirectUsers || redirectUsers.length === 0) {
    return null;
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg">Redirecionamentos Externos</CardTitle>
        <CardDescription>
          {redirectUsers.length} contatos que clicaram para se candidatar externamente
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>URL de Destino</TableHead>
                <TableHead className="text-right">Data do Clique</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {redirectUsers.map((user, idx) => (
                <TableRow key={`${generateUserKey(user, idx)}`}>
                  <TableCell className="font-medium">{user.full_name || "—"}</TableCell>
                  <TableCell>{user.whatsapp || "—"}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap truncate max-w-[200px]" title={user.redirect_url}>
                    {user.redirect_url || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {format(new Date(user.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function generateUserKey(u: PartnerRedirectUser, idx: number) {
  return `${u.full_name}-${u.whatsapp}-${idx}`;
}
