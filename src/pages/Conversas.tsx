import { Cloud, ArrowLeft, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChatExamplesPanel } from "@/components/analytics/ChatExamplesPanel";

export default function Conversas() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/">
                <Button variant="ghost" size="icon" className="shrink-0">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-chart-1 to-chart-2 text-primary-foreground shadow-glow">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-display tracking-tight">
                  Conversas Recentes
                </h1>
                <p className="text-sm text-muted-foreground">
                  Histórico de interações com usuários
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        <ChatExamplesPanel fullPage />
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-12">
        <div className="container text-center text-sm text-muted-foreground">
          <p>
            Cloudinha Analytics © {new Date().getFullYear()} • Powered by Lovable AI
          </p>
        </div>
      </footer>
    </div>
  );
}
