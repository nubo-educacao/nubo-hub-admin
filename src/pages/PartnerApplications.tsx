import { Loader2 } from "lucide-react";

export default function PartnerApplications() {
    return (
        <div className="container mx-auto space-y-8 p-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Aplicações</h1>
                <p className="text-muted-foreground">
                    Visualize as aplicações dos estudantes para os parceiros.
                </p>
            </div>

            <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed">
                <p className="text-muted-foreground">Em breve...</p>
            </div>
        </div>
    );
}
