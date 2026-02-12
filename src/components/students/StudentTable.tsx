
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { StudentProfile } from "@/services/studentsService";

interface StudentTableProps {
    students: StudentProfile[];
    onViewDetails: (student: StudentProfile) => void;
    sortBy?: string;
    sortOrder?: string;
    onSort?: (field: string) => void;
}

export function StudentTable({ students, onViewDetails, sortBy, sortOrder, onSort }: StudentTableProps) {
    const renderSortIcon = (field: string) => {
        if (sortBy !== field) return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/30" />;
        return sortOrder === "asc" ? (
            <ArrowUp className="ml-2 h-4 w-4 text-primary" />
        ) : (
            <ArrowDown className="ml-2 h-4 w-4 text-primary" />
        );
    };

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => onSort?.("full_name")}
                        >
                            <div className="flex items-center">
                                Nome
                                {renderSortIcon("full_name")}
                            </div>
                        </TableHead>
                        <TableHead
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => onSort?.("age")}
                        >
                            <div className="flex items-center">
                                Idade
                                {renderSortIcon("age")}
                            </div>
                        </TableHead>
                        <TableHead
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => onSort?.("city")}
                        >
                            <div className="flex items-center">
                                Cidade
                                {renderSortIcon("city")}
                            </div>
                        </TableHead>
                        <TableHead
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => onSort?.("education")}
                        >
                            <div className="flex items-center">
                                Escolaridade
                                {renderSortIcon("education")}
                            </div>
                        </TableHead>
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
