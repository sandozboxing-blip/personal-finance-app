import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, children, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between pb-4 border-b border-zinc-800 mb-6', className)}>
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
