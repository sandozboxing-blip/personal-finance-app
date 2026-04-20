import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn, formatMonthYear, getMonthNames } from '@/lib/utils';
import { useState } from 'react';

interface MonthYearPickerProps {
  value: { year: number; month: number };
  onChange: (year: number, month: number) => void;
}

export function MonthYearPicker({ value, onChange }: MonthYearPickerProps) {
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(value.year);
  const monthShort = getMonthNames();

  const prev = () => {
    const m = value.month === 1 ? 12 : value.month - 1;
    const y = value.month === 1 ? value.year - 1 : value.year;
    onChange(y, m);
  };

  const next = () => {
    const m = value.month === 12 ? 1 : value.month + 1;
    const y = value.month === 12 ? value.year + 1 : value.year;
    onChange(y, m);
  };

  const selectMonth = (m: number) => {
    onChange(pickerYear, m);
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" onClick={prev} className="h-7 w-7">
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" className="h-7 px-3 text-sm font-medium min-w-[120px]">
            {formatMonthYear(value.year, value.month)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3">
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPickerYear(y => y - 1)}>
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span className="text-sm font-medium">{pickerYear}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPickerYear(y => y + 1)}>
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {monthShort.map((name, i) => {
              const m = i + 1;
              const isSelected = pickerYear === value.year && m === value.month;
              return (
                <Button
                  key={m}
                  variant="ghost"
                  size="sm"
                  onClick={() => selectMonth(m)}
                  className={cn('h-7 text-xs', isSelected && 'bg-zinc-700 text-white')}
                >
                  {name}
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      <Button variant="ghost" size="icon" onClick={next} className="h-7 w-7">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
