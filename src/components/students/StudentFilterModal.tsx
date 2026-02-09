import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StudentFilters } from "@/services/studentsService";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { QUOTA_OPTIONS } from "@/constants/quotaOptions";

interface StudentFilterModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    filters: StudentFilters;
    onApplyFilters: (newFilters: StudentFilters) => void;
    onClearFilters: () => void;
}

export function StudentFilterModal({
    open,
    onOpenChange,
    filters,
    onApplyFilters,
    onClearFilters,
}: StudentFilterModalProps) {
    const [localFilters, setLocalFilters] = useState<StudentFilters>(filters);

    useEffect(() => {
        setLocalFilters(filters);
    }, [filters, open]);

    const handleApply = () => {
        onApplyFilters(localFilters);
        onOpenChange(false);
    };

    const handleClear = () => {
        onClearFilters();
        setLocalFilters({});
        onOpenChange(false);
    };

    const toggleQuota = (id: string) => {
        setLocalFilters(prev => {
            const current = prev.quotaTypes || [];
            if (current.includes(id)) {
                return { ...prev, quotaTypes: current.filter(x => x !== id) };
            } else {
                return { ...prev, quotaTypes: [...current, id] };
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                    <DialogTitle>Filtrar Estudantes</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="fullName">Nome Completo</Label>
                        <Input
                            id="fullName"
                            placeholder="Buscar por nome..."
                            value={localFilters.fullName || ""}
                            onChange={(e) =>
                                setLocalFilters({ ...localFilters, fullName: e.target.value })
                            }
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="city">Cidade</Label>
                        <Input
                            id="city"
                            placeholder="Buscar por cidade..."
                            value={localFilters.city || ""}
                            onChange={(e) =>
                                setLocalFilters({ ...localFilters, city: e.target.value })
                            }
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="education">Escolaridade</Label>
                        <Input
                            id="education"
                            placeholder="Buscar por escolaridade..."
                            value={localFilters.education || ""}
                            onChange={(e) =>
                                setLocalFilters({ ...localFilters, education: e.target.value })
                            }
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="isNuboStudent">Estudante Nubo</Label>
                        <Select
                            value={localFilters.isNuboStudent === true ? "true" : localFilters.isNuboStudent === false ? "false" : "all"}
                            onValueChange={(value) => {
                                let newValue: boolean | null | undefined = undefined;
                                if (value === "true") newValue = true;
                                if (value === "false") newValue = false;
                                setLocalFilters({ ...localFilters, isNuboStudent: newValue });
                            }}
                        >
                            <SelectTrigger id="isNuboStudent">
                                <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Ambos</SelectItem>
                                <SelectItem value="true">Sim</SelectItem>
                                <SelectItem value="false">Não</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Renda Filter - Full Width */}
                    <div className="col-span-2 grid gap-2">
                        <Label>Renda Familiar Per Capita (R$)</Label>
                        <div className="flex gap-4 items-center">
                            <div className="flex-1">
                                <Input
                                    type="number"
                                    placeholder="Mínimo"
                                    value={localFilters.incomeMin || ""}
                                    onChange={(e) =>
                                        setLocalFilters({ ...localFilters, incomeMin: e.target.value ? Number(e.target.value) : undefined })
                                    }
                                />
                            </div>
                            <span>até</span>
                            <div className="flex-1">
                                <Input
                                    type="number"
                                    placeholder="Máximo"
                                    value={localFilters.incomeMax || ""}
                                    onChange={(e) =>
                                        setLocalFilters({ ...localFilters, incomeMax: e.target.value ? Number(e.target.value) : undefined })
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    {/* Quota Filter - Full Width */}
                    <div className="col-span-2 grid gap-2">
                        <Label>Cotas (Selecione para filtrar quem possui)</Label>
                        <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                            <div className="grid grid-cols-2 gap-2">
                                {QUOTA_OPTIONS.map((quota) => (
                                    <div key={quota.id} className="flex items-start space-x-2">
                                        <Checkbox
                                            id={quota.id}
                                            checked={(localFilters.quotaTypes || []).includes(quota.id)}
                                            onCheckedChange={() => toggleQuota(quota.id)}
                                        />
                                        <label
                                            htmlFor={quota.id}
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                        >
                                            {quota.label}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={handleClear}>
                        Limpar Filtros
                    </Button>
                    <Button onClick={handleApply}>Aplicar Filtros</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
