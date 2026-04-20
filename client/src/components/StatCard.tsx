import { Card, CardContent } from '@/components/ui/card';
import { cn, formatCurrency } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: number;
  diff?: number;
  className?: string;
}

export function StatCard({ label, value, diff, className }: StatCardProps) {
  return (
    <Card className={cn('p-4', className)}>
      <CardContent className="p-0">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-400 mb-1">{label}</p>
        <p className="font-mono text-2xl tabular-nums text-right">{formatCurrency(value)}</p>
        {diff !== undefined && (
          <p className={cn('font-mono text-xs text-right tabular-nums mt-1',
            diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-rose-500' : 'text-zinc-400'
          )}>
            {diff > 0 ? '+' : ''}{formatCurrency(diff)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
