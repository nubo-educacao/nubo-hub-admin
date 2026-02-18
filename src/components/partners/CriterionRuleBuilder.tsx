import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Condition {
    id: string;
    operator: string;
    value: string;
}

type Combinator = "and" | "or";

interface CriterionRuleBuilderProps {
    fieldName: string;
    value: string; // JSON Logic string
    onChange: (jsonLogicString: string) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const OPERATORS = [
    { value: "==", label: "Igual a" },
    { value: "!=", label: "Diferente de" },
    { value: "<", label: "Menor que" },
    { value: "<=", label: "Menor ou igual a" },
    { value: ">", label: "Maior que" },
    { value: ">=", label: "Maior ou igual a" },
    { value: "in", label: "Está na lista" },
];

// ─── JSON Logic Helpers ──────────────────────────────────────────────────────

function generateId() {
    return Math.random().toString(36).slice(2, 9);
}

function conditionsToJsonLogic(
    conditions: Condition[],
    combinator: Combinator,
    fieldName: string
): Record<string, unknown> | null {
    if (conditions.length === 0) return null;

    const rules = conditions
        .filter((c) => c.value !== "")
        .map((c) => {
            const varRef = { var: fieldName };
            let parsedValue: unknown = c.value;

            // Try to parse as number
            const num = Number(c.value);
            if (!isNaN(num) && c.value.trim() !== "") {
                parsedValue = num;
            }

            // "in" operator: value is a comma-separated list
            if (c.operator === "in") {
                const list = c.value.split(",").map((v) => {
                    const trimmed = v.trim();
                    const n = Number(trimmed);
                    return !isNaN(n) && trimmed !== "" ? n : trimmed;
                });
                return { in: [varRef, list] };
            }

            return { [c.operator]: [varRef, parsedValue] };
        });

    if (rules.length === 0) return null;
    if (rules.length === 1) return rules[0];
    return { [combinator]: rules };
}

function jsonLogicToConditions(
    jsonLogic: Record<string, unknown> | null,
    fieldName: string
): { conditions: Condition[]; combinator: Combinator } {
    if (!jsonLogic || typeof jsonLogic !== "object") {
        return { conditions: [{ id: generateId(), operator: "==", value: "" }], combinator: "and" };
    }

    // Check if it's a combinator (AND/OR)
    if ("and" in jsonLogic && Array.isArray(jsonLogic.and)) {
        const conditions = (jsonLogic.and as Record<string, unknown>[]).map(parseCondition);
        return { conditions, combinator: "and" };
    }
    if ("or" in jsonLogic && Array.isArray(jsonLogic.or)) {
        const conditions = (jsonLogic.or as Record<string, unknown>[]).map(parseCondition);
        return { conditions, combinator: "or" };
    }

    // Single condition
    return { conditions: [parseCondition(jsonLogic)], combinator: "and" };
}

function parseCondition(rule: Record<string, unknown>): Condition {
    const id = generateId();

    for (const op of ["==", "!=", "<", "<=", ">", ">="]) {
        if (op in rule && Array.isArray(rule[op])) {
            const args = rule[op] as unknown[];
            const value = args.length > 1 ? String(args[1]) : "";
            return { id, operator: op, value };
        }
    }

    if ("in" in rule && Array.isArray(rule.in)) {
        const args = rule.in as unknown[];
        const list = args.length > 1 && Array.isArray(args[1]) ? args[1] : [];
        return { id, operator: "in", value: list.join(", ") };
    }

    return { id, operator: "==", value: "" };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CriterionRuleBuilder({ fieldName, value, onChange }: CriterionRuleBuilderProps) {
    const [combinator, setCombinator] = useState<Combinator>("and");
    const [conditions, setConditions] = useState<Condition[]>([
        { id: generateId(), operator: "==", value: "" },
    ]);
    const [initialized, setInitialized] = useState(false);

    // Parse incoming JSON Logic value into conditions + combinator
    useEffect(() => {
        if (initialized) return;
        try {
            if (value) {
                const parsed = JSON.parse(value);
                const result = jsonLogicToConditions(parsed, fieldName);
                setConditions(result.conditions.length > 0 ? result.conditions : [{ id: generateId(), operator: "==", value: "" }]);
                setCombinator(result.combinator);
            }
        } catch {
            // Invalid JSON, keep defaults
        }
        setInitialized(true);
    }, [value, fieldName, initialized]);

    // Emit JSON Logic whenever conditions or combinator change
    const emitChange = useCallback(
        (newConditions: Condition[], newCombinator: Combinator) => {
            const jsonLogic = conditionsToJsonLogic(newConditions, newCombinator, fieldName);
            onChange(jsonLogic ? JSON.stringify(jsonLogic) : "");
        },
        [fieldName, onChange]
    );

    // Sync if fieldName changes externally
    useEffect(() => {
        if (initialized) {
            emitChange(conditions, combinator);
        }
    }, [fieldName, initialized, emitChange, conditions, combinator]);

    const updateCondition = (id: string, updates: Partial<Condition>) => {
        const next = conditions.map((c) => (c.id === id ? { ...c, ...updates } : c));
        setConditions(next);
        emitChange(next, combinator);
    };

    const addCondition = () => {
        const next = [...conditions, { id: generateId(), operator: "==", value: "" }];
        setConditions(next);
        emitChange(next, combinator);
    };

    const removeCondition = (id: string) => {
        if (conditions.length <= 1) return;
        const next = conditions.filter((c) => c.id !== id);
        setConditions(next);
        emitChange(next, combinator);
    };

    const toggleCombinator = () => {
        const next: Combinator = combinator === "and" ? "or" : "and";
        setCombinator(next);
        emitChange(conditions, next);
    };

    // Build preview
    const jsonLogic = conditionsToJsonLogic(conditions, combinator, fieldName || "campo");
    const previewJson = jsonLogic ? JSON.stringify(jsonLogic, null, 2) : "—";

    return (
        <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Regra de Elegibilidade</Label>
                {conditions.length > 1 && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={toggleCombinator}
                        className="h-7 text-xs gap-1"
                    >
                        Combinar com:
                        <span className={cn(
                            "font-bold",
                            combinator === "and" ? "text-blue-600" : "text-amber-600"
                        )}>
                            {combinator === "and" ? "E (AND)" : "OU (OR)"}
                        </span>
                    </Button>
                )}
            </div>

            {/* Conditions */}
            <div className="space-y-2">
                {conditions.map((condition, idx) => (
                    <div key={condition.id}>
                        {/* Combinator pill between conditions */}
                        {idx > 0 && (
                            <div className="flex justify-center py-1">
                                <span className={cn(
                                    "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                    combinator === "and"
                                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                )}>
                                    {combinator === "and" ? "E" : "OU"}
                                </span>
                            </div>
                        )}

                        {/* Condition Row */}
                        <div className="flex items-center gap-2 rounded-md border bg-background p-2">
                            {/* Field name (read-only, auto from context) */}
                            <div className="flex items-center h-9 px-3 rounded-md border bg-muted text-sm text-muted-foreground min-w-[80px] shrink-0">
                                {fieldName || "campo"}
                            </div>

                            {/* Operator */}
                            <Select
                                value={condition.operator}
                                onValueChange={(val) => updateCondition(condition.id, { operator: val })}
                            >
                                <SelectTrigger className="w-[160px] shrink-0">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {OPERATORS.map((op) => (
                                        <SelectItem key={op.value} value={op.value}>
                                            {op.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Value */}
                            <Input
                                placeholder={condition.operator === "in" ? "val1, val2, val3" : "Valor"}
                                value={condition.value}
                                onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                                className="flex-1"
                            />

                            {/* Remove */}
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="shrink-0 h-9 w-9"
                                onClick={() => removeCondition(condition.id)}
                                disabled={conditions.length <= 1}
                            >
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Condition */}
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCondition}
                className="gap-1 w-full"
            >
                <Plus className="h-3.5 w-3.5" />
                Adicionar Condição
            </Button>

            {/* JSON Preview */}
            <details className="group">
                <summary className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                    Preview JSON Logic
                </summary>
                <pre className="mt-1 p-2 rounded bg-muted text-xs font-mono overflow-x-auto max-h-24">
                    {previewJson}
                </pre>
            </details>
        </div>
    );
}
