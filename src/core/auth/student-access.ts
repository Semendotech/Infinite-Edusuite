import { supabase } from '@/integrations/supabase/client';
import { Role } from '@/core/rbac/permissions';
import { StudentStatus } from '@/types/student.types';

const STAFF_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.BRANCH_ADMIN,
  Role.FINANCE,
  Role.LECTURER,
];

export async function ensureActiveStudentOrStaff(userId: string): Promise<void> {
  const { data: roleRows, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  if (roleError) {
    throw roleError;
  }

  const roles = (roleRows ?? []).map((row) => row.role as Role);
  const hasStaffRole = roles.some((role) => STAFF_ROLES.includes(role));

  if (hasStaffRole) {
    return;
  }

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle();

  if (studentError) {
    throw studentError;
  }

  if (!student) {
    throw new Error('Only registered students with an active admission may sign in.');
  }

  if (student.status !== StudentStatus.ACTIVE) {
    throw new Error('Your student account is not yet admitted or active. Contact administration.');
  }
}
