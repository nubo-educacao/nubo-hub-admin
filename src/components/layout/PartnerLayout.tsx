import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Navigate, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, Handshake } from "lucide-react";

export default function PartnerLayout() {
    const { session, loading, signOut } = useAuth();

    if (loading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!session) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="flex flex-col h-screen w-screen bg-background overflow-hidden">
            {/* Header */}
            <header className="flex h-16 items-center justify-between px-6 border-b bg-card shrink-0">
                <div className="flex items-center gap-3">
                    <Handshake className="h-6 w-6 text-primary" />
                    <span className="font-bold text-lg">Portal do Parceiro</span>
                </div>
                <Button
                    variant="ghost"
                    className="flex items-center gap-2 text-muted-foreground hover:text-destructive"
                    onClick={() => signOut()}
                >
                    <LogOut className="h-5 w-5" />
                    <span className="text-sm hidden sm:inline">Sair</span>
                </Button>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-auto p-4 md:p-8">
                <Outlet />
            </main>
        </div>
    );
}
