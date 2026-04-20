import { Progress } from '@/components/ui/progress';
import { cn, formatCurrency } from '@/lib/utils';

interface BudgetBarProps {
  label: string;
  planned: number;
  actual: number;
}

export function BudgetBar({ label, planned, actual }: BudgetBarProps) {
  const pct = planned > 0 ? Math.min((actual / planned) * 100, 100) : 0;
  const over = planned > 0 && actual > planned;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <span className="font-mono tabular-nums">
          <span className={cn(over ? 'text-rose-500' : 'text-white')}>{formatCurrency(actual)}</span>
          <span className="text-zinc-600"> / </span>
          <span>{formatCurrency(planned)}</span>
        </span>
      </div>
      <Progress
        value={pct}
        indicatorClassName={over ? 'bg-rose-500' : 'bg-emerald-500'}
        className="h-1.5"
      />
    </div>
  );
}
