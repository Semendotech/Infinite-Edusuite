-- ============================================
-- RBAC SYSTEM SETUP - MANUAL MIGRATION
-- ============================================
-- Run this SQL in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/nhfhbyiuxdgidrfbtbrs/sql/new
-- ============================================

-- =============== PERMISSIONS TABLE ===============
create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  category text not null,
  created_at timestamptz not null default now()
);

create index permissions_name_idx on public.permissions(name);
create index permissions_category_idx on public.permissions(category);

-- =============== ROLE PERMISSIONS PIVOT TABLE ===============
create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role public.app_role not null,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (role, permission_id)
);

create index role_permissions_role_idx on public.role_permissions(role);
create index role_permissions_permission_id_idx on public.role_permissions(permission_id);

-- =============== RLS ===============
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

-- Permissions: authenticated users can view
create policy "Authenticated can view permissions"
  on public.permissions for select to authenticated
  using (true);

-- Role permissions: authenticated users can view
create policy "Authenticated can view role permissions"
  on public.role_permissions for select to authenticated
  using (true);

-- Only super admins can manage permissions
create policy "Super admins manage permissions"
  on public.permissions for all to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

create policy "Super admins manage role permissions"
  on public.role_permissions for all to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

-- =============== HELPER FUNCTIONS ===============
-- Get permissions for a user
create or replace function public.get_user_permissions(_user_id uuid)
returns table (permission_name text)
language sql stable security definer set search_path = public as $$
  select distinct p.name
  from public.role_permissions rp
  join public.permissions p on rp.permission_id = p.id
  join public.user_roles ur on ur.role = rp.role
  where ur.user_id = _user_id;
$$;

-- Check if user has specific permission
create or replace function public.user_has_permission(_user_id uuid, _permission_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.role_permissions rp
    join public.permissions p on rp.permission_id = p.id
    join public.user_roles ur on ur.role = rp.role
    where ur.user_id = _user_id and p.name = _permission_name
  );
$$;

-- Get user roles
create or replace function public.get_user_roles(_user_id uuid)
returns table (role_name public.app_role, branch_id uuid)
language sql stable security definer set search_path = public as $$
  select ur.role, ur.branch_id
  from public.user_roles ur
  where ur.user_id = _user_id;
$$;

-- =============== SEED PERMISSIONS ===============
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

-- =============== SEED ROLE PERMISSIONS ===============
-- SUPER_ADMIN: All permissions
insert into public.role_permissions (role, permission_id)
select 'super_admin', id from public.permissions
on conflict (role, permission_id) do nothing;

-- BRANCH_ADMIN
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

-- FINANCE
insert into public.role_permissions (role, permission_id)
select 'finance', id from public.permissions
where name in (
  'student:view',
  'fee:view', 'fee:create', 'fee:update',
  'transaction:view', 'transaction:create', 'transaction:update',
  'report:view', 'report:generate', 'report:export'
)
on conflict (role, permission_id) do nothing;

-- LECTURER
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

-- STUDENT
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

-- =============== REPAIR EXISTING USERS ===============
-- Assign main branch to existing users who don't have one
update public.profiles
set branch_id = (select id from public.branches where is_main_campus = true limit 1)
where branch_id is null;

-- Assign student role to existing users who don't have any role
insert into public.user_roles (user_id, role, branch_id)
select p.id, 'student', p.branch_id
from public.profiles p
where not exists (
  select 1 from public.user_roles ur where ur.user_id = p.id
)
and p.branch_id is not null
on conflict (user_id, role, branch_id) do nothing;
