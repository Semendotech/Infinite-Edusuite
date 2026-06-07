import { cn } from '@/lib/utils';

type PoweredByProps = {
  className?: string;
};

export function PoweredBy({ className }: PoweredByProps) {
  return (
    <p className={cn('text-xs text-muted-foreground', className)}>
      Powered by{' '}
      <span className="font-medium text-foreground/80">Infinite Digital Solutions KE</span>
    </p>
  );
}