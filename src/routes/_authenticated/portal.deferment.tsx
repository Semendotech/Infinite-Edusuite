import { createFileRoute } from '@tanstack/react-router';
import { StudentPortalShell } from '@/components/student-portal/StudentPortalShell';
import { PortalRequestForm } from '@/components/student-portal/PortalRequestForm';
import { requireStudentPortalUser } from '@/core/auth/student-portal';

export const Route = createFileRoute('/_authenticated/portal/deferment')({
  beforeLoad: ({ context }) => requireStudentPortalUser(context.auth),
  component: DefermentPage,
});

function DefermentPage() {
  const { auth } = Route.useRouteContext();

  return (
    <StudentPortalShell
      title="Deferment"
      description="Submit a deferment request for your programme of study."
    >
      <PortalRequestForm
        authUserId={auth.user?.id}
        requestType="deferment"
        requestTypeLabel="Deferment"
        instructions="Submit a deferment request so the academic office can review your programme timeline."
        defaultSubject="Deferment request"
      />
    </StudentPortalShell>
  );
}