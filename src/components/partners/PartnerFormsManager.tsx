import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Partner } from "@/services/partnersService";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2, GripVertical, Code2, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { CriterionRuleBuilder } from "./CriterionRuleBuilder";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PartnerFormField {
    id: string;
    partner_id: string;
    field_name: string;
    question_text: string;
    data_type: string;
    options: unknown[] | null;
    mapping_source: string | null;
    is_criterion: boolean;
    criterion_rule: Record<string, unknown> | null;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

interface FormFieldValues {
    field_name: string;
    question_text: string;
    data_type: string;
    options: string;
    mapping_source: string;
    is_criterion: boolean;
    criterion_rule: string;
    sort_order: number;
}

const EMPTY_FIELD: FormFieldValues = {
    field_name: "",
    question_text: "",
    data_type: "text",
    options: "",
    mapping_source: "",
    is_criterion: false,
    criterion_rule: "",
    sort_order: 0,
};

const DATA_TYPES = [
    { value: "text", label: "Texto" },
    { value: "number", label: "Número" },
    { value: "boolean", label: "Sim/Não" },
    { value: "select", label: "Seleção" },
];

const MAPPING_SOURCES = [
    { value: "", label: "Nenhum (perguntar sempre)" },
    // user_profiles
    { value: "user_profiles.full_name", label: "Perfil: Nome Completo" },
    { value: "user_profiles.age", label: "Perfil: Idade" },
    { value: "user_profiles.city", label: "Perfil: Cidade" },
    { value: "user_profiles.state", label: "Perfil: Estado" },
    { value: "user_profiles.education", label: "Perfil: Escolaridade" },
    { value: "user_profiles.referral_source", label: "Perfil: Como conheceu" },
    // user_preferences
    { value: "user_preferences.enem_score", label: "Prefs: Nota ENEM" },
    { value: "user_preferences.family_income_per_capita", label: "Prefs: Renda Per Capita" },
    { value: "user_preferences.course_interest", label: "Prefs: Interesse em Cursos" },
    { value: "user_preferences.location_preference", label: "Prefs: Preferência de Local" },
    { value: "user_preferences.preferred_shifts", label: "Prefs: Turnos Preferidos" },
    { value: "user_preferences.program_preference", label: "Prefs: Preferência de Programa (Prouni/Sisu)" },
    { value: "user_preferences.quota_types", label: "Prefs: Tipos de Cota" },
    { value: "user_preferences.state_preference", label: "Prefs: Estado de Preferência" },
    { value: "user_preferences.university_preference", label: "Prefs: Universidade de Preferência" },
];

// ─── Component ───────────────────────────────────────────────────────────────

interface PartnerFormsManagerProps {
    partners: Partner[];
}

export function PartnerFormsManager({ partners }: PartnerFormsManagerProps) {
    const queryClient = useQueryClient();
    const [selectedPartnerId, setSelectedPartnerId] = useState<string>("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingField, setEditingField] = useState<PartnerFormField | null>(null);
    const [formValues, setFormValues] = useState<FormFieldValues>(EMPTY_FIELD);
    const [deleteFieldId, setDeleteFieldId] = useState<string | null>(null);
    const [mappingOpen, setMappingOpen] = useState(false);

    // ─── Queries ─────────────────────────────────────────────────────────────

    const { data: fields = [], isLoading } = useQuery({
        queryKey: ["partner-forms", selectedPartnerId],
        queryFn: async () => {
            if (!selectedPartnerId) return [];
            const { data, error } = await (supabase
                .from("partner_forms" as any)
                .select("*")
                .eq("partner_id", selectedPartnerId)
                .order("sort_order", { ascending: true }) as any);
            if (error) throw error;
            return (data ?? []) as PartnerFormField[];
        },
        enabled: !!selectedPartnerId,
    });

    // ─── Mutations ───────────────────────────────────────────────────────────

    const saveMutation = useMutation({
        mutationFn: async (values: FormFieldValues) => {
            const payload: any = {
                partner_id: selectedPartnerId,
                field_name: values.field_name,
                question_text: values.question_text,
                data_type: values.data_type,
                options: values.options ? JSON.parse(values.options) : null,
                mapping_source: values.mapping_source || null,
                is_criterion: values.is_criterion,
                criterion_rule: values.criterion_rule ? JSON.parse(values.criterion_rule) : null,
                sort_order: values.sort_order,
            };

            if (editingField) {
                const { error } = await (supabase
                    .from("partner_forms" as any)
                    .update(payload)
                    .eq("id", editingField.id) as any);
                if (error) throw error;
            } else {
                const { error } = await (supabase
                    .from("partner_forms" as any)
                    .insert(payload) as any);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["partner-forms", selectedPartnerId] });
            toast.success(editingField ? "Campo atualizado!" : "Campo criado!");
            setIsDialogOpen(false);
            setEditingField(null);
            setFormValues(EMPTY_FIELD);
        },
        onError: (err: any) => {
            toast.error(`Erro: ${err.message}`);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await (supabase
                .from("partner_forms" as any)
                .delete()
                .eq("id", id) as any);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["partner-forms", selectedPartnerId] });
            toast.success("Campo removido!");
            setDeleteFieldId(null);
        },
        onError: () => toast.error("Erro ao remover campo."),
    });

    // ─── Handlers ────────────────────────────────────────────────────────────

    const handleAdd = () => {
        setEditingField(null);
        setFormValues({
            ...EMPTY_FIELD,
            sort_order: fields.length,
        });
        setIsDialogOpen(true);
    };

    const handleEdit = (field: PartnerFormField) => {
        setEditingField(field);
        setFormValues({
            field_name: field.field_name,
            question_text: field.question_text,
            data_type: field.data_type,
            options: field.options ? JSON.stringify(field.options, null, 2) : "",
            mapping_source: field.mapping_source || "",
            is_criterion: field.is_criterion,
            criterion_rule: field.criterion_rule ? JSON.stringify(field.criterion_rule, null, 2) : "",
            sort_order: field.sort_order,
        });
        setIsDialogOpen(true);
    };

    const handleSave = () => {
        if (!formValues.field_name || !formValues.question_text) {
            toast.error("Nome do campo e texto da pergunta são obrigatórios.");
            return;
        }
        // Validate JSON fields
        try {
            if (formValues.options) JSON.parse(formValues.options);
        } catch {
            toast.error("JSON inválido no campo 'Opções'.");
            return;
        }
        // criterion_rule is now managed by the visual builder, 
        // but still validate if present
        try {
            if (formValues.criterion_rule) JSON.parse(formValues.criterion_rule);
        } catch {
            toast.error("Regra de critério inválida.");
            return;
        }
        saveMutation.mutate(formValues);
    };

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="space-y-4">
            {/* Partner Selector */}
            <div className="flex items-end gap-4">
                <div className="flex-1 max-w-sm space-y-2">
                    <Label>Selecione um Parceiro</Label>
                    <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Escolha um parceiro..." />
                        </SelectTrigger>
                        <SelectContent>
                            {partners.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {selectedPartnerId && (
                    <Button onClick={handleAdd} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Novo Campo
                    </Button>
                )}
            </div>

            {/* Fields Table */}
            {selectedPartnerId && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Campos do Formulário</CardTitle>
                        <CardDescription>
                            {fields.length} campo(s) configurado(s). A Cloudinha usará esses campos para entrevistar o estudante.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : fields.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Nenhum campo configurado. Clique em "Novo Campo" para começar.
                            </div>
                        ) : (
                            <div className="rounded-md border overflow-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[40px]">#</TableHead>
                                            <TableHead>Campo</TableHead>
                                            <TableHead>Pergunta</TableHead>
                                            <TableHead>Tipo</TableHead>
                                            <TableHead>Auto-Fill</TableHead>
                                            <TableHead>Critério</TableHead>
                                            <TableHead className="w-[100px]">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {fields.map((field, idx) => (
                                            <TableRow key={field.id}>
                                                <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                                                <TableCell className="font-mono text-sm">{field.field_name}</TableCell>
                                                <TableCell className="max-w-[200px] truncate">{field.question_text}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">
                                                        {DATA_TYPES.find((d) => d.value === field.data_type)?.label || field.data_type}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {field.mapping_source || "—"}
                                                </TableCell>
                                                <TableCell>
                                                    {field.is_criterion ? (
                                                        <Badge variant="default" className="bg-amber-500/80">Sim</Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">Não</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleEdit(field)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => setDeleteFieldId(field.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingField ? "Editar Campo" : "Novo Campo"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nome do Campo (key)</Label>
                                <Input
                                    placeholder="ex: whatsapp, renda"
                                    value={formValues.field_name}
                                    onChange={(e) => setFormValues({ ...formValues, field_name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Ordem</Label>
                                <Input
                                    type="number"
                                    value={formValues.sort_order}
                                    onChange={(e) => setFormValues({ ...formValues, sort_order: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Texto da Pergunta</Label>
                            <Input
                                placeholder="ex: Qual seu número de WhatsApp?"
                                value={formValues.question_text}
                                onChange={(e) => setFormValues({ ...formValues, question_text: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Tipo de Dado</Label>
                                <Select
                                    value={formValues.data_type}
                                    onValueChange={(val) => setFormValues({ ...formValues, data_type: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DATA_TYPES.map((dt) => (
                                            <SelectItem key={dt.value} value={dt.value}>
                                                {dt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2 flex flex-col">
                                <Label>Auto-Fill (mapping)</Label>
                                <Popover open={mappingOpen} onOpenChange={setMappingOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={mappingOpen}
                                            className="w-full justify-between font-normal"
                                        >
                                            {formValues.mapping_source
                                                ? MAPPING_SOURCES.find((ms) => ms.value === formValues.mapping_source)?.label
                                                : "Nenhum (perguntar sempre)"}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Buscar mapeamento..." />
                                            <CommandList>
                                                <CommandEmpty>Nenhum mapeamento encontrado.</CommandEmpty>
                                                <CommandGroup>
                                                    {MAPPING_SOURCES.map((ms) => (
                                                        <CommandItem
                                                            key={ms.value || "_none"}
                                                            value={ms.label}
                                                            onSelect={() => {
                                                                setFormValues({ ...formValues, mapping_source: ms.value });
                                                                setMappingOpen(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    formValues.mapping_source === ms.value ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {ms.label}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        {formValues.data_type === "select" && (
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Code2 className="h-4 w-4" />
                                    Opções (JSON Array)
                                </Label>
                                <Textarea
                                    placeholder='["Opção 1", "Opção 2", "Opção 3"]'
                                    className="font-mono text-sm"
                                    rows={3}
                                    value={formValues.options}
                                    onChange={(e) => setFormValues({ ...formValues, options: e.target.value })}
                                />
                            </div>
                        )}

                        <div className="flex items-center gap-3 rounded-lg border p-3">
                            <Switch
                                checked={formValues.is_criterion}
                                onCheckedChange={(val) => setFormValues({ ...formValues, is_criterion: val })}
                            />
                            <div>
                                <Label>Este campo é um critério de elegibilidade?</Label>
                                <p className="text-xs text-muted-foreground">
                                    Se sim, a resposta será avaliada pela regra abaixo.
                                </p>
                            </div>
                        </div>

                        {formValues.is_criterion && (
                            <CriterionRuleBuilder
                                fieldName={formValues.field_name}
                                value={formValues.criterion_rule}
                                onChange={(jsonStr) => setFormValues({ ...formValues, criterion_rule: jsonStr })}
                            />
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={saveMutation.isPending}>
                            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            {editingField ? "Salvar" : "Criar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteFieldId} onOpenChange={() => setDeleteFieldId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remover campo?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação não pode ser desfeita. O campo será removido permanentemente do formulário.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteFieldId && deleteMutation.mutate(deleteFieldId)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Remover
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
