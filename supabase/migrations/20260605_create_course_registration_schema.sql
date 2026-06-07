-- =============== COURSES ===============
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  code text not null,
  name text not null,
  description text,
  credits integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (branch_id, code)
);
create index if not exists courses_branch_id_idx on public.courses(branch_id);
create index if not exists courses_is_active_idx on public.courses(is_active);
create index if not exists courses_code_idx on public.courses(code);

-- =============== STUDENT COURSE REGISTRATIONS ===============
create table if not exists public.student_course_registrations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  status text not null default 'registered',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (student_id, course_id)
);
create index if not exists student_course_registrations_student_id_idx on public.student_course_registrations(student_id);
create index if not exists student_course_registrations_course_id_idx on public.student_course_registrations(course_id);
create index if not exists student_course_registrations_branch_id_idx on public.student_course_registrations(branch_id);

alter table public.courses enable row level security;
alter table public.student_course_registrations enable row level security;

create policy if not exists "Authenticated users can view active courses"
  on public.courses for select to authenticated
  using (is_active);

create policy if not exists "Authenticated students can manage their own course registrations"
  on public.student_course_registrations for select to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = student_course_registrations.student_id
        and s.user_id = auth.uid()
    )
  );

create policy if not exists "Authenticated students can create their own course registrations"
  on public.student_course_registrations for insert to authenticated
  with check (
    exists (
      select 1 from public.students s
      where s.id = student_course_registrations.student_id
        and s.user_id = auth.uid()
    )
  );

create policy if not exists "Authenticated students can remove their own course registrations"
  on public.student_course_registrations for delete to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = student_course_registrations.student_id
        and s.user_id = auth.uid()
    )
  );

create policy if not exists "Authenticated students can update their own course registrations"
  on public.student_course_registrations for update to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = student_course_registrations.student_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.students s
      where s.id = student_course_registrations.student_id
        and s.user_id = auth.uid()
    )
  );

create trigger set_updated_at before update on public.courses for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.student_course_registrations for each row execute function public.tg_set_updated_at();
