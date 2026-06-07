import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { StudentPortalShell } from '@/components/student-portal/StudentPortalShell';
import { requireStudentPortalUser } from '@/core/auth/student-portal';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export const Route = createFileRoute('/_authenticated/portal/register-units')({
  beforeLoad: ({ context }) => requireStudentPortalUser(context.auth),
  component: RegisterUnitsPage,
});

type CourseRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  credits: number;
  is_active: boolean;
  branch_id: string;
};

type RegistrationRecord = {
  id: string;
  course_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  course: CourseRecord;
};

function RegisterUnitsPage() {
  const { auth } = Route.useRouteContext();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const portalQuery = useQuery({
    queryKey: ['portal-register-units', auth.user?.id],
    enabled: Boolean(auth.user?.id),
    queryFn: async () => {
      const userId = auth.user?.id;
      if (!userId) throw new Error('Authenticated user is required.');

      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id, registration_number, first_name, last_name, status, branch_id')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .maybeSingle();

      if (studentError) throw studentError;
      if (!student) throw new Error('Student record not found.');

      const { data: registrations, error: registrationsError } = await (supabase as any)
        .from('student_course_registrations')
        .select('id, course_id, status, created_at, updated_at, course(id, code, name, description, credits, is_active, branch_id)')
        .eq('student_id', student.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (registrationsError) throw registrationsError;

      return {
        student,
        registeredCourses: (registrations ?? []) as RegistrationRecord[],
      };
    },
  });

  const student = portalQuery.data?.student;
  const registeredCourses = portalQuery.data?.registeredCourses ?? [];
  const registeredCourseIds = useMemo(
    () => new Set(registeredCourses.map((registration) => registration.course_id)),
    [registeredCourses]
  );

  const coursesQuery = useQuery({
    queryKey: ['portal-register-units-courses', student?.branch_id],
    enabled: Boolean(student?.branch_id),
    queryFn: async () => {
      if (!student?.branch_id) throw new Error('Student branch information is unavailable.');
      const branchId = student.branch_id;

      const { data, error } = await supabase
        .from('courses')
        .select('id, code, name, description, credits, is_active, branch_id')
        .eq('branch_id', branchId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('code');

      if (error) throw error;
      return (data ?? []) as CourseRecord[];
    },
  });

  const availableCourses = coursesQuery.data ?? [];

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return availableCourses.filter((course) => {
      const searchText = `${course.code} ${course.name} ${course.description ?? ''}`.toLowerCase();
      return !query || searchText.includes(query);
    });
  }, [availableCourses, search]);

  const toggleCourseSelection = (courseId: string) => {
    setSelectedCourseIds((current) =>
      current.includes(courseId) ? current.filter((id) => id !== courseId) : [...current, courseId]
    );
  };

  const registerSelectedCourses = async () => {
    if (!student) return;
    if (!selectedCourseIds.length) {
      toast.error('Select one or more units to register.');
      return;
    }

    const courseIdsToRegister = selectedCourseIds.filter((id) => !registeredCourseIds.has(id));
    if (!courseIdsToRegister.length) {
      toast.error('All selected units are already registered.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await (supabase as any)
        .from('student_course_registrations')
        .insert(
          courseIdsToRegister.map((courseId) => ({
            student_id: student.id,
            course_id: courseId,
            branch_id: student.branch_id,
            status: 'registered',
          }))
        );

      if (error) throw error;
      toast.success('Units registered successfully.');
      setSelectedCourseIds([]);
      qc.invalidateQueries({ queryKey: ['portal-register-units', auth.user?.id] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to register selected units.');
    } finally {
      setSubmitting(false);
    }
  };

  const removeRegistration = async (registrationId: string) => {
    setSubmitting(true);
    try {
      const { error } = await (supabase as any)
        .from('student_course_registrations')
        .delete()
        .eq('id', registrationId);

      if (error) throw error;
      toast.success('Registration removed.');
      qc.invalidateQueries({ queryKey: ['portal-register-units', auth.user?.id] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to remove registration.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StudentPortalShell
      title="Register units"
      description="Select and register your units for the active academic period."
    >
      <div className="grid gap-6 lg:grid-cols-[1.8fr_1fr]">
        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Available units</h2>
                <p className="text-sm text-muted-foreground">
                  Register courses for your current branch and academic year.
                </p>
              </div>
              <div className="relative w-full sm:w-80">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="unit-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by code or name..."
                  className="pl-9"
                />
              </div>
            </div>

            {portalQuery.isLoading || coursesQuery.isLoading ? (
              <div className="grid place-items-center rounded-2xl border border-dashed border-border p-20 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : !student ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
                Student profile not found. Please contact your institution administrator.
              </div>
            ) : !filteredCourses.length ? (
              <div className="rounded-2xl border border-border bg-muted p-8 text-center text-sm text-muted-foreground">
                No active units were found for your branch.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border bg-background">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-border bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Select</th>
                      <th className="px-4 py-3">Unit</th>
                      <th className="px-4 py-3">Credits</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredCourses.map((course) => {
                      const isRegistered = registeredCourseIds.has(course.id);
                      const isChecked = selectedCourseIds.includes(course.id);
                      return (
                        <tr key={course.id}>
                          <td className="px-4 py-3 align-top">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggleCourseSelection(course.id)}
                              disabled={isRegistered}
                              aria-label={`Select ${course.code}`}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{course.code}</div>
                            <div className="text-sm text-muted-foreground">{course.name}</div>
                          </td>
                          <td className="px-4 py-3">{course.credits}</td>
                          <td className="px-4 py-3">
                            {isRegistered ? (
                              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                                Registered
                              </Badge>
                            ) : (
                              <Badge className="bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                                Available
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedCourseIds.length} unit(s) selected for registration.
              </p>
              <Button
                type="button"
                onClick={registerSelectedCourses}
                disabled={submitting || !selectedCourseIds.length || !student}
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Register selected units
              </Button>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Your current registration</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Review registered units and remove any selections before final approval.
            </p>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
                <p>
                  <span className="font-semibold">Student:</span> {student?.registration_number ?? '—'}
                </p>
                <p className="mt-2">
                  <span className="font-semibold">Branch:</span> {student?.branch_id ?? '—'}
                </p>
                <p className="mt-2">
                  <span className="font-semibold">Status:</span>{' '}
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                    {student?.status ?? 'Unknown'}
                  </Badge>
                </p>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border bg-background">
                {registeredCourses.length ? (
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left">Unit</th>
                        <th className="px-4 py-3 text-left">Credits</th>
                        <th className="px-4 py-3 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {registeredCourses.map((registration) => (
                        <tr key={registration.id}>
                          <td className="px-4 py-3">
                            <div className="font-medium">{registration.course.code}</div>
                            <div className="text-sm text-muted-foreground">{registration.course.name}</div>
                          </td>
                          <td className="px-4 py-3">{registration.course.credits}</td>
                          <td className="px-4 py-3">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => removeRegistration(registration.id)}
                              disabled={submitting}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-6 text-sm text-muted-foreground">
                    No units are registered yet. Choose units from the list and click the button above.
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </StudentPortalShell>
  );
}
