import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { GraduationCap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { waitForAuthSession } from "@/core/auth/wait-for-session";
import { ensureActiveStudentOrStaff } from "@/core/auth/student-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PoweredBy } from "@/components/PoweredBy";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Minimum 6 characters").max(128),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
});

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/dashboard",
  }),
  // Do not auto-redirect authenticated users — they must sign in explicitly after logout.
  component: LoginPage,
});

function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const router = useRouter();
  const search = Route.useSearch();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      if (mode === "signup") {
        const parsed = signupSchema.safeParse({
          fullName: fd.get("fullName"),
          email: fd.get("email"),
          password: fd.get("password"),
        });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            data: { full_name: parsed.data.fullName },
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) {
          const msg = error.message || '';
          if (msg.toLowerCase().includes('user already registered') || msg.toLowerCase().includes('already exists')) {
            toast.error('An account with this email already exists. Please sign in.');
            setMode('signin');
            return;
          }
          throw error;
        }

        const user = data?.user;
        if (user) {
          // Check if any super_admin exists
          const { data: existingAdmin } = await supabase
            .from('user_roles')
            .select('id')
            .eq('role', 'super_admin')
            .limit(1);

          const role = (!existingAdmin || existingAdmin.length === 0) ? 'super_admin' : 'student';

          // Assign role directly
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({ user_id: user.id, role });

          if (roleError) {
            console.error('Failed to assign role:', roleError);
          } else {
            console.log(`Assigned role: ${role} to user: ${user.id}`);
          }
        }

        await waitForAuthSession();
        toast.success("Account created. Redirecting…");
        await router.invalidate();
        navigate({ to: "/dashboard" });

      } else {
        const parsed = loginSchema.safeParse({
          email: fd.get("email"),
          password: fd.get("password"),
        });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) throw error;
        const userId = data.user?.id ?? data.session?.user?.id;
        if (!userId) {
          throw new Error('Unable to validate your login. Please try again.');
        }
        await ensureActiveStudentOrStaff(userId);
        await waitForAuthSession();
        toast.success("Welcome back");
        await router.invalidate();
        navigate({ to: search.redirect as "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/dashboard',
        },
      });
      if (error) throw error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div
        className="relative hidden flex-col justify-between p-12 text-white lg:flex"
        style={{ background: "var(--gradient-hero)" }}
      >
        <Link to="/" className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 backdrop-blur">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="font-semibold tracking-tight">Infinite EduSuite</span>
        </Link>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">
            One platform for every campus, every student, every workflow.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            Multi-branch operations, branch-isolated data, audit-grade security and a delightful
            student portal — out of the box.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-white/50">© {new Date().getFullYear()} Infinite EduSuite</p>
          <PoweredBy className="text-white/60 [&_span]:text-white/80" />
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-background p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: "var(--gradient-primary)" }}>
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">Infinite EduSuite</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Sign in to your portal" : "Create your account"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Enter your credentials to access EduSuite."
              : "First account becomes super administrator."}
          </p>

          <Button
            type="button"
            variant="outline"
            className="mt-6 w-full"
            onClick={handleGoogle}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
              <path fill="#4285F4" d="M23 12.27c0-.86-.08-1.69-.22-2.49H12v4.71h6.16c-.27 1.43-1.07 2.65-2.28 3.46v2.88h3.69C21.7 18.83 23 15.84 23 12.27z"/>
              <path fill="#34A853" d="M12 23c3.07 0 5.66-1.02 7.55-2.76l-3.69-2.88c-1.03.69-2.35 1.1-3.86 1.1-2.97 0-5.49-2-6.39-4.7H1.79v2.95C3.67 20.59 7.55 23 12 23z"/>
              <path fill="#FBBC05" d="M5.61 13.76A6.74 6.74 0 0 1 5.27 12c0-.61.11-1.2.34-1.76V7.29H1.79A11 11 0 0 0 1 12c0 1.78.43 3.46 1.79 4.71l3.82-2.95z"/>
              <path fill="#EA4335" d="M12 5.34c1.67 0 3.17.57 4.35 1.7l3.27-3.27C17.65 1.96 15.07 1 12 1 7.55 1 3.67 3.41 1.79 7.29l3.82 2.95C6.51 7.34 9.03 5.34 12 5.34z"/>
            </svg>
            Continue with Google
          </Button>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span>OR</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" name="fullName" required maxLength={120} placeholder="Jane Mwangi" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" name="email" type="email" required maxLength={255} placeholder="you@college.ac.ke" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required minLength={6} maxLength={128} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </p>

          <div className="mt-8 flex justify-center border-t border-border pt-6">
            <PoweredBy />
          </div>
        </div>
      </div>
    </div>
  );
}
