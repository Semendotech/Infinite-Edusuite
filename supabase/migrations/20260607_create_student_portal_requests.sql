-- =============== STUDENT PORTAL REQUESTS ===============
create table if not exists public.student_portal_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  request_type text not null,
  subject text not null,
  details text,
  status text not null default 'pending',
  response text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint student_portal_requests_request_type_check check (request_type in (
    'withdrawal',
    'deferment',
    'resit_exams',
    'graduation_clearance',
    'provisional_transcript',
    'provisional_results_slip',
    'special_exam_registration'
  ))
);
create index if not exists student_portal_requests_student_id_idx on public.student_portal_requests(student_id);
create index if not exists student_portal_requests_branch_id_idx on public.student_portal_requests(branch_id);
create index if not exists student_portal_requests_status_idx on public.student_portal_requests(status);

alter table public.student_portal_requests enable row level security;

create policy if not exists "Authenticated students can view their own portal requests"
  on public.student_portal_requests for select to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = student_portal_requests.student_id
        and s.user_id = auth.uid()
    )
  );

create policy if not exists "Authenticated students can create their own portal requests"
  on public.student_portal_requests for insert to authenticated
  with check (
    exists (
      select 1 from public.students s
      where s.id = student_portal_requests.student_id
        and s.user_id = auth.uid()
    )
  );

create policy if not exists "Authenticated students can update their own portal requests"
  on public.student_portal_requests for update to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = student_portal_requests.student_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.students s
      where s.id = student_portal_requests.student_id
        and s.user_id = auth.uid()
    )
  );

create policy if not exists "Authenticated students can delete their own portal requests"
  on public.student_portal_requests for delete to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = student_portal_requests.student_id
        and s.user_id = auth.uid()
    )
  );

create trigger set_updated_at before update on public.student_portal_requests for each row execute function public.tg_set_updated_at();
