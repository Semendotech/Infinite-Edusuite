import { createFileRoute } from '@tanstack/react-router';
import { StudentPortalShell } from '@/components/student-portal/StudentPortalShell';
import { PortalRequestForm } from '@/components/student-portal/PortalRequestForm';
import { requireStudentPortalUser } from '@/core/auth/student-portal';

export const Route = createFileRoute('/_authenticated/portal/graduation-clearance')({
  beforeLoad: ({ context }) => requireStudentPortalUser(context.auth),
  component: GraduationClearancePage,
});

function GraduationClearancePage() {
  const { auth } = Route.useRouteContext();

  return (
    <StudentPortalShell
      title="Graduation clearance"
      description="Track and complete your graduation clearance requirements."
    >
      <PortalRequestForm
        authUserId={auth.user?.id}
        requestType="graduation_clearance"
        requestTypeLabel="Graduation clearance"
        instructions="Submit a graduation clearance request to confirm your final academic standing and exit requirements."
        defaultSubject="Graduation clearance request"
      />
    </StudentPortalShell>
  );
}