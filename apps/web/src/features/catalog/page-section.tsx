import { AlertCircle, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-6xl px-4', className)}>{children}</div>;
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="bg-muted/40 border-b">
      <Container className="py-8 sm:py-12">
        <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-2 max-w-2xl">{subtitle}</p>}
      </Container>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
      <Inbox className="size-8" aria-hidden />
      <p>{children}</p>
    </div>
  );
}

export function ErrorState({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="border-destructive/30 bg-destructive/5 text-destructive flex items-center gap-3 rounded-xl border px-4 py-4"
    >
      <AlertCircle className="size-5 shrink-0" aria-hidden />
      <p className="text-sm">{children}</p>
    </div>
  );
}
