import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { supabase } from "@/integrations/supabase/client";
import { ensureActiveStudentOrStaff } from "@/core/auth/student-access";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }

    await ensureActiveStudentOrStaff(userId);
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar />
      <main className="flex-1 min-w-0 md:ml-64">
        <Outlet />
      </main>
    </div>
  );
}
