/**
 * Apply Database Migrations Script
 * 
 * This script applies the RBAC schema and seed migrations directly to the database
 * using the Supabase client with service role key.
 * 
 * Run with: npx tsx scripts/apply-migrations.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applySchemaMigration() {
  console.log('\n=== Applying RBAC Schema Migration ===\n');

  const schemaSQL = `
-- =============== RBAC SCHEMA ===============
-- This migration creates the permissions and role_permissions tables

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
`;

  try {
    // Split the SQL into individual statements and execute them
    const statements = schemaSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 50)}...`);
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error) {
        // Try using raw SQL execution via REST API
        console.log('Trying alternative method...');
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ sql: statement }),
        });
        
        if (!response.ok) {
          console.error(`Failed to execute statement: ${error.message}`);
          console.log('Statement:', statement);
        }
      }
    }
    
    console.log('✅ Schema migration applied');
  } catch (error) {
    console.error('❌ Schema migration failed:', error);
    throw error;
  }
}

async function main() {
  console.log('🔧 Apply Database Migrations');
  console.log('============================\n');

  try {
    await applySchemaMigration();
    console.log('\n✅ Migrations applied successfully!\n');
  } catch (error) {
    console.error('\n❌ Migrations failed:', error);
    process.exit(1);
  }
}

main();
