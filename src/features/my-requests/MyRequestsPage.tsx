import { CaseInboxPage } from "../cases/CaseInboxPage";

export function MyRequestsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <CaseInboxPage
      onNavigate={onNavigate}
      subtitle="Only your own requests and replies. Staff will follow up here."
      title="My requests"
    />
  );
}
