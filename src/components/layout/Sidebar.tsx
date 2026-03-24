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
    Handshake,
    GraduationCap,
    PieChart,
    CalendarDays,
    Bot,
    ChevronDown,
    Ticket,
    ClipboardList,
    FileText,
    FolderOpen,
    BookOpen,
    Library
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
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
        Cloudinha: false,
        Passaporte: false,
        "Dados Educacionais": false,
    });
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
            label: "Cloudinha",
            icon: Bot,
            permission: "Cloudinha", // We might need to check if this permission exists or use one from sub-items
            isGroup: true,
            items: [
                {
                    to: "/conversas",
                    icon: MessageSquare,
                    label: "Conversas",
                    permission: "Conversas",
                },
                {
                    to: "/ai-insights",
                    icon: Sparkles,
                    label: "Insights AI",
                    permission: "Insights AI",
                },
                {
                    to: "/errors",
                    icon: AlertCircle,
                    label: "Erros",
                    permission: "Erros",
                },
                {
                    to: "/knowledge",
                    icon: BookOpen,
                    label: "Conhecimento",
                    permission: "Conhecimento",
                },
            ]
        },
        {
            label: "Passaporte",
            icon: Ticket,
            permission: "Parceiros",
            isGroup: true,
            items: [
                {
                    to: "/passport-dashboard",
                    icon: LayoutDashboard,
                    label: "Dashboard",
                    permission: "Parceiros",
                },
                {
                    to: "/funnel-users",
                    icon: PieChart,
                    label: "Funil de Conversão",
                    permission: "Parceiros",
                },
                {
                    to: "/partners",
                    icon: Handshake,
                    label: "Parceiros",
                    permission: "Parceiros",
                },
                {
                    to: "/solicitations",
                    icon: ClipboardList,
                    label: "Solicitações",
                    permission: "Parceiros",
                },
                {
                    to: "/forms",
                    icon: FileText,
                    label: "Formulários",
                    permission: "Parceiros",
                },
                {
                    to: "/partners-users",
                    icon: Users,
                    label: "Usuários",
                    permission: "Parceiros",
                },
                {
                    to: "/applications",
                    icon: FolderOpen,
                    label: "Candidaturas",
                    permission: "Parceiros",
                },
            ]
        },
        {
            to: "/students",
            icon: GraduationCap,
            label: "Estudantes",
            permission: "Estudantes",
        },
        {
            to: "/influencers",
            icon: UsersRound,
            label: "Influencers",
            permission: "Influencers",
        },
        {
            to: "/calendar",
            icon: CalendarDays,
            label: "Calendário",
            permission: "Calendário",
        },
        {
            to: "/sean-ellis",
            icon: PieChart,
            label: "Sean Ellis Score",
            permission: "Sean Ellis Score",
        },
        {
            label: "Dados Educacionais",
            icon: Library,
            permission: "Dashboard", // Usamos Dashboard ou criamos uma no futuro. Como admin tem acesso total, deve funcionar provisoriamente.
            isGroup: true,
            items: [
                {
                    to: "/educational/institutions",
                    icon: GraduationCap,
                    label: "Instituições",
                    permission: "Dashboard",
                },
                {
                    to: "/educational/campus",
                    icon: LayoutDashboard,
                    label: "Campus",
                    permission: "Dashboard",
                },
                {
                    to: "/educational/courses",
                    icon: BookOpen,
                    label: "Cursos",
                    permission: "Dashboard",
                },
                {
                    to: "/educational/opportunities",
                    icon: ClipboardList,
                    label: "Oportunidades",
                    permission: "Dashboard",
                },
            ]
        },
        {
            to: "/users",
            icon: UserCog,
            label: "Controle de Usuários",
            permission: "Controle de usuários",
        },
    ];

    const toggleGroup = (label: string) => {
        if (collapsed) return;
        setOpenGroups(prev => ({
            ...prev,
            [label]: !prev[label]
        }));
    };

    // Check if user has permission for at least one item in the group
    const hasGroupPermission = (group: any) => {
        return group.items.some((item: any) => permissions.includes(item.permission));
    };

    const renderNavItem = (item: any) => {
        if (item.isGroup) {
            const allowedItems = item.items.filter((subItem: any) =>
                permissions.includes(subItem.permission)
            );

            if (allowedItems.length === 0) return null;

            const isChildActive = allowedItems.some((subItem: any) => location.pathname === subItem.to);
            const isOpen = openGroups[item.label] ?? false;

            return (
                <div key={item.label} className="space-y-1">
                    <button
                        onClick={() => toggleGroup(item.label)}
                        className={cn(
                            "w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-colors",
                            isChildActive
                                ? "text-primary font-medium"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <item.icon className={cn("h-5 w-5 shrink-0", isChildActive && "text-primary")} />
                            {!collapsed && <span className="text-sm">{item.label}</span>}
                        </div>
                        {!collapsed && (
                            <ChevronDown className={cn(
                                "h-4 w-4 transition-transform",
                                isOpen ? "transform rotate-0" : "transform -rotate-90"
                            )} />
                        )}
                    </button>
                    {!collapsed && isOpen && (
                        <div className="pl-6 space-y-1 border-l ml-5 border-border/50">
                            {allowedItems.map((subItem: any) => (
                                <NavItem
                                    key={subItem.to}
                                    to={subItem.to}
                                    icon={subItem.icon}
                                    label={subItem.label}
                                    collapsed={collapsed}
                                    active={location.pathname === subItem.to}
                                />
                            ))}
                        </div>
                    )}
                </div>
            );
        }

        if (!permissions.includes(item.permission)) return null;

        return (
            <NavItem
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={item.label}
                collapsed={collapsed}
                active={location.pathname === item.to}
            />
        );
    };

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

            <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
                {navItems.map(renderNavItem)}
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
