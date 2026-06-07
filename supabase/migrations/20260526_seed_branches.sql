-- Add branch metadata and seed the main branch registry

alter table public.branches
  add column if not exists is_main_campus boolean not null default false,
  add column if not exists status text not null default 'active';

insert into public.branches (
  id,
  name,
  code,
  city,
  address,
  phone,
  email,
  is_active,
  is_main_campus,
  status
) values
  (
    '11111111-1111-1111-1111-111111111111',
    'Kisumu Campus',
    'KSM',
    'Kisumu',
    '123 Main Street, Kisumu',
    '+254700000001',
    'kisumu@infiniteedusuite.com',
    true,
    true,
    'active'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Nakuru Campus',
    'NAK',
    'Nakuru',
    '45 Campus Road, Nakuru',
    '+254700000002',
    'nakuru@infiniteedusuite.com',
    true,
    false,
    'active'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'Eldoret Campus',
    'ELD',
    'Eldoret',
    '8 University Avenue, Eldoret',
    '+254700000003',
    'eldoret@infiniteedusuite.com',
    true,
    false,
    'active'
  )
on conflict (code) do update set
  name = excluded.name,
  city = excluded.city,
  address = excluded.address,
  phone = excluded.phone,
  email = excluded.email,
  is_active = excluded.is_active,
  is_main_campus = excluded.is_main_campus,
  status = excluded.status,
  updated_at = now();
