
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { SeanEllisScore } from "@/services/seanEllisService";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, X, Minus } from "lucide-react";

interface SeanEllisTableProps {
    data: SeanEllisScore[];
}

export function SeanEllisTable({ data }: SeanEllisTableProps) {
    if (!data || data.length === 0) {
        return (
            <div className="rounded-md border p-8 text-center text-muted-foreground">
                Nenhum resultado encontrado.
            </div>
        );
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Whatsapp</TableHead>
                        <TableHead>Identificado?</TableHead>
                        <TableHead>Nível de Decepção</TableHead>
                        <TableHead>SISU Inscrito?</TableHead>
                        <TableHead>PROUNI Inscrito?</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((item) => (
                        <TableRow key={item.id}>
                            <TableCell className="whitespace-nowrap">
                                {item.submitted_at ? format(new Date(item.submitted_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                            </TableCell>
                            <TableCell>{item.full_name}</TableCell>
                            <TableCell>{item.whatsapp_raw}</TableCell>
                            <TableCell>
                                {item.user_id ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                    <Minus className="h-4 w-4 text-gray-300" />
                                )}
                            </TableCell>
                            <TableCell>{item.disappointment_level}</TableCell>
                            <TableCell>{item.sisu_subscribed}</TableCell>
                            <TableCell>{item.prouni_subscribed}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
