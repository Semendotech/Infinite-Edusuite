import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAnyPermission } from "@/core/auth/route-guards";
import { STUDENT_LIST_PERMISSIONS } from "@/config/access.config";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowLeft, Loader2, Plus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const schema = z.object({
  branch_id: z.string().uuid("Pick a branch"),
  registration_number: z.string().trim().min(2).max(40).regex(/^[A-Z0-9/_-]+$/i),
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
});

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({ meta: [{ title: "Students — Infinite EduSuite" }] }),
  beforeLoad: ({ context }) => {
    requireAnyPermission(context.auth, STUDENT_LIST_PERMISSIONS);
  },
  component: StudentsPage,
});

function StudentsPage() {
  const { auth } = Route.useRouteContext();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const branches = useQuery({
    queryKey: ["branches", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name, code")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const students = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, registration_number, first_name, last_name, email, status, branch_id, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setSubmitting(true);

    try {
      const { error } = await supabase.from("students").insert({
        branch_id: parsed.data.branch_id,
        registration_number: parsed.data.registration_number,
        first_name: parsed.data.first_name,
        last_name: parsed.data.last_name,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
      });

      if (error) throw error;

      toast.success("Student registered");
      (e.target as HTMLFormElement).reset();
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to register student");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Students</h1>
        <p className="mt-1 text-sm text-muted-foreground">Register and manage student records.</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="overflow-hidden rounded-2xl border border-border bg-card" style={{ boxShadow: "var(--shadow-sm)" }}>
            {students.isLoading ? (
              <div className="grid place-items-center p-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : !students.data?.length ? (
              <div className="p-12 text-center">
                <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium">No students yet</p>
                <p className="text-xs text-muted-foreground">Register your first student on the right.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Reg. No.</th>
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium">Email</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {students.data.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-3 font-mono text-xs">{s.registration_number}</td>
                      <td className="px-4 py-3">{s.first_name} {s.last_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.email}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <form onSubmit={onSubmit} className="h-fit rounded-2xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <h2 className="text-sm font-semibold">Register student</h2>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="branch_id">Branch</Label>
                <select
                  id="branch_id"
                  name="branch_id"
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs"
                >
                  <option value="">Select a branch…</option>
                  {branches.data?.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="registration_number">Registration No.</Label>
                <Input id="registration_number" name="registration_number" required maxLength={40} placeholder="EDU/2026/0001" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="first_name">First name</Label>
                  <Input id="first_name" name="first_name" required maxLength={80} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last_name">Last name</Label>
                  <Input id="last_name" name="last_name" required maxLength={80} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required maxLength={255} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" maxLength={30} placeholder="+254…" />
              </div>
            </div>
            <Button type="submit" className="mt-4 w-full" disabled={submitting || !branches.data?.length}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
              Register student
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
