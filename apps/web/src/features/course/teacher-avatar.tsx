import { cn } from '@/lib/utils';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function TeacherAvatar({
  name,
  photoUrl,
  className,
}: {
  name: string;
  photoUrl: string | null;
  className?: string;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        loading="lazy"
        className={cn('size-12 shrink-0 rounded-full object-cover', className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        'bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-full font-semibold',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
