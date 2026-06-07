
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  super_admin_exists boolean;
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  );

  -- Bootstrap: the very first user becomes super_admin.
  select exists(select 1 from public.user_roles where role = 'super_admin') into super_admin_exists;
  if not super_admin_exists then
    insert into public.user_roles (user_id, role) values (new.id, 'super_admin');
  end if;

  return new;
end; $$;
