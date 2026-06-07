# RBAC System Setup Instructions

## Problem
The RBAC system was broken because:
- Database lacked `permissions` and `role_permissions` tables
- Users were created without proper role assignments
- Permission loading relied on TypeScript enums instead of database

## Solution

### Step 1: Install Dependencies
```bash
npm install
```

This will install the newly added dependencies:
- `tsx` - For running TypeScript scripts
- `dotenv` - For environment variable loading

### Step 2: Run Database Migrations
```bash
supabase db push
```

This will apply:
- `20260527_create_rbac_schema.sql` - Creates permissions and role_permissions tables
- `20260527_seed_rbac.sql` - Seeds permissions and role mappings

### Step 3: Run RBAC Repair Script
```bash
npm run repair:rbac
```

This script will:
- Verify all required tables exist
- Seed missing permissions (45 total)
- Seed missing role_permissions mappings
- Repair orphaned users (assign student role if no role)
- Assign SUPER_ADMIN to first user if no super_admin exists
- Print current RBAC state

### Step 4: Verify the Fix

After running the repair script, check the browser console for logs:
- `[AuthHydration]` - Shows auth state loading
- `[RBACService]` - Shows permission fetching
- `[SidebarMenu]` - Shows sidebar filtering

Expected output:
```
[AuthHydration] User roles: ['super_admin']
[AuthHydration] Final permissions count: 45
[AuthHydration] Final state: { roles: ['super_admin'], permissionCount: 45, branchCount: 1 }
```

### Step 5: Test Dashboard

Login and check:
- Dashboard should show: "Roles: super_admin • 45 permissions"
- Sidebar should show all modules
- KPI cards should load correctly

## Expected Results by Role

### SUPER_ADMIN (45 permissions)
- Dashboard
- Students
- Academics (Students, Courses, Exams)
- Finance (Fees, Payments, Invoices, Transactions)
- Administration (Branches, Users, Roles, Permissions)
- Reports (Reports, Analytics)
- Audit (Audit Logs, Activity)
- Settings (Profile, Settings)

### BRANCH_ADMIN (28 permissions)
- Dashboard
- Students
- Academics (Students, Courses, Exams)
- Finance (Fees, Payments, Invoices, Transactions)
- Administration (Users, Roles, Permissions)
- Reports (Reports, Analytics)
- Settings (Profile, Settings)

### FINANCE (8 permissions)
- Dashboard
- Students
- Finance (Fees, Payments, Invoices, Transactions)
- Reports (Reports, Analytics)
- Settings (Profile, Settings)

### LECTURER (7 permissions)
- Dashboard
- Students
- Academics (Courses, Exams)
- Reports (Reports)
- Settings (Profile, Settings)

### STUDENT (6 permissions)
- Dashboard
- Academics (Courses, Exams)
- Settings (Profile, Settings)

## Troubleshooting

### If permissions still show 0
1. Check browser console for `[AuthHydration]` logs
2. Verify migrations were applied: `supabase db push`
3. Run repair script again: `npm run repair:rbac`
4. Clear browser cache and reload

### If sidebar still empty
1. Check `[SidebarMenu]` logs in console
2. Verify permissions are loaded in auth state
3. Check that permission names match between database and TypeScript enum

### If user has no role
1. The repair script should auto-assign student role
2. Check `[AuthHydration]` logs for fallback assignment
3. Manually assign role via Supabase dashboard if needed

## Files Modified

### Database Migrations
- `supabase/migrations/20260527_create_rbac_schema.sql` - New
- `supabase/migrations/20260527_seed_rbac.sql` - New

### Scripts
- `scripts/repair-rbac.ts` - New

### Code Changes
- `src/core/rbac/rbac.service.ts` - Updated to load from database
- `src/routes/__root.tsx` - Added auto-recovery and debugging
- `src/utils/sidebar-menu.utils.ts` - Added debugging
- `src/routes/_authenticated/dashboard.tsx` - Updated to show actual permissions
- `package.json` - Added repair:rbac script and dependencies

## Production Notes

- The repair script uses service role key, keep it secure
- Run migrations in production before deploying
- Test with a test user before applying to production
- The auto-recovery fallback assigns student role - adjust if needed
