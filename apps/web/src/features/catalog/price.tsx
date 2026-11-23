import { useTranslations } from 'next-intl';
import { formatSom } from '@/lib/utils';
import { cn } from '@/lib/utils';

/** "Bepul" or "1 250 000 so'm". Works in server and client components. */
export function Price({
  isFree,
  price,
  className,
}: {
  isFree: boolean;
  price: number;
  className?: string;
}) {
  const t = useTranslations('common');
  if (isFree || price === 0) {
    return <span className={cn('font-semibold text-emerald-600', className)}>{t('free')}</span>;
  }
  return (
    <span className={cn('font-semibold', className)}>
      {formatSom(price)} {t('som')}
    </span>
  );
}
