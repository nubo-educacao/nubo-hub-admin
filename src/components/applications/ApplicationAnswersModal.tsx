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
        fieldName: field.field_name
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
                                            <div className="flex justify-between items-start mt-1">
                                                <p className="text-sm">
                                                    {item.value != null ? (
                                                        isComplex ? <span className="font-mono text-xs bg-muted p-1 rounded break-all">{displayValue}</span> : displayValue
                                                    ) : (
                                                        <span className="text-muted-foreground italic">Não preenchido</span>
                                                    )}
                                                </p>
                                                
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
                                                    <div className="flex justify-between items-start mt-1">
                                                        <p className="text-sm">
                                                            {value != null ? (
                                                                isComplex ? <span className="font-mono text-xs bg-muted p-1 rounded break-all">{displayValue}</span> : displayValue
                                                            ) : (
                                                                "—"
                                                            )}
                                                        </p>
                                                        
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
