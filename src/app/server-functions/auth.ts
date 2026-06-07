import { createServerFn } from '@tanstack/react-start';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { permissionCache } from '@/core/rbac/permission-cache';
import { Role } from '@/core/rbac/permissions';
import type { Database } from '@/integrations/supabase/types';

const DEFAULT_USER_ROLE = Role.STUDENT;

type AppRole = Database['public']['Enums']['app_role'];

export type CreateUserInput = {
  email: string;
  password: string;
  fullName: string;
  role: AppRole;
  branchId: string;
};

export const checkUserExists = createServerFn({ method: 'POST' })
  .validator((input: { email: string }) => input)
  .handler(async ({ data }) => {
    try {
      const { email } = data as { email: string };
      const { data: userResponse, error } = await supabaseAdmin.auth.admin.getUserByEmail(email);

      if (error) {
        console.error('[checkUserExists] error:', error);
        return { exists: false, error: error.message };
      }

      return {
        exists: Boolean(userResponse?.user),
        userId: userResponse?.user?.id ?? null,
      };
    } catch (error) {
      console.error('[checkUserExists] unexpected error:', error);
      return { exists: false, error: (error as Error).message || 'Unable to validate email' };
    }
  });

export const initializeUser = createServerFn({ method: 'POST' })
  .validator((input: { userId: string; email: string; fullName?: string }) => input)
  .handler(async ({ data }) => {
    try {
      const { userId, email, fullName } = data as { userId: string; email: string; fullName?: string };

      const { data: existingProfile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, branch_id')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (!existingProfile) {
        const { error: insertError } = await supabaseAdmin
          .from('profiles')
          .insert({ id: userId, full_name: fullName ?? email, email });

        if (insertError) {
          throw insertError;
        }
      }

      const { data: existingRoles, error: rolesError } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesError) {
        throw rolesError;
      }

      let branchId: string | null = null;
      const profileBranchId = (existingProfile as any)?.branch_id;

      if (profileBranchId) {
        branchId = profileBranchId;
      } else {
        const { data: mainBranch, error: branchError } = await supabaseAdmin
          .from('branches')
          .select('id')
          .eq('is_main_campus', true)
          .limit(1)
          .maybeSingle();

        if (branchError) {
          throw branchError;
        }

        if (mainBranch?.id) {
          branchId = mainBranch.id;

          if (existingProfile && !(existingProfile as any).branch_id) {
            const { error: profileUpdateError } = await supabaseAdmin
              .from('profiles')
              .update({ branch_id: branchId })
              .eq('id', userId);

            if (profileUpdateError) {
              throw profileUpdateError;
            }
          }
        }
      }

      if (!existingRoles || existingRoles.length === 0) {
        const { error: assignError } = await supabaseAdmin
          .from('user_roles')
          .insert({ user_id: userId, role: DEFAULT_USER_ROLE, branch_id: branchId })
          .onConflict(['user_id', 'role', 'branch_id'])
          .ignore();

        if (assignError) {
          throw assignError;
        }

        permissionCache.invalidate(userId);
      }

      return { success: true };
    } catch (error) {
      console.error('[initializeUser] error:', error);
      return { success: false, error: (error as Error).message || 'Failed to initialize user' };
    }
  });

/**
 * Create a user via the admin API so the current admin session is not replaced.
 * Profile row is created by the auth.users trigger; we update it and assign the role.
 */
export const createUser = createServerFn({ method: 'POST' })
  .validator((input: CreateUserInput) => input)
  .handler(async ({ data }) => {
    try {
      const { email, password, fullName, role, branchId } = data as CreateUserInput;

      const { data: existingUser, error: lookupError } =
        await supabaseAdmin.auth.admin.getUserByEmail(email);

      if (lookupError) {
        console.error('[createUser] lookup error:', lookupError);
        return { success: false, error: lookupError.message };
      }

      if (existingUser?.user) {
        return { success: false, error: 'A user with this email already exists' };
      }

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (authError) {
        throw authError;
      }

      const userId = authData.user.id;

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ full_name: fullName, email, branch_id: branchId })
        .eq('id', userId);

      if (profileError) {
        throw profileError;
      }

      const { error: roleError } = await supabaseAdmin.from('user_roles').insert({
        user_id: userId,
        role,
        branch_id: branchId,
      });

      if (roleError) {
        throw roleError;
      }

      permissionCache.invalidate(userId);
      return { success: true, userId };
    } catch (error) {
      console.error('[createUser] error:', error);
      return { success: false, error: (error as Error).message || 'Failed to create user' };
    }
  });

export default initializeUser;
