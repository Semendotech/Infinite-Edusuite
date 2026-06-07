import { createFileRoute } from '@tanstack/react-router';
import { StudentPortalShell } from '@/components/student-portal/StudentPortalShell';
import { PortalRequestForm } from '@/components/student-portal/PortalRequestForm';
import { requireStudentPortalUser } from '@/core/auth/student-portal';

export const Route = createFileRoute('/_authenticated/portal/special-exam-registration')({
  beforeLoad: ({ context }) => requireStudentPortalUser(context.auth),
  component: SpecialExamPage,
});

function SpecialExamPage() {
  const { auth } = Route.useRouteContext();

  return (
    <StudentPortalShell
      title="Special exam registration"
      description="Apply to sit a special examination."
    >
      <PortalRequestForm
        authUserId={auth.user?.id}
        requestType="special_exam_registration"
        requestTypeLabel="Special exam registration"
        instructions="Apply to sit a special examination and provide all required course details."
        defaultSubject="Special exam registration request"
      />
    </StudentPortalShell>
  );
}