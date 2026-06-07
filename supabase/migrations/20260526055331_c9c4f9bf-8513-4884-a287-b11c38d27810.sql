
-- =============== ENUMS ===============
create type public.app_role as enum ('super_admin', 'branch_admin', 'finance', 'lecturer', 'student');

-- =============== BRANCHES ===============
create table public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  city text,
  address text,
  phone text,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index branches_is_active_idx on public.branches(is_active);

-- =============== PROFILES ===============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  avatar_url text,
  branch_id uuid references public.branches(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_branch_id_idx on public.profiles(branch_id);

-- =============== USER ROLES (separate table — critical) ===============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  branch_id uuid references public.branches(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, role, branch_id)
);
create index user_roles_user_id_idx on public.user_roles(user_id);
create index user_roles_role_idx on public.user_roles(role);
create index user_roles_branch_id_idx on public.user_roles(branch_id);

-- =============== STUDENTS ===============
create table public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  branch_id uuid not null references public.branches(id) on delete restrict,
  registration_number text not null unique,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  date_of_birth date,
  gender text,
  national_id text,
  address text,
  enrollment_date date not null default current_date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index students_branch_id_idx on public.students(branch_id);
create index students_user_id_idx on public.students(user_id);
create index students_status_idx on public.students(status);

-- =============== AUDIT LOGS ===============
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  branch_id uuid references public.branches(id) on delete set null,
  metadata jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);
create index audit_logs_actor_id_idx on public.audit_logs(actor_id);
create index audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);

-- =============== SECURITY DEFINER FUNCTIONS ===============
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.is_super_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = 'super_admin');
$$;

create or replace function public.user_has_branch_access(_user_id uuid, _branch_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin(_user_id)
    or exists (select 1 from public.user_roles where user_id = _user_id and branch_id = _branch_id)
    or exists (select 1 from public.profiles where id = _user_id and branch_id = _branch_id);
$$;

-- =============== TIMESTAMP TRIGGER ===============
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger set_updated_at before update on public.branches for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.profiles for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.students for each row execute function public.tg_set_updated_at();

-- =============== AUTO-CREATE PROFILE ON SIGNUP ===============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- =============== RLS ===============
alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.students enable row level security;
alter table public.audit_logs enable row level security;

-- Branches
create policy "Authenticated can view active branches"
  on public.branches for select to authenticated
  using (is_active = true or public.is_super_admin(auth.uid()));

create policy "Super admins manage branches"
  on public.branches for all to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

-- Profiles
create policy "Users view own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_super_admin(auth.uid()));

create policy "Users update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "Super admins update any profile"
  on public.profiles for update to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

-- User roles — only super admins manage
create policy "Users view own roles"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin(auth.uid()));

create policy "Super admins manage roles"
  on public.user_roles for all to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

-- Students — branch isolation
create policy "Super admins view all students"
  on public.students for select to authenticated
  using (public.is_super_admin(auth.uid()));

create policy "Branch staff view students in their branch"
  on public.students for select to authenticated
  using (public.user_has_branch_access(auth.uid(), branch_id));

create policy "Students view own record"
  on public.students for select to authenticated
  using (user_id = auth.uid());

create policy "Admins insert students in their branch"
  on public.students for insert to authenticated
  with check (
    public.is_super_admin(auth.uid())
    or (public.has_role(auth.uid(), 'branch_admin')
        and public.user_has_branch_access(auth.uid(), branch_id))
  );

create policy "Admins update students in their branch"
  on public.students for update to authenticated
  using (
    public.is_super_admin(auth.uid())
    or (public.has_role(auth.uid(), 'branch_admin')
        and public.user_has_branch_access(auth.uid(), branch_id))
  );

-- Audit logs
create policy "Super admins read audit logs"
  on public.audit_logs for select to authenticated
  using (public.is_super_admin(auth.uid()));

create policy "Authenticated insert own audit logs"
  on public.audit_logs for insert to authenticated
  with check (actor_id = auth.uid());
