-- =============== RBAC SEED SCRIPT ===============
-- This script seeds permissions and role_permissions based on the TypeScript RBAC system

-- =============== INSERT PERMISSIONS ===============
insert into public.permissions (name, description, category) values
-- Branch Management
('branch:view', 'View branch information', 'Branch'),
('branch:create', 'Create new branches', 'Branch'),
('branch:update', 'Update branch information', 'Branch'),
('branch:delete', 'Delete branches', 'Branch'),

-- Student Management
('student:view', 'View student records', 'Student'),
('student:view:own', 'View own student record', 'Student'),
('student:create', 'Create new students', 'Student'),
('student:update', 'Update student information', 'Student'),
('student:delete', 'Delete students', 'Student'),

-- Finance
('finance:view', 'View financial records', 'Finance'),
('finance:create', 'Create financial records', 'Finance'),
('finance:manage', 'Manage financial operations', 'Finance'),
('fee:view', 'View fee information', 'Finance'),
('fee:view:own', 'View own fee information', 'Finance'),
('fee:create', 'Create fee records', 'Finance'),
('fee:update', 'Update fee information', 'Finance'),
('fee:delete', 'Delete fee records', 'Finance'),
('transaction:view', 'View transaction records', 'Finance'),
('transaction:create', 'Create transaction records', 'Finance'),
('transaction:update', 'Update transaction information', 'Finance'),
('transaction:delete', 'Delete transaction records', 'Finance'),

-- Academics
('course:view', 'View course information', 'Academic'),
('course:create', 'Create new courses', 'Academic'),
('course:update', 'Update course information', 'Academic'),
('course:delete', 'Delete courses', 'Academic'),
('exam:view', 'View exam information', 'Academic'),
('exam:create', 'Create new exams', 'Academic'),
('exam:update', 'Update exam information', 'Academic'),
('exam:delete', 'Delete exams', 'Academic'),
('exam:grade', 'Grade exams', 'Academic'),
('attendance:view', 'View attendance records', 'Academic'),
('attendance:create', 'Create attendance records', 'Academic'),
('attendance:update', 'Update attendance information', 'Academic'),

-- User Management
('user:view', 'View user accounts', 'Administration'),
('user:view:own', 'View own user account', 'Administration'),
('user:create', 'Create new users', 'Administration'),
('user:update', 'Update user information', 'Administration'),
('user:delete', 'Delete users', 'Administration'),
('role:assign', 'Assign roles to users', 'Administration'),
('role:revoke', 'Revoke roles from users', 'Administration'),

-- Audit
('audit:view', 'View audit logs', 'Audit'),
('audit:export', 'Export audit logs', 'Audit'),

-- Reports
('report:view', 'View reports', 'Reports'),
('report:generate', 'Generate reports', 'Reports'),
('report:export', 'Export reports', 'Reports'),

-- Settings
('settings:view', 'View system settings', 'Settings'),
('settings:update', 'Update system settings', 'Settings')
on conflict (name) do nothing;

-- =============== INSERT ROLE PERMISSIONS ===============
-- SUPER_ADMIN: All permissions
insert into public.role_permissions (role, permission_id)
select 'super_admin', id from public.permissions
on conflict (role, permission_id) do nothing;

-- BRANCH_ADMIN: Limited branch management, student management, finance, academics, limited user management, reports, settings
insert into public.role_permissions (role, permission_id)
select 'branch_admin', id from public.permissions
where name in (
  'branch:view',
  'student:view', 'student:create', 'student:update',
  'fee:view', 'fee:create', 'fee:update',
  'transaction:view', 'transaction:create', 'transaction:update',
  'course:view', 'course:create', 'course:update',
  'exam:view', 'exam:create', 'exam:update',
  'attendance:view', 'attendance:create', 'attendance:update',
  'user:view', 'user:create', 'user:update',
  'role:assign', 'role:revoke',
  'report:view', 'report:generate', 'report:export',
  'settings:view', 'settings:update'
)
on conflict (role, permission_id) do nothing;

-- FINANCE: Student view, finance permissions, reports
insert into public.role_permissions (role, permission_id)
select 'finance', id from public.permissions
where name in (
  'student:view',
  'fee:view', 'fee:create', 'fee:update',
  'transaction:view', 'transaction:create', 'transaction:update',
  'report:view', 'report:generate', 'report:export'
)
on conflict (role, permission_id) do nothing;

-- LECTURER: Student view, academic permissions, reports
insert into public.role_permissions (role, permission_id)
select 'lecturer', id from public.permissions
where name in (
  'student:view',
  'course:view',
  'exam:view', 'exam:create', 'exam:update', 'exam:grade',
  'attendance:view', 'attendance:create', 'attendance:update',
  'report:view'
)
on conflict (role, permission_id) do nothing;

-- STUDENT: Own data access, view-only academic data
insert into public.role_permissions (role, permission_id)
select 'student', id from public.permissions
where name in (
  'student:view:own',
  'fee:view:own',
  'user:view:own',
  'course:view',
  'exam:view',
  'attendance:view',
  'report:view'
)
on conflict (role, permission_id) do nothing;

-- =============== UPDATE HANDLE_NEW_USER TRIGGER ===============
-- This ensures new users get a branch_id and default role
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  super_admin_exists boolean;
  main_branch_id uuid;
begin
  -- Get main branch (Kisumu Campus)
  select id into main_branch_id
  from public.branches
  where is_main_campus = true
  limit 1;

  -- Insert profile with branch
  insert into public.profiles (id, full_name, email, branch_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    main_branch_id
  );

  -- Bootstrap: the very first user becomes super_admin
  select exists(select 1 from public.user_roles where role = 'super_admin') into super_admin_exists;
  if not super_admin_exists then
    insert into public.user_roles (user_id, role, branch_id) 
    values (new.id, 'super_admin', main_branch_id);
  else
    -- Subsequent users get student role by default
    insert into public.user_roles (user_id, role, branch_id) 
    values (new.id, 'student', main_branch_id);
  end if;

  return new;
end; $$;

-- =============== UPDATE PROFILE FOR EXISTING USERS WITHOUT BRANCH ===============
-- Assign main branch to existing users who don't have one
update public.profiles
set branch_id = (select id from public.branches where is_main_campus = true limit 1)
where branch_id is null;

-- =============== ASSIGN DEFAULT ROLE TO EXISTING USERS WITHOUT ROLE ===============
-- Assign student role to existing users who don't have any role
insert into public.user_roles (user_id, role, branch_id)
select p.id, 'student', p.branch_id
from public.profiles p
where not exists (
  select 1 from public.user_roles ur where ur.user_id = p.id
)
and p.branch_id is not null
on conflict (user_id, role, branch_id) do nothing;
