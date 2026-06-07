import { createFileRoute } from '@tanstack/react-router';
import { StudentPortalShell } from '@/components/student-portal/StudentPortalShell';
import { PortalRequestForm } from '@/components/student-portal/PortalRequestForm';
import { requireStudentPortalUser } from '@/core/auth/student-portal';

export const Route = createFileRoute('/_authenticated/portal/withdrawal')({
  beforeLoad: ({ context }) => requireStudentPortalUser(context.auth),
  component: WithdrawalPage,
});

function WithdrawalPage() {
  const { auth } = Route.useRouteContext();

  return (
    <StudentPortalShell
      title="Withdrawal"
      description="Submit a withdrawal request from your programme."
    >
      <PortalRequestForm
        authUserId={auth.user?.id}
        requestType="withdrawal"
        requestTypeLabel="Withdrawal"
        instructions="Submit a withdrawal request to the registrar. Your student profile and branch context are attached automatically."
        defaultSubject="Programme withdrawal request"
      />
    </StudentPortalShell>
  );
}