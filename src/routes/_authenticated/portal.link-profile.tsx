import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { claimStudentProfile } from '@/app/server-functions/students';
import { StudentPortalShell } from '@/components/student-portal/StudentPortalShell';
import { requireStudentPortalUser } from '@/core/auth/student-portal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export const Route = createFileRoute('/_authenticated/portal/link-profile')({
  head: () => ({ meta: [{ title: 'Link student profile — Infinite EduSuite' }] }),
  beforeLoad: ({ context }) => requireStudentPortalUser(context.auth),
  component: LinkProfilePage,
});

function LinkProfilePage() {
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [serverMessage, setServerMessage] = useState('');

  async function handleSubmit() {
    setServerMessage('');
    if (!registrationNumber.trim()) {
      setServerMessage('Enter your registration number to continue.');
      return;
    }

    setBusy(true);
    try {
      const response = await claimStudentProfile({ registrationNumber: registrationNumber.trim() });
      if (!response.success) {
        throw new Error(response.error?.message ?? 'Unable to submit profile claim.');
      }

      toast.success('Profile link request submitted successfully.');
      setServerMessage('Your student profile is now linked. Refresh the portal to continue.');
      setRegistrationNumber('');
    } catch (error) {
      setServerMessage(error instanceof Error ? error.message : 'Unable to submit profile claim.');
      toast.error(error instanceof Error ? error.message : 'Unable to submit profile claim.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <StudentPortalShell
      title="Link student profile"
      description="Submit your registration number so we can attach your portal account to your student record."
    >
      <Card>
        <CardHeader>
          <CardTitle>Claim your student profile</CardTitle>
          <CardDescription>
            If your account is already enrolled, we will link your portal access to the student registry.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Enter the registration number shown on your admission or tuition documents. This helps us match your account to the existing student record.
              </p>
              <Input
                value={registrationNumber}
                onChange={(event) => setRegistrationNumber(event.target.value)}
                placeholder="Registration number"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleSubmit} disabled={busy || !registrationNumber.trim()}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Request link
              </Button>
              <Link to="/portal/fees-payment" className="text-sm text-muted-foreground underline underline-offset-2">
                Back to fees payment
              </Link>
            </div>

            {serverMessage ? (
              <div className="rounded-2xl border border-border bg-slate-50 p-4 text-sm text-slate-900">
                {serverMessage}
              </div>
            ) : null}

            <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
              <p>
                If your registration number is not accepted, contact the finance office or branch administrator for help linking your student record.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </StudentPortalShell>
  );
}
