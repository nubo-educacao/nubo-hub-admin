import { useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const dateRanges = [
  { label: "Últimos 7 dias", value: "7d" },
  { label: "Últimos 14 dias", value: "14d" },
  { label: "Últimos 30 dias", value: "30d" },
  { label: "Últimos 90 dias", value: "90d" },
  { label: "Este ano", value: "year" },
];

export function DateRangeFilter() {
  const [selected, setSelected] = useState(dateRanges[0]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 font-medium">
          <Calendar className="h-4 w-4" />
          {selected.label}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {dateRanges.map((range) => (
          <DropdownMenuItem
            key={range.value}
            onClick={() => setSelected(range)}
            className="cursor-pointer"
          >
            {range.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
