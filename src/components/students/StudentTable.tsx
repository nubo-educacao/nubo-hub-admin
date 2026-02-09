
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { StudentProfile } from "@/services/studentsService";

interface StudentTableProps {
    students: StudentProfile[];
    onViewDetails: (student: StudentProfile) => void;
}

export function StudentTable({ students, onViewDetails }: StudentTableProps) {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Idade</TableHead>
                        <TableHead>Cidade</TableHead>
                        <TableHead>Escolaridade</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {students.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">
                                Nenhum estudante encontrado.
                            </TableCell>
                        </TableRow>
                    ) : (
                        students.map((student) => (
                            <TableRow key={student.id}>
                                <TableCell className="font-medium">{student.full_name || "N/A"}</TableCell>
                                <TableCell>{student.age || "N/A"}</TableCell>
                                <TableCell>{student.city || "N/A"}</TableCell>
                                <TableCell>{student.education || "N/A"}</TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onViewDetails(student)}
                                        className="gap-2"
                                    >
                                        <Eye className="h-4 w-4" />
                                        Ver detalhes
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
