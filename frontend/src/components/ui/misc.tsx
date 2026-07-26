import { AVATAR_TONES, cn, initials } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded bg-rule/70', className)}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-4',
        className
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({
  name,
  color = 'dusk',
  size = 'md',
  className,
}: {
  name?: string;
  color?: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}) {
  const sizes = { xs: 'h-5 w-5 text-[9px]', sm: 'h-6 w-6 text-[10px]', md: 'h-8 w-8 text-[11px]' };
  return (
    <span
      title={name}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        AVATAR_TONES[color] || AVATAR_TONES.dusk,
        sizes[size],
        className
      )}
    >
      {initials(name)}
    </span>
  );
}

export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-rule-strong bg-surface/60 px-6 py-14 text-center',
        className
      )}
    >
      <h3 className="font-display text-lg text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-muted">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
