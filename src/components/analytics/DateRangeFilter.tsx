import { useState } from "react";
import { Calendar, ChevronDown, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const dateRanges = [
  { label: "Últimos 7 dias", value: "7d" },
  { label: "Últimos 14 dias", value: "14d" },
  { label: "Últimos 30 dias", value: "30d" },
  { label: "Últimos 90 dias", value: "90d" },
  { label: "Este ano", value: "year" },
];

const timeRanges = [
  { label: "Dia inteiro", value: "all" },
  { label: "Manhã (6h-12h)", value: "morning" },
  { label: "Tarde (12h-18h)", value: "afternoon" },
  { label: "Noite (18h-24h)", value: "evening" },
  { label: "Madrugada (0h-6h)", value: "night" },
];

interface DateRangeFilterProps {
  onDateChange?: (range: string) => void;
  onTimeChange?: (time: string) => void;
  onCustomDateChange?: (date: Date | undefined) => void;
  showTimeFilter?: boolean;
}

export function DateRangeFilter({ 
  onDateChange, 
  onTimeChange, 
  onCustomDateChange,
  showTimeFilter = true 
}: DateRangeFilterProps) {
  const [selectedRange, setSelectedRange] = useState(dateRanges[0]);
  const [selectedTime, setSelectedTime] = useState(timeRanges[0]);
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [showCustom, setShowCustom] = useState(false);

  const handleRangeSelect = (range: typeof dateRanges[0]) => {
    setSelectedRange(range);
    setShowCustom(false);
    setCustomDate(undefined);
    onDateChange?.(range.value);
  };

  const handleTimeSelect = (time: typeof timeRanges[0]) => {
    setSelectedTime(time);
    onTimeChange?.(time.value);
  };

  const handleCustomDateSelect = (date: Date | undefined) => {
    setCustomDate(date);
    if (date) {
      setShowCustom(true);
      onCustomDateChange?.(date);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Date Range Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2 font-medium">
            <Calendar className="h-4 w-4" />
            {showCustom && customDate 
              ? format(customDate, "dd/MM/yyyy", { locale: ptBR })
              : selectedRange.label
            }
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Período predefinido</DropdownMenuLabel>
          {dateRanges.map((range) => (
            <DropdownMenuItem
              key={range.value}
              onClick={() => handleRangeSelect(range)}
              className={cn(
                "cursor-pointer",
                selectedRange.value === range.value && !showCustom && "bg-accent"
              )}
            >
              {range.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Data específica</DropdownMenuLabel>
          <div className="p-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Calendar className="h-4 w-4 mr-2" />
                  {customDate 
                    ? format(customDate, "dd/MM/yyyy", { locale: ptBR })
                    : "Escolher data"
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={customDate}
                  onSelect={handleCustomDateSelect}
                  initialFocus
                  className="p-3 pointer-events-auto"
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Time Filter */}
      {showTimeFilter && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Clock className="h-4 w-4" />
              {selectedTime.label}
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Filtrar por horário</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {timeRanges.map((time) => (
              <DropdownMenuItem
                key={time.value}
                onClick={() => handleTimeSelect(time)}
                className={cn(
                  "cursor-pointer",
                  selectedTime.value === time.value && "bg-accent"
                )}
              >
                {time.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}