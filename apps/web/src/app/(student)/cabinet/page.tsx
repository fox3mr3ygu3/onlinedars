import { getTranslations } from 'next-intl/server';

export default async function CabinetPage() {
  const t = await getTranslations('cabinet');
  return <h1 className="text-2xl font-semibold">{t('title')}</h1>;
}
