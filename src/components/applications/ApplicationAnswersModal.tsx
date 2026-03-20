import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import type { ApplicationWithDetails } from "@/services/applicationsService";
import type { PartnerFormField } from "@/services/partnerPortalService";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Complex Data Renderer Helper ──────────────────────────────────────────

function ComplexDataRenderer({ value, field }: { value: unknown; field?: PartnerFormField | null }) {
    if (value == null || value === "") return <span className="text-muted-foreground italic">Não preenchido</span>;
    if (typeof value !== "object") return <span className="text-sm break-words whitespace-pre-wrap">{String(value)}</span>;

    // Pattern 1 & 3: Array
    if (Array.isArray(value)) {
        if (value.length === 0) return <span className="text-muted-foreground italic">Vazio</span>;

        // Check if array of objects (Pattern 3)
        const isObjectArray = value.some(v => typeof v === "object" && v !== null && !Array.isArray(v));

        if (isObjectArray) {
            return (
                <div className="flex flex-col gap-3 mt-2">
                    {value.map((item, idx) => (
                        <div key={idx} className="border rounded-md p-3 bg-slate-50/50 shadow-sm relative pt-6">
                            <span className="absolute top-0 left-0 bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 rounded-br-md rounded-tl-md uppercase tracking-wide">
                                Item {idx + 1}
                            </span>
                            <ComplexDataRenderer value={item} field={field} />
                        </div>
                    ))}
                </div>
            );
        }

        // Pattern 1: Array of Strings/Primitives
        return (
            <div className="flex flex-wrap gap-1.5 mt-1">
                {value.map((item, idx) => (
                    <span key={idx} className="inline-flex bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-md text-xs font-medium break-words">
                        {String(item)}
                    </span>
                ))}
            </div>
        );
    }

    // Pattern 2: Object Dictionary
    const entries = Object.entries(value);
    if (entries.length === 0) return <span className="text-muted-foreground italic">Vazio</span>;

    // Se for grid_select, tenta ler os "rows" do field.options
    const hasRows = field?.data_type === "grid_select" && field.options && Array.isArray((field.options as any).rows);
    const rows = hasRows ? (field.options as any).rows : null;

    return (
        <div className="flex flex-col gap-2 mt-1">
            {entries.map(([k, v], idx) => {
                let label = isNaN(Number(k)) ? `${k}:` : `#${k}:`;
                if (rows && !isNaN(Number(k)) && rows[Number(k)]) {
                    label = rows[Number(k)];
                }
                
                return (
                    <div key={idx} className="flex gap-2 items-start text-sm border-l-2 border-slate-200 pl-3 py-0.5">
                        <span className="font-semibold text-slate-600 shrink-0 mt-0.5 text-xs w-1/2">
                            {label}
                        </span>
                        <div className="w-1/2 break-words text-slate-800">
                            {typeof v === "object" && v !== null ? (
                                <ComplexDataRenderer value={v} field={field} />
                            ) : (
                                <span className="whitespace-pre-wrap">{String(v)}</span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Component ──────────────────────────────────────────────────────────────

interface ApplicationAnswersModalProps {
    application: ApplicationWithDetails | null;
    formFields: PartnerFormField[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function ApplicationAnswersModal({
    application,
    formFields,
    open,
    onOpenChange,
}: ApplicationAnswersModalProps) {
    const [localAnswers, setLocalAnswers] = useState<Record<string, unknown>>({});
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (open && application) {
            setLocalAnswers((application.answers as Record<string, unknown>) || {});
            setEditingKey(null);
            setEditValue("");
        }
    }, [open, application]);

    if (!application) return null;

    const handleEditStart = (key: string, currentValue: unknown) => {
        setEditingKey(key);
        // Convert object/array to JSON string if needed, otherwise just stringify
        const valStr = typeof currentValue === "object" && currentValue !== null
            ? JSON.stringify(currentValue, null, 2)
            : (currentValue != null ? String(currentValue) : "");
        setEditValue(valStr);
    };

    const handleEditCancel = () => {
        setEditingKey(null);
        setEditValue("");
    };

    const handleSave = async (key: string) => {
        if (!application) return;
        setIsSaving(true);
        try {
            let parsedValue: unknown = editValue;
            try {
                if (editValue.trim().startsWith("{") || editValue.trim().startsWith("[")) {
                    parsedValue = JSON.parse(editValue);
                }
            } catch { /* if parse fails, store as string */ }

            const newAnswers = { [key]: parsedValue };
            
            const { error } = await supabase.rpc("update_student_application_answers", {
                p_application_id: application.id,
                p_answers: newAnswers as any
            });

            if (error) throw error;

            toast.success("Resposta atualizada com sucesso!");
            setLocalAnswers(prev => ({ ...prev, [key]: parsedValue }));
            setEditingKey(null);
        } catch (error: any) {
            console.error("Error saving answer:", error);
            toast.error(error.message || "Erro ao salvar a resposta");
        } finally {
            setIsSaving(false);
        }
    };
    
    // Identified fields from partner_forms
    const structuredAnswers = formFields.map(field => ({
        label: field.question_text || field.field_name,
        value: localAnswers[field.field_name],
        fieldName: field.field_name,
        field: field
    }));

    // Fields in answers that are NOT in partner_forms
    const otherAnswers = Object.entries(localAnswers).filter(
        ([key]) => !formFields.some(f => f.field_name === key)
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0">
                <div className="p-6 pb-2 shrink-0">
                    <DialogHeader>
                        <DialogTitle>Respostas — {application.full_name || "Estudante"}</DialogTitle>
                        <DialogDescription>
                            Dados estruturados seguindo a ordem do formulário do parceiro.
                        </DialogDescription>
                    </DialogHeader>
                </div>
                
                <ScrollArea className="flex-1 px-6">
                    <div className="space-y-6 pb-6">
                        {/* Structured Fields */}
                        <div className="grid grid-cols-1 gap-4">
                            {structuredAnswers.map((item, idx) => {
                                const isEditing = editingKey === item.fieldName;
                                const isComplex = typeof item.value === "object" && item.value !== null;
                                const displayValue = isComplex ? JSON.stringify(item.value) : String(item.value ?? "");

                                return (
                                    <div key={idx} className="border-b pb-2 last:border-0 group relative pr-12">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                            {item.label}
                                        </p>
                                        
                                        {isEditing ? (
                                            <div className="flex gap-2 items-start mt-1">
                                                {isComplex || editValue.length > 60 ? (
                                                    <Textarea 
                                                        value={editValue} 
                                                        onChange={(e) => setEditValue(e.target.value)} 
                                                        className="min-h-[80px] font-mono text-xs" 
                                                    />
                                                ) : (
                                                    <Input 
                                                        value={editValue} 
                                                        onChange={(e) => setEditValue(e.target.value)} 
                                                        className="h-8 text-sm" 
                                                    />
                                                )}
                                                <div className="flex flex-col gap-1 shrink-0">
                                                    <Button size="icon" variant="default" className="h-8 w-8" onClick={() => handleSave(item.fieldName)} disabled={isSaving}>
                                                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                                    </Button>
                                                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={handleEditCancel} disabled={isSaving}>
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex justify-between items-start mt-1 relative">
                                                <div className="w-[85%]">
                                                    <ComplexDataRenderer value={item.value} field={item.field} />
                                                </div>
                                                
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 top-1/2 -translate-y-1/2"
                                                    onClick={() => handleEditStart(item.fieldName, item.value)}
                                                    title="Editar resposta"
                                                >
                                                    <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Other Data */}
                        {otherAnswers.length > 0 && (
                            <div className="mt-8">
                                <h4 className="text-sm font-bold mb-3 px-2 py-1 bg-muted rounded w-fit">Dados Adicionais</h4>
                                <div className="grid grid-cols-1 gap-4">
                                    {otherAnswers.map(([key, value], idx) => {
                                        const isEditing = editingKey === key;
                                        const isComplex = typeof value === "object" && value !== null;
                                        const displayValue = isComplex ? JSON.stringify(value) : String(value ?? "");

                                        return (
                                            <div key={idx} className="border-b pb-2 last:border-0 group relative pr-12">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                                    {key}
                                                </p>

                                                {isEditing ? (
                                                    <div className="flex gap-2 items-start mt-1">
                                                        {isComplex || editValue.length > 60 ? (
                                                            <Textarea 
                                                                value={editValue} 
                                                                onChange={(e) => setEditValue(e.target.value)} 
                                                                className="min-h-[80px] font-mono text-xs" 
                                                            />
                                                        ) : (
                                                            <Input 
                                                                value={editValue} 
                                                                onChange={(e) => setEditValue(e.target.value)} 
                                                                className="h-8 text-sm" 
                                                            />
                                                        )}
                                                        <div className="flex flex-col gap-1 shrink-0">
                                                            <Button size="icon" variant="default" className="h-8 w-8" onClick={() => handleSave(key)} disabled={isSaving}>
                                                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                                            </Button>
                                                            <Button size="icon" variant="outline" className="h-8 w-8" onClick={handleEditCancel} disabled={isSaving}>
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-between items-start mt-1 relative">
                                                        <div className="w-[85%]">
                                                            <ComplexDataRenderer value={value} />
                                                        </div>
                                                        
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 top-1/2 -translate-y-1/2"
                                                            onClick={() => handleEditStart(key, value)}
                                                            title="Editar resposta"
                                                        >
                                                            <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
