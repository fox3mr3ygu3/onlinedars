import { AdminOnly } from '@/features/admin/layout/AdminShell';
import { SettingsPage } from '@/features/admin/settings/SettingsForm';

/** ADMIN only (the API enforces it; this hides the page for content managers). */
export default function AdminSettingsPage() {
  return (
    <AdminOnly>
      <SettingsPage />
    </AdminOnly>
  );
}
