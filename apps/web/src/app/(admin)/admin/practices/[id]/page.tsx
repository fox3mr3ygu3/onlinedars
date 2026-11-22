import { PracticeEditor } from '@/features/admin/practices/PracticeEditor';

export default async function AdminPracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PracticeEditor practiceId={id} />;
}
