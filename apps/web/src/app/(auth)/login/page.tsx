import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export async function generateMetadata() {
  const t = await getTranslations('auth');
  return { title: t('loginTitle') };
}

/** Static placeholder; frontend-public wires it to POST /auth/login with react-hook-form + zod. */
export default async function LoginPage() {
  const t = await getTranslations('auth');
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('loginTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="login">{t('loginPlaceholder')}</Label>
            <Input id="login" name="login" autoComplete="username" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">{t('password')}</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" />
          </div>
          <Button type="submit" disabled>
            {t('submitLogin')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
