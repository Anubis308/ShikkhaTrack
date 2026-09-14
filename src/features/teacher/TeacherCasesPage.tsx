import { CaseInboxPage } from "../cases/CaseInboxPage";

export function TeacherCasesPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <CaseInboxPage
      onNavigate={onNavigate}
      subtitle="Academic cases for your batch only. Fee, scholarship, hardship, and other batches are hidden."
      title="Batch academic cases"
    />
  );
}
