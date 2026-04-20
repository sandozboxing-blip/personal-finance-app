import { cn, formatCurrency } from '@/lib/utils';
import type { AllocationData } from '@/lib/types';

interface AllocationBreakdownProps {
  current: AllocationData;
  previous: AllocationData;
}

type Row = { label: string; key: keyof AllocationData; isDifference?: boolean };

const ROWS: Row[] = [
  { label: 'Living costs', key: 'living_costs' },
  { label: 'Extra costs', key: 'extra_costs' },
  { label: 'Necessary allowance', key: 'necessary_allowance' },
  { label: 'Allowance (f)', key: 'allowance_f' },
  { label: 'Difference', key: 'difference', isDifference: true },
];

export function AllocationBreakdown({ current, previous }: AllocationBreakdownProps) {
  return (
    <div className="text-sm">
      <div className="grid grid-cols-4 gap-2 text-xs text-zinc-400 uppercase tracking-wider pb-2 border-b border-zinc-800 mb-1">
        <span className="col-span-1">Allocation</span>
        <span className="text-right font-mono">Previous</span>
        <span className="text-right font-mono">Actual</span>
        <span className="text-right font-mono">Diff</span>
      </div>

      {ROWS.map(({ label, key, isDifference }) => {
        const cur = current[key];
        const prev = previous[key];
        const diff = cur - prev;
        const isNeg = cur < 0;

        return (
          <div
            key={key}
            className={cn(
              'grid grid-cols-4 gap-2 py-1.5 px-2 -mx-2 rounded',
              isDifference && (cur < 0 ? 'bg-rose-500/10' : cur > 0 ? 'bg-emerald-500/10' : '')
            )}
          >
            <span className={cn('col-span-1 font-medium', isDifference && (cur < 0 ? 'text-rose-400' : cur > 0 ? 'text-emerald-400' : 'text-zinc-300'))}>
              {label}
            </span>
            <span className="text-right font-mono tabular-nums text-zinc-400 text-xs">{formatCurrency(prev)}</span>
            <span className={cn('text-right font-mono tabular-nums text-xs',
              isDifference ? (isNeg ? 'text-rose-400' : 'text-emerald-400') : 'text-zinc-200'
            )}>
              {isDifference && cur > 0 ? '+' : ''}{isNeg ? '-' : ''}{formatCurrency(Math.abs(cur))}
            </span>
            <span className={cn('text-right font-mono tabular-nums text-xs',
              diff === 0 ? 'text-zinc-400' : diff > 0 ? 'text-emerald-500' : 'text-rose-500'
            )}>
              {diff > 0 ? '+' : ''}{formatCurrency(diff)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
