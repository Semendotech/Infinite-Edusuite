import { createFileRoute } from '@tanstack/react-router';
import { StudentPortalShell } from '@/components/student-portal/StudentPortalShell';
import { PortalRequestForm } from '@/components/student-portal/PortalRequestForm';
import { requireStudentPortalUser } from '@/core/auth/student-portal';

export const Route = createFileRoute('/_authenticated/portal/resit-exams')({
  beforeLoad: ({ context }) => requireStudentPortalUser(context.auth),
  component: ResitExamsPage,
});

function ResitExamsPage() {
  const { auth } = Route.useRouteContext();

  return (
    <StudentPortalShell
      title="Resit exams registration"
      description="Register for resit examinations."
    >
      <PortalRequestForm
        authUserId={auth.user?.id}
        requestType="resit_exams"
        requestTypeLabel="Resit exams"
        instructions="Request registration for resit examinations and provide the course details you are appealing."
        defaultSubject="Resit exam registration request"
      />
    </StudentPortalShell>
  );
}