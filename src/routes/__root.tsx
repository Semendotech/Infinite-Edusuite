import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import type { AuthContext, AuthUser } from "@/router";
import { rbacService } from "@/core/rbac/rbac.service";
import { branchService } from "@/core/branch/branch.service";
import { permissionCache } from "@/core/rbac/permission-cache";
import { Permission, Role } from "@/core/rbac/permissions";
import { authContextManager, initializeAuthContext } from "@/core/auth/authContextManager";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient; auth: AuthContext }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Infinite EduSuite — Multi-Branch College Management" },
      { name: "description", content: "Enterprise college management and student portal for multi-branch institutions." },
      { name: "author", content: "Infinite EduSuite" },
      { property: "og:title", content: "Infinite EduSuite — Multi-Branch College Management" },
      { property: "og:description", content: "Enterprise college management and student portal for multi-branch institutions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const [authState, setAuthState] = useState<{ user: AuthUser | null; branchContext: import('@/core/branch/branch.service').BranchContext | null; ready: boolean }>({
    user: null,
    branchContext: null,
    ready: false,
  });

  useEffect(() => {
    let active = true;

    async function hydrate(userId: string | null, email: string | null) {
      console.log('[AuthHydration] Starting hydration for user:', userId);
      console.log('[AuthHydration] Supabase URL (client):', import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL);
      console.log('[AuthHydration] Session user email:', email);
      
      if (!userId) {
        console.log('[AuthHydration] No user ID, setting auth state to null');
        authContextManager.clearContext();
        if (active) setAuthState({ user: null, branchContext: null, ready: true });
        return;
      }

      try {
        console.log('[AuthHydration] Fetching profile and roles...');
        const [{ data: profile }, { data: roles }] = await Promise.all([
          supabase.from("profiles").select("id, full_name, email, avatar_url, branch_id").eq("id", userId).maybeSingle(),
          supabase.from("user_roles").select("role, branch_id").eq("user_id", userId),
        ]);

        console.log('[AuthHydration] Profile:', profile);
        console.log('[AuthHydration] Roles from database:', roles);

        if (!active) return;

        const branchIds = Array.from(
          new Set(
            [profile?.branch_id, ...(roles?.map((r) => r.branch_id) ?? [])].filter(
              (b): b is string => Boolean(b),
            ),
          ),
        );

        let userRoles = (roles?.map((r) => r.role) ?? []) as Role[];
        console.log('[AuthHydration] User roles:', userRoles);
        console.log('[AuthHydration] Branch IDs:', branchIds);

        // Fallback: if user has no roles, assign student role using the server-side admin function
        if (userRoles.length === 0) {
          console.warn('[AuthHydration] User has no roles, initializing default RBAC assignment via server function');
          
          try {
            const { initializeUser } = await import('@/app/server-functions/auth');
            const initResult = await initializeUser({
              userId,
              email: profile?.email ?? email ?? '',
              fullName: profile?.full_name ?? email ?? 'User',
            });

            if (!initResult.success) {
              console.error('[AuthHydration] initializeUser failed:', initResult.error);
            } else {
              console.log('[AuthHydration] initializeUser succeeded, reloading role state');

              const { data: refreshedRoles } = await supabase
                .from('user_roles')
                .select('role, branch_id')
                .eq('user_id', userId);

              if (refreshedRoles?.length > 0) {
                userRoles = refreshedRoles.map((r) => r.role as Role);
                const refreshedBranchIds = refreshedRoles
                  .map((r) => r.branch_id)
                  .filter((b): b is string => Boolean(b));
                branchIds.push(...refreshedBranchIds);
                console.log('[AuthHydration] Refreshed roles after initialization:', userRoles);
                console.log('[AuthHydration] Refreshed branch IDs after initialization:', refreshedBranchIds);
              }
            }
          } catch (error) {
            console.error('[AuthHydration] initializeUser error:', error);
          }
        }

        // Get permissions from cache or fetch from service
        let permissions = permissionCache.getPermissions(userId);
        if (!permissions || permissions.length === 0) {
          console.log('[AuthHydration] Cache miss, fetching permissions from service...');
          permissions = await rbacService.getUserPermissions(userId);
          permissionCache.set(userId, permissions, userRoles);
        } else {
          console.log('[AuthHydration] Cache hit, permissions:', permissions.length);
        }
        
        console.log('[AuthHydration] Final permissions count:', permissions.length);

        // Get branch context. This always loads a current branch fallback so the authenticated
        // UI remains stable even when the user has no explicit profile/role branch assignment.
        let branchContext = null;
        try {
          branchContext = await branchService.getUserBranchContext(userId);
          console.log('[AuthHydration] Branch context:', branchContext);
        } catch (error) {
          console.error('[AuthHydration] Failed to load branch context:', error);
        }

        setAuthState({
          user: {
            id: userId,
            email: profile?.email ?? email ?? "",
            fullName: profile?.full_name ?? email ?? "User",
            avatarUrl: profile?.avatar_url ?? null,
            roles: userRoles,
            branchIds: branchIds.length > 0
              ? branchIds
              : branchContext?.accessibleBranches.map((branch) => branch.id) ?? [],
            permissions,
          },
          branchContext,
          ready: true,
        });
        
        console.log('[AuthHydration] Auth state set successfully');
        console.log('[AuthHydration] Final state:', {
          roles: userRoles,
          permissionCount: permissions.length,
          branchCount: branchIds.length,
        });
      } catch (error) {
        console.error('[AuthHydration] Error hydrating auth state:', error);
        if (active) setAuthState({ user: null, ready: true });
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      hydrate(data.session?.user.id ?? null, data.session?.user.email ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrate(session?.user.id ?? null, session?.user.email ?? null);
      router.invalidate();
      queryClient.invalidateQueries();
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient, router]);

  const auth = useMemo<AuthContext>(
    () => ({
      isAuthenticated: !!authState.user,
      user: authState.user,
      branchContext: authState.branchContext,
      hasRole: (role) => !!authState.user?.roles.includes(role),
      hasAnyRole: (roles) => !!authState.user?.roles.some((r) => roles.includes(r)),
      hasPermission: (permission) => !!authState.user?.permissions.includes(permission),
      hasAnyPermission: (permissions) => !!authState.user?.permissions.some((p) => permissions.includes(p)),
      hasAllPermissions: (permissions) => permissions.every((p) => authState.user?.permissions.includes(p)),
      isSuperAdmin: !!authState.user?.roles.includes(Role.SUPER_ADMIN),
    }),
    [authState.user, authState.branchContext],
  );

  // Delay injecting auth into router context and initializing the unified auth context
  // until auth hydration (permissions, roles, branch context) completes. This prevents
  // guards and UI from reading partially-initialized auth state and causing redirects.
  useEffect(() => {
    if (authState.ready) {
      router.update({ context: { queryClient, auth } });
      initializeAuthContext(auth);
    }
  }, [authState.ready, auth, queryClient, router]);

  if (!authState.ready) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
