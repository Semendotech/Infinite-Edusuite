import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

type PortalRequestFormProps = {
  authUserId?: string;
  requestType: string;
  requestTypeLabel: string;
  instructions: string;
  defaultSubject: string;
  placeholder?: string;
};

type StudentRecord = {
  id: string;
  registration_number: string;
  first_name: string;
  last_name: string;
  branch_id: string;
};

type PortalRequestRecord = {
  id: string;
  request_type: string;
  subject: string;
  details?: string | null;
  status?: string | null;
  response?: string | null;
  created_at: string;
  updated_at: string;
};

const statusClasses: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  rejected: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
  cancelled: 'bg-slate-100 text-slate-800 dark:bg-slate-950 dark:text-slate-200',
};

function getStatusStyle(status?: string) {
  return statusClasses[status ?? ''] ?? statusClasses.pending;
}

function formatStatus(status?: string) {
  if (!status) return 'Pending';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}

export function PortalRequestForm({
  authUserId,
  requestType,
  requestTypeLabel,
  instructions,
  defaultSubject,
  placeholder,
}: PortalRequestFormProps) {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState(defaultSubject);
  const [details, setDetails] = useState('');

  const portalQuery = useQuery(
    ['portal-request', authUserId, requestType],
    async () => {
      if (!authUserId) {
        throw new Error('Authenticated user is required.');
      }

      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id, registration_number, first_name, last_name, branch_id')
        .eq('user_id', authUserId)
        .is('deleted_at', null)
        .maybeSingle();

      if (studentError) {
        throw studentError;
      }

      if (!student) {
        throw new Error('Student profile not found.');
      }

      const { data: requests, error: requestsError } = await (supabase as any)
        .from('student_portal_requests')
        .select('id, request_type, subject, details, status, response, created_at, updated_at')
        .eq('student_id', student.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (requestsError) {
        throw requestsError;
      }

      return {
        student: student as StudentRecord,
        requests: (requests ?? []) as PortalRequestRecord[],
      };
    },
    {
      enabled: Boolean(authUserId),
      staleTime: 1000 * 60,
    }
  );

  const createRequestMutation = useMutation(
    async () => {
      if (!portalQuery.data?.student) {
        throw new Error('Student record is required to submit a request.');
      }

      if (!subject.trim()) {
        throw new Error('Subject is required.');
      }

      const { data, error } = await (supabase as any)
        .from('student_portal_requests')
        .insert([
          {
            student_id: portalQuery.data.student.id,
            branch_id: portalQuery.data.student.branch_id,
            request_type: requestType,
            subject: subject.trim(),
            details: details.trim(),
            status: 'pending',
          },
        ])
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data as PortalRequestRecord;
    },
    {
      onSuccess: () => {
        toast.success(`${requestTypeLabel} request submitted successfully.`);
        setDetails('');
        queryClient.invalidateQueries(['portal-request', authUserId, requestType]);
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'Unable to submit request.');
      },
    }
  );

  const deleteRequestMutation = useMutation(
    async (requestId: string) => {
      const { error } = await (supabase as any)
        .from('student_portal_requests')
        .delete()
        .eq('id', requestId);

      if (error) {
        throw error;
      }

      return requestId;
    },
    {
      onSuccess: () => {
        toast.success('Request cancelled.');
        queryClient.invalidateQueries(['portal-request', authUserId, requestType]);
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'Unable to cancel request.');
      },
    }
  );

  const student = portalQuery.data?.student;
  const requests = portalQuery.data?.requests ?? [];

  const statusSummary = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((request) => !request.status || request.status === 'pending').length;
    const approved = requests.filter((request) => request.status === 'approved').length;
    const rejected = requests.filter((request) => request.status === 'rejected').length;
    return { total, pending, approved, rejected };
  }, [requests]);

  if (!authUserId) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Loading student portal access...
      </div>
    );
  }

  if (portalQuery.isError) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-rose-700">
        <p className="font-semibold">Unable to load student portal requests.</p>
        <p className="mt-2">{portalQuery.error instanceof Error ? portalQuery.error.message : 'Please refresh the page or contact support.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{requestTypeLabel} requests</CardTitle>
          <CardDescription>{instructions}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Student</p>
              <p className="mt-2 text-lg font-semibold">{student ? `${student.first_name} ${student.last_name}` : '—'}</p>
              <p className="text-sm text-muted-foreground">{student?.registration_number ?? 'Not found'}</p>
            </div>
            <div className="rounded-2xl border border-border bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Branch</p>
              <p className="mt-2 text-lg font-semibold">{student?.branch_id ?? '—'}</p>
            </div>
            <div className="rounded-2xl border border-border bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pending requests</p>
              <p className="mt-2 text-3xl font-semibold">{statusSummary.pending}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4 rounded-3xl border border-border bg-card p-6">
          <div>
            <h2 className="text-lg font-semibold">Submit a new request</h2>
            <p className="text-sm text-muted-foreground">Use the details field to explain the reason for your request and any supporting context.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="request-subject" className="mb-2 block text-sm font-medium text-muted-foreground">
                Request subject
              </label>
              <Input
                id="request-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder={defaultSubject}
              />
            </div>

            <div>
              <label htmlFor="request-details" className="mb-2 block text-sm font-medium text-muted-foreground">
                Details
              </label>
              <Textarea
                id="request-details"
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder={placeholder ?? 'Describe your request and any supporting details.'}
                rows={8}
              />
            </div>

            <Button
              onClick={() => createRequestMutation.mutate()}
              disabled={createRequestMutation.isLoading || portalQuery.isLoading || !student}
            >
              {createRequestMutation.isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Submit request
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Request overview</CardTitle>
            <CardDescription>See recent requests submitted from your student profile.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total requests</p>
                <p className="mt-2 text-3xl font-semibold">{statusSummary.total}</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Approved</p>
                  <p className="mt-2 text-2xl font-semibold">{statusSummary.approved}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Rejected</p>
                  <p className="mt-2 text-2xl font-semibold">{statusSummary.rejected}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pending</p>
                  <p className="mt-2 text-2xl font-semibold">{statusSummary.pending}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Recent requests</h2>
            <p className="text-sm text-muted-foreground">Review and cancel pending requests if needed.</p>
          </div>
          <Badge className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
            {requestTypeLabel}
          </Badge>
        </div>

        {portalQuery.isLoading ? (
          <div className="mt-6 grid place-items-center rounded-2xl border border-dashed border-border p-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !requests.length ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-muted p-10 text-center text-sm text-muted-foreground">
            No requests have been submitted yet.
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Response</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => {
                  const isPending = request.status !== 'approved' && request.status !== 'rejected' && request.status !== 'cancelled';
                  return (
                    <TableRow key={request.id}>
                      <TableCell>
                        <Badge className={getStatusStyle(request.status)}>
                          {formatStatus(request.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{request.subject}</div>
                        <div className="text-xs text-muted-foreground">{request.request_type.replace(/_/g, ' ')}</div>
                      </TableCell>
                      <TableCell>{new Date(request.created_at).toLocaleString()}</TableCell>
                      <TableCell>{request.response ?? 'Awaiting review'}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!isPending || deleteRequestMutation.isLoading}
                          onClick={() => deleteRequestMutation.mutate(request.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Cancel
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
