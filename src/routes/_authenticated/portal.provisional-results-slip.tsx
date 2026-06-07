import { createFileRoute } from '@tanstack/react-router';
import { StudentPortalShell } from '@/components/student-portal/StudentPortalShell';
import { PortalRequestForm } from '@/components/student-portal/PortalRequestForm';
import { requireStudentPortalUser } from '@/core/auth/student-portal';

export const Route = createFileRoute('/_authenticated/portal/provisional-results-slip')({
  beforeLoad: ({ context }) => requireStudentPortalUser(context.auth),
  component: ProvisionalResultsPage,
});

function ProvisionalResultsPage() {
  const { auth } = Route.useRouteContext();

  return (
    <StudentPortalShell
      title="Provisional results slip"
      description="View and request your provisional results slip."
    >
      <PortalRequestForm
        authUserId={auth.user?.id}
        requestType="provisional_results_slip"
        requestTypeLabel="Provisional results slip"
        instructions="Submit a request for a provisional results slip and the records office will process it."
        defaultSubject="Provisional results slip request"
      />
    </StudentPortalShell>
  );
}