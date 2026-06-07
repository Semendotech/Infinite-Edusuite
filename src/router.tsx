import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { Permission, Role } from "@/core/rbac/permissions";
import { BranchContext } from "@/core/branch/branch.service";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  roles: Role[];
  branchIds: string[];
  permissions: Permission[];
}

export interface AuthContext {
  isAuthenticated: boolean;
  user: AuthUser | null;
  branchContext: BranchContext | null;
  hasRole: (role: Role) => boolean;
  hasAnyRole: (roles: Role[]) => boolean;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  isSuperAdmin: boolean;
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: {
      queryClient,
      auth: {
        isAuthenticated: false,
        user: null,
        branchContext: null,
        hasRole: () => false,
        hasAnyRole: () => false,
        hasPermission: () => false,
        hasAnyPermission: () => false,
        hasAllPermissions: () => false,
        isSuperAdmin: false,
      } as AuthContext,
    },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
import { supabase } from "@/integrations/supabase/client";

supabase.auth.getUser().then(({ data }) => {
  console.log("CURRENT USER ID:", data.user?.id);
});
