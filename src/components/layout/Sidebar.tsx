import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
    LayoutDashboard,
    Users,
    ChevronLeft,
    ChevronRight,
    LogOut,
    MessageSquare,
    Sparkles,
    AlertCircle,
    UsersRound,
    UserCog,
    Handshake
} from "lucide-react";



import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

interface NavItemProps {
    to: string;
    icon: React.ElementType;
    label: string;
    collapsed: boolean;
    active: boolean;
}

const NavItem = ({ to, icon: Icon, label, collapsed, active }: NavItemProps) => (
    <Link
        to={to}
        className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            active ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground"
        )}
    >
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed && <span className="text-sm">{label}</span>}
    </Link>
);

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const { permissions, signOut } = useAuth();
    const location = useLocation();

    const navItems = [
        {
            to: "/",
            icon: LayoutDashboard,
            label: "Dashboard",
            permission: "Dashboard",
        },
        {
            to: "/conversas",
            icon: MessageSquare,
            label: "Conversas",
            permission: "Dashboard",
        },
        {
            to: "/ai-insights",
            icon: Sparkles,
            label: "Insights AI",
            permission: "Dashboard",
        },
        {
            to: "/errors",
            icon: AlertCircle,
            label: "Erros",
            permission: "Dashboard",
        },
        {
            to: "/influencers",
            icon: UsersRound,
            label: "Influencers",
            permission: "Dashboard",
        },
        {
            to: "/partners",
            icon: Handshake,
            label: "Parceiros",
            permission: "Dashboard",
        },
        {
            to: "/users",
            icon: UserCog,
            label: "Controle de Usuários",
            permission: "Controle de usuários",
        },

    ];



    const filteredItems = navItems.filter((item) =>
        permissions.includes(item.permission)
    );

    return (
        <div
            className={cn(
                "flex flex-col border-r bg-card transition-all duration-300 h-full",
                collapsed ? "w-16" : "w-64"
            )}
        >
            <div className="flex h-16 items-center justify-between px-4 border-b">
                {!collapsed && <span className="font-bold text-lg">Nubo Admin</span>}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCollapsed(!collapsed)}
                    className="h-8 w-8"
                >
                    {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
            </div>

            <nav className="flex-1 space-y-1 p-2">
                {filteredItems.map((item) => (
                    <NavItem
                        key={item.to}
                        to={item.to}
                        icon={item.icon}
                        label={item.label}
                        collapsed={collapsed}
                        active={location.pathname === item.to}
                    />
                ))}
            </nav>

            <div className="p-2 border-t">
                <Button
                    variant="ghost"
                    className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-muted-foreground hover:text-destructive",
                        collapsed ? "justify-center" : "justify-start"
                    )}
                    onClick={() => signOut()}
                >
                    <LogOut className="h-5 w-5" />
                    {!collapsed && <span className="text-sm">Sair</span>}
                </Button>
            </div>
        </div>
    );
}
