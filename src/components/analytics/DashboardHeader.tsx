import { Cloud, RefreshCw, Settings, Sparkles } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DateRangeFilter } from "./DateRangeFilter";

export function DashboardHeader() {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border">
      <div className="container py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-chart-2 text-primary-foreground shadow-glow">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display tracking-tight">
                Cloudinha Analytics
              </h1>
              <p className="text-sm text-muted-foreground">
                Monitoramento e insights
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/ai-insights">
              <Button
                variant={location.pathname === "/ai-insights" ? "default" : "outline"}
                size="sm"
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Insights AI
              </Button>
            </Link>
            <DateRangeFilter />
            <Button variant="outline" size="icon" className="shrink-0">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="shrink-0">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
