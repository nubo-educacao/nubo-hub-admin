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
    if (!application) return null;

    const answers = (application.answers as Record<string, unknown>) || {};
    
    // Identified fields from partner_forms
    const structuredAnswers = formFields.map(field => ({
        label: field.question_text || field.field_name,
        value: answers[field.field_name],
        fieldName: field.field_name
    }));

    // Fields in answers that are NOT in partner_forms
    const otherAnswers = Object.entries(answers).filter(
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
                            {structuredAnswers.map((item, idx) => (
                                <div key={idx} className="border-b pb-2 last:border-0">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        {item.label}
                                    </p>
                                    <p className="mt-1 text-sm">
                                        {item.value != null ? String(item.value) : <span className="text-muted-foreground italic">Não preenchido</span>}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* Other Data */}
                        {otherAnswers.length > 0 && (
                            <div className="mt-8">
                                <h4 className="text-sm font-bold mb-3 px-2 py-1 bg-muted rounded w-fit">Dados Adicionais</h4>
                                <div className="grid grid-cols-1 gap-4">
                                    {otherAnswers.map(([key, value], idx) => (
                                        <div key={idx} className="border-b pb-2 last:border-0">
                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                {key}
                                            </p>
                                            <p className="mt-1 text-sm">
                                                {value != null ? String(value) : "—"}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
