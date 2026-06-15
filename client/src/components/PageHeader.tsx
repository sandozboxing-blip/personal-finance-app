import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, children, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col items-start gap-3 pb-4 border-b border-zinc-800 mb-6 sm:flex-row sm:items-center sm:justify-between', className)}>
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
