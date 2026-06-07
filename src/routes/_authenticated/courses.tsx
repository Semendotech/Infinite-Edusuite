import { createFileRoute, Link } from "@tanstack/react-router";
import { requirePermission } from "@/core/auth/route-guards";
import { Permission } from "@/core/rbac/permissions";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowLeft, BookOpen, Loader2, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const schema = z.object({
  branch_id: z.string().uuid("Pick a branch"),
  code: z.string().trim().min(2).max(20),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  credits: z.coerce.number().int().min(0).max(20).default(0),
});

export const Route = createFileRoute("/_authenticated/courses")({
  head: () => ({ meta: [{ title: "Courses — Infinite EduSuite" }] }),
  beforeLoad: ({ context }) => {
    requirePermission(context.auth, Permission.COURSE_VIEW);
  },
  component: CoursesPage,
});

function CoursesPage() {
  const { auth } = Route.useRouteContext();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

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

  const courses = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, code, name, description, credits, is_active, branch_id, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = courses.data?.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase())
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setSubmitting(true);
    try {
      const { error } = await supabase.from("courses").insert({
        branch_id: parsed.data.branch_id,
        code: parsed.data.code.toUpperCase(),
        name: parsed.data.name,
        description: parsed.data.description || null,
        credits: parsed.data.credits,
      });

      if (error) throw error;

      toast.success("Course created");
      (e.target as HTMLFormElement).reset();
      qc.invalidateQueries({ queryKey: ["courses"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create course");
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
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Courses</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage academic courses and curriculum.</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search courses..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card" style={{ boxShadow: "var(--shadow-sm)" }}>
              {courses.isLoading ? (
                <div className="grid place-items-center p-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : !filtered?.length ? (
                <div className="p-12 text-center">
                  <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-3 text-sm font-medium">No courses yet</p>
                  <p className="text-xs text-muted-foreground">Add your first course on the right.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Code</th>
                      <th className="px-4 py-3 text-left font-medium">Name</th>
                      <th className="px-4 py-3 text-left font-medium">Credits</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered?.map((c) => (
                      <tr key={c.id}>
                        <td className="px-4 py-3 font-mono text-xs">{c.code}</td>
                        <td className="px-4 py-3 font-medium">{c.name}</td>
                        <td className="px-4 py-3">{c.credits}</td>
                        <td className="px-4 py-3">
                          <Badge className={c.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                            {c.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <form onSubmit={onSubmit} className="h-fit rounded-2xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <h2 className="text-sm font-semibold">Add course</h2>
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
                <Label htmlFor="code">Course Code</Label>
                <Input id="code" name="code" required maxLength={20} placeholder="CS101" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">Course Name</Label>
                <Input id="name" name="name" required maxLength={120} placeholder="Introduction to Computer Science" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="credits">Credits</Label>
                <Input id="credits" name="credits" type="number" min={0} max={20} defaultValue={3} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Description (optional)</Label>
                <Input id="description" name="description" maxLength={500} />
              </div>
            </div>
            <Button type="submit" className="mt-4 w-full" disabled={submitting || !branches.data?.length}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
              Add course
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
