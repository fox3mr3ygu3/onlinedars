import { CertificateTemplateEditor } from '@/features/admin/certificates/Certificates';

export default async function AdminCertificateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CertificateTemplateEditor templateId={id} />;
}
