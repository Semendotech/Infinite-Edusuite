import { createFileRoute } from '@tanstack/react-router';
import { StudentPortalShell } from '@/components/student-portal/StudentPortalShell';
import { PortalRequestForm } from '@/components/student-portal/PortalRequestForm';
import { requireStudentPortalUser } from '@/core/auth/student-portal';

export const Route = createFileRoute('/_authenticated/portal/provisional-transcript')({
  beforeLoad: ({ context }) => requireStudentPortalUser(context.auth),
  component: ProvisionalTranscriptPage,
});

function ProvisionalTranscriptPage() {
  const { auth } = Route.useRouteContext();

  return (
    <StudentPortalShell
      title="Provisional transcript"
      description="View and request your provisional transcript."
    >
      <PortalRequestForm
        authUserId={auth.user?.id}
        requestType="provisional_transcript"
        requestTypeLabel="Provisional transcript"
        instructions="Submit a provisional transcript request and the academic office will prepare it for review."
        defaultSubject="Provisional transcript request"
      />
    </StudentPortalShell>
  );
}