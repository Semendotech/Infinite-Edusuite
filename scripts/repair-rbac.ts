/**
 * RBAC Repair Script
 * 
 * This script verifies and repairs the RBAC system:
 * - Checks if tables exist
 * - Seeds missing roles
 * - Seeds missing permissions
 * - Seeds missing role_permissions
 * - Assigns SUPER_ADMIN to first account
 * - Repairs orphaned users with no roles
 * 
 * Run with: npx tsx scripts/repair-rbac.ts
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

// Permission definitions (matching TypeScript enum)
const PERMISSIONS = [
  // Branch Management
  { name: 'branch:view', description: 'View branch information', category: 'Branch' },
  { name: 'branch:create', description: 'Create new branches', category: 'Branch' },
  { name: 'branch:update', description: 'Update branch information', category: 'Branch' },
  { name: 'branch:delete', description: 'Delete branches', category: 'Branch' },

  // Student Management
  { name: 'student:view', description: 'View student records', category: 'Student' },
  { name: 'student:view:own', description: 'View own student record', category: 'Student' },
  { name: 'student:create', description: 'Create new students', category: 'Student' },
  { name: 'student:update', description: 'Update student information', category: 'Student' },
  { name: 'student:delete', description: 'Delete students', category: 'Student' },

  // Finance
  { name: 'finance:view', description: 'View financial records', category: 'Finance' },
  { name: 'finance:create', description: 'Create financial records', category: 'Finance' },
  { name: 'finance:manage', description: 'Manage financial operations', category: 'Finance' },
  { name: 'fee:view', description: 'View fee information', category: 'Finance' },
  { name: 'fee:view:own', description: 'View own fee information', category: 'Finance' },
  { name: 'fee:create', description: 'Create fee records', category: 'Finance' },
  { name: 'fee:update', description: 'Update fee information', category: 'Finance' },
  { name: 'fee:delete', description: 'Delete fee records', category: 'Finance' },
  { name: 'transaction:view', description: 'View transaction records', category: 'Finance' },
  { name: 'transaction:create', description: 'Create transaction records', category: 'Finance' },
  { name: 'transaction:update', description: 'Update transaction information', category: 'Finance' },
  { name: 'transaction:delete', description: 'Delete transaction records', category: 'Finance' },

  // Academics
  { name: 'course:view', description: 'View course information', category: 'Academic' },
  { name: 'course:create', description: 'Create new courses', category: 'Academic' },
  { name: 'course:update', description: 'Update course information', category: 'Academic' },
  { name: 'course:delete', description: 'Delete courses', category: 'Academic' },
  { name: 'exam:view', description: 'View exam information', category: 'Academic' },
  { name: 'exam:create', description: 'Create new exams', category: 'Academic' },
  { name: 'exam:update', description: 'Update exam information', category: 'Academic' },
  { name: 'exam:delete', description: 'Delete exams', category: 'Academic' },
  { name: 'exam:grade', description: 'Grade exams', category: 'Academic' },
  { name: 'attendance:view', description: 'View attendance records', category: 'Academic' },
  { name: 'attendance:create', description: 'Create attendance records', category: 'Academic' },
  { name: 'attendance:update', description: 'Update attendance information', category: 'Academic' },

  // User Management
  { name: 'user:view', description: 'View user accounts', category: 'Administration' },
  { name: 'user:view:own', description: 'View own user account', category: 'Administration' },
  { name: 'user:create', description: 'Create new users', category: 'Administration' },
  { name: 'user:update', description: 'Update user information', category: 'Administration' },
  { name: 'user:delete', description: 'Delete users', category: 'Administration' },
  { name: 'role:assign', description: 'Assign roles to users', category: 'Administration' },
  { name: 'role:revoke', description: 'Revoke roles from users', category: 'Administration' },

  // Audit
  { name: 'audit:view', description: 'View audit logs', category: 'Audit' },
  { name: 'audit:export', description: 'Export audit logs', category: 'Audit' },

  // Reports
  { name: 'report:view', description: 'View reports', category: 'Reports' },
  { name: 'report:generate', description: 'Generate reports', category: 'Reports' },
  { name: 'report:export', description: 'Export reports', category: 'Reports' },

  // Settings
  { name: 'settings:view', description: 'View system settings', category: 'Settings' },
  { name: 'settings:update', description: 'Update system settings', category: 'Settings' },
];

// Role permission mappings
const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: PERMISSIONS.map(p => p.name),
  branch_admin: [
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
    'settings:view', 'settings:update',
  ],
  finance: [
    'student:view',
    'fee:view', 'fee:create', 'fee:update',
    'transaction:view', 'transaction:create', 'transaction:update',
    'report:view', 'report:generate', 'report:export',
  ],
  lecturer: [
    'student:view',
    'course:view',
    'exam:view', 'exam:create', 'exam:update', 'exam:grade',
    'attendance:view', 'attendance:create', 'attendance:update',
    'report:view',
  ],
  student: [
    'student:view:own',
    'fee:view:own',
    'user:view:own',
    'course:view',
    'exam:view',
    'attendance:view',
    'report:view',
  ],
};

async function verifyTables() {
  console.log('\n=== STEP 1: Verifying Database Tables ===\n');

  const tables = ['permissions', 'role_permissions', 'user_roles', 'branches', 'profiles'];
  
  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table as any)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ Table '${table}' does not exist or error:`, error.message);
      } else {
        console.log(`✅ Table '${table}' exists with ${count} rows`);
      }
    } catch (e) {
      console.log(`❌ Table '${table}' check failed:`, e);
    }
  }
}

async function seedPermissions() {
  console.log('\n=== STEP 2: Seeding Permissions ===\n');

  const { data: existingPermissions } = await supabase
    .from('permissions' as any)
    .select('name');

  const existingNames = new Set(existingPermissions?.map(p => p.name) || []);
  const missingPermissions = PERMISSIONS.filter(p => !existingNames.has(p.name));

  if (missingPermissions.length === 0) {
    console.log('✅ All permissions already seeded');
    return;
  }

  console.log(`Seeding ${missingPermissions.length} missing permissions...`);

  const { error } = await supabase
    .from('permissions' as any)
    .insert(missingPermissions);

  if (error) {
    console.error('❌ Failed to seed permissions:', error);
  } else {
    console.log(`✅ Seeded ${missingPermissions.length} permissions`);
  }
}

async function seedRolePermissions() {
  console.log('\n=== STEP 3: Seeding Role Permissions ===\n');

  // Get all permission IDs
  const { data: permissions } = await supabase
    .from('permissions' as any)
    .select('id, name');

  if (!permissions) {
    console.error('❌ No permissions found');
    return;
  }

  const permissionMap = new Map(permissions.map(p => [p.name, p.id]));

  // Get existing role permissions
  const { data: existingRolePermissions } = await supabase
    .from('role_permissions' as any)
    .select('role, permission_id');

  const existingKey = new Set(
    existingRolePermissions?.map(rp => `${rp.role}:${rp.permission_id}`) || []
  );

  let totalInserted = 0;

  for (const [role, permissionNames] of Object.entries(ROLE_PERMISSIONS)) {
    for (const permissionName of permissionNames) {
      const permissionId = permissionMap.get(permissionName);
      if (!permissionId) {
        console.warn(`⚠️  Permission '${permissionName}' not found for role '${role}'`);
        continue;
      }

      const key = `${role}:${permissionId}`;
      if (existingKey.has(key)) continue;

      const { error } = await supabase
        .from('role_permissions' as any)
        .insert({
          role,
          permission_id: permissionId,
        });

      if (error) {
        console.error(`❌ Failed to insert ${role}:${permissionName}:`, error);
      } else {
        totalInserted++;
      }
    }
  }

  console.log(`✅ Seeded ${totalInserted} role permission mappings`);
}

async function repairOrphanedUsers() {
  console.log('\n=== STEP 4: Repairing Orphaned Users ===\n');

  // Get all users
  const { data: users } = await supabase.auth.admin.listUsers();

  if (!users) {
    console.log('❌ No users found');
    return;
  }

  console.log(`Found ${users.users.length} users`);

  // Get main branch
  const { data: branches } = await supabase
    .from('branches' as any)
    .select('id')
    .eq('is_main_campus', true)
    .limit(1);

  const mainBranchId = branches?.[0]?.id;

  if (!mainBranchId) {
    console.error('❌ No main branch found');
    return;
  }

  console.log(`Main branch ID: ${mainBranchId}`);

  let repairedCount = 0;

  for (const user of users.users) {
    // Check if user has roles
    const { data: userRoles } = await supabase
      .from('user_roles' as any)
      .select('role')
      .eq('user_id', user.id);

    if (!userRoles || userRoles.length === 0) {
      console.log(`🔧 Repairing user ${user.email} (no roles)`);

      // Check if this is the first user
      const { data: allRoles } = await supabase
        .from('user_roles' as any)
        .select('role');

      const isFirstUser = !allRoles || allRoles.length === 0;
      const role = isFirstUser ? 'super_admin' : 'student';

      const { error } = await supabase
        .from('user_roles' as any)
        .insert({
          user_id: user.id,
          role,
          branch_id: mainBranchId,
        });

      if (error) {
        console.error(`❌ Failed to assign role to ${user.email}:`, error);
      } else {
        console.log(`✅ Assigned ${role} to ${user.email}`);
        repairedCount++;
      }
    }

    // Check if user has profile with branch
    const { data: profile } = await supabase
      .from('profiles' as any)
      .select('branch_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || !profile.branch_id) {
      console.log(`🔧 Repairing profile for ${user.email} (no branch)`);

      const { error } = await supabase
        .from('profiles' as any)
        .update({ branch_id: mainBranchId })
        .eq('id', user.id);

      if (error) {
        console.error(`❌ Failed to update profile for ${user.email}:`, error);
      } else {
        console.log(`✅ Updated profile for ${user.email}`);
        repairedCount++;
      }
    }
  }

  console.log(`✅ Repaired ${repairedCount} issues`);
}

async function printCurrentState() {
  console.log('\n=== STEP 5: Current RBAC State ===\n');

  // Print permissions
  const { data: permissions } = await supabase
    .from('permissions' as any)
    .select('name, category');
  
  console.log(`Permissions: ${permissions?.length || 0}`);
  if (permissions) {
    const byCategory = permissions.reduce((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('By category:', byCategory);
  }

  // Print role permissions
  const { data: rolePermissions } = await supabase
    .from('role_permissions' as any)
    .select('role');
  
  const roleCounts = rolePermissions?.reduce((acc, rp) => {
    acc[rp.role] = (acc[rp.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};
  
  console.log('Role permissions:', roleCounts);

  // Print user roles
  const { data: userRoles } = await supabase
    .from('user_roles' as any)
    .select('role, user_id');
  
  console.log(`User roles: ${userRoles?.length || 0}`);
  if (userRoles) {
    const byRole = userRoles.reduce((acc, ur) => {
      acc[ur.role] = (acc[ur.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('By role:', byRole);
  }
}

async function main() {
  console.log('🔧 RBAC Repair Script');
  console.log('====================\n');

  try {
    await verifyTables();
    await seedPermissions();
    await seedRolePermissions();
    await repairOrphanedUsers();
    await printCurrentState();

    console.log('\n✅ RBAC repair complete!\n');
  } catch (error) {
    console.error('\n❌ RBAC repair failed:', error);
    process.exit(1);
  }
}

main();
