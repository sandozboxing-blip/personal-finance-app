import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Bank = 'revolut' | 'santander' | 'fibank' | 'manual';

const BANK_STYLES: Record<Bank, string> = {
  revolut: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  santander: 'bg-red-500/20 text-red-400 border-red-500/30',
  fibank: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  manual: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

const BANK_LABELS: Record<Bank, string> = {
  revolut: 'Revolut',
  santander: 'Santander',
  fibank: 'Fibank',
  manual: 'Manual',
};

interface BankBadgeProps {
  bank: Bank;
}

export function BankBadge({ bank }: BankBadgeProps) {
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', BANK_STYLES[bank])}>
      {BANK_LABELS[bank]}
    </Badge>
  );
}
