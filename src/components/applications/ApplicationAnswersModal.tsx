import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import type { ApplicationWithDetails } from "@/services/applicationsService";

interface ApplicationAnswersModalProps {
    application: ApplicationWithDetails | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function ApplicationAnswersModal({
    application,
    open,
    onOpenChange,
}: ApplicationAnswersModalProps) {
    if (!application) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Respostas — {application.full_name || "Estudante"}</DialogTitle>
                    <DialogDescription>
                        Dados da candidatura enviada pelo estudante.
                    </DialogDescription>
                </DialogHeader>
                <div className="mt-4 rounded-md bg-muted p-4 overflow-x-auto">
                    <pre className="text-sm whitespace-pre-wrap break-words font-mono">
                        {JSON.stringify(application.answers, null, 2)}
                    </pre>
                </div>
            </DialogContent>
        </Dialog>
    );
}
